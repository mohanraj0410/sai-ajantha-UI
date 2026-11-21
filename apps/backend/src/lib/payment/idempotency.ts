import crypto from "node:crypto";
import { DMS_MODULE } from "../../modules/dms";

export type IdempotencyStatus =
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED_RETRYABLE";

export interface IdempotencyRecord {
  key: string;
  actor_id: string;
  operation: string;
  fingerprint: string;
  status: IdempotencyStatus;
  response_status?: number;
  response_body?: Record<string, unknown>;
  created_at: string;
  expires_at: number;
}

export type IdempotencyCheckResult =
  | { status: "NEW"; finalKey: string }
  | {
      status: "REPLAY";
      finalKey: string;
      responseStatus: number;
      responseBody: Record<string, unknown>;
    }
  | { status: "CONFLICT"; finalKey: string; message: string };

const STALE_LEASE_MS = 60 * 1000; // 60-second lease for IN_PROGRESS state

function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${canonicalizeJson(
        (obj as Record<string, unknown>)[k]
      )}`
  );
  return `{${entries.join(",")}}`;
}

export function computePayloadFingerprint(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Resolves an idempotency key representing a specific checkout intent.
 * 1. If the client explicitly provides an Idempotency-Key header, use it.
 * 2. If the payload has a checkoutIntentId or razorpayOrderId, use it.
 * 3. If omitted, generates a unique intent UUID per request rather than collapsing
 *    future legitimate identical orders into a past historical order (P3.3.1 - Requirement A).
 */
export function resolveIdempotencyKey(
  providedKey: string | undefined | null,
  actorId: string,
  operation: string,
  payload?: unknown
): string {
  if (providedKey && providedKey.trim()) {
    return providedKey.trim();
  }

  // Check if payload contains an explicit checkoutIntentId
  if (payload && typeof payload === "object") {
    const candidate =
      (payload as Record<string, unknown>).checkoutIntentId ||
      (payload as Record<string, unknown>).checkout_intent_id;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  // Without explicit intent, generate a unique per-request intent
  const safeOp = operation.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `intent_${safeOp}_${crypto.randomUUID()}`;
}

class MemoryIdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();
  private readonly defaultTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  private compositeKey(
    key: string,
    actorId: string,
    operation: string
  ): string {
    return `${operation}:${actorId}:${key}`;
  }

  public async check(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown
  ): Promise<IdempotencyCheckResult> {
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);
    const cKey = this.compositeKey(finalKey, actorId, operation);
    const existing = this.store.get(cKey);
    const incomingFingerprint = computePayloadFingerprint(payload);

    if (!existing) {
      // Mark as IN_PROGRESS
      this.store.set(cKey, {
        key: finalKey,
        actor_id: actorId,
        operation,
        fingerprint: incomingFingerprint,
        status: "IN_PROGRESS",
        created_at: new Date().toISOString(),
        expires_at: Date.now() + this.defaultTtlMs,
      });
      return { status: "NEW", finalKey };
    }

    if (Date.now() > existing.expires_at) {
      this.store.delete(cKey);
      this.store.set(cKey, {
        key: finalKey,
        actor_id: actorId,
        operation,
        fingerprint: incomingFingerprint,
        status: "IN_PROGRESS",
        created_at: new Date().toISOString(),
        expires_at: Date.now() + this.defaultTtlMs,
      });
      return { status: "NEW", finalKey };
    }

    // Fingerprint verification
    if (incomingFingerprint !== existing.fingerprint) {
      return {
        status: "CONFLICT",
        finalKey,
        message: `Idempotency conflict: key '${finalKey}' was previously used for operation '${operation}' with a different request payload.`,
      };
    }

    if (existing.status === "IN_PROGRESS") {
      const isStale = Date.now() - new Date(existing.created_at).getTime() > STALE_LEASE_MS;
      if (isStale) {
        // Reclaim stale lease (e.g. previous worker crashed)
        existing.created_at = new Date().toISOString();
        existing.fingerprint = incomingFingerprint;
        return { status: "NEW", finalKey };
      }
      return {
        status: "CONFLICT",
        finalKey,
        message: `Concurrent request in progress for idempotency key '${finalKey}'.`,
      };
    }

    if (existing.status === "SUCCEEDED") {
      return {
        status: "REPLAY",
        finalKey,
        responseStatus: existing.response_status ?? 200,
        responseBody: existing.response_body ?? {},
      };
    }

    // FAILED_RETRYABLE allows re-attempt
    existing.status = "IN_PROGRESS";
    existing.created_at = new Date().toISOString();
    return { status: "NEW", finalKey };
  }

  public async record(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    ttlSeconds?: number
  ): Promise<void> {
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);
    const cKey = this.compositeKey(finalKey, actorId, operation);
    const ttlMs = (ttlSeconds ?? 86400) * 1000;

    const record: IdempotencyRecord = {
      key: finalKey,
      actor_id: actorId,
      operation,
      fingerprint: computePayloadFingerprint(payload),
      status: "SUCCEEDED",
      response_status: responseStatus,
      response_body: responseBody,
      created_at: new Date().toISOString(),
      expires_at: Date.now() + ttlMs,
    };

    this.store.set(cKey, record);
  }

  public async recordFailure(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown
  ): Promise<void> {
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);
    const cKey = this.compositeKey(finalKey, actorId, operation);
    const existing = this.store.get(cKey);
    if (existing) {
      existing.status = "FAILED_RETRYABLE";
    }
  }

  public clear(): void {
    this.store.clear();
  }
}

class DurableIdempotencyEngine {
  private memoryFallback = new MemoryIdempotencyStore();

  private resolveDmsService(scope?: any): any {
    if (!scope || typeof scope.resolve !== "function") return null;
    try {
      return scope.resolve(DMS_MODULE);
    } catch {
      return null;
    }
  }

  public async check(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown,
    scope?: any
  ): Promise<IdempotencyCheckResult> {
    const dmsService = this.resolveDmsService(scope);
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);
    const incomingFingerprint = computePayloadFingerprint(payload);

    if (!dmsService || typeof dmsService.createIdempotencyKeys !== "function") {
      return await this.memoryFallback.check(
        finalKey,
        actorId,
        operation,
        payload
      );
    }

    // 1. Attempt atomic insert of IN_PROGRESS claim
    try {
      await dmsService.createIdempotencyKeys({
        id: `idemp_${crypto.randomUUID()}`,
        idempotency_key: finalKey,
        actor_or_scope: actorId,
        operation,
        fingerprint: incomingFingerprint,
        status: "IN_PROGRESS",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return { status: "NEW", finalKey };
    } catch (insertErr: any) {
      const isUniqueViolation =
        insertErr?.code === "23505" ||
        insertErr?.message?.includes("unique") ||
        insertErr?.message?.includes("duplicate");

      if (!isUniqueViolation) {
        // Unexpected DB failure: fallback to memory store
        return await this.memoryFallback.check(
          finalKey,
          actorId,
          operation,
          payload
        );
      }
    }

    // 2. Row exists: query existing claim
    try {
      const records = (await dmsService.listIdempotencyKeys({
        idempotency_key: finalKey,
        actor_or_scope: actorId,
        operation,
      })) as any[];

      const existing = records && records.length > 0 ? records[0] : null;

      if (!existing) {
        return { status: "NEW", finalKey };
      }

      // Expiration check
      const isExpired = new Date() > new Date(existing.expires_at);
      if (isExpired) {
        if (typeof dmsService.updateIdempotencyKeys === "function") {
          await dmsService.updateIdempotencyKeys({
            id: existing.id,
            fingerprint: incomingFingerprint,
            status: "IN_PROGRESS",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
        }
        return { status: "NEW", finalKey };
      }

      // Fingerprint check
      if (existing.fingerprint !== incomingFingerprint) {
        return {
          status: "CONFLICT",
          finalKey,
          message: `Idempotency conflict: key '${finalKey}' was previously used for operation '${operation}' with a different request payload.`,
        };
      }

      // Status checks
      if (existing.status === "IN_PROGRESS") {
        const lastUpdated = existing.updated_at
          ? new Date(existing.updated_at).getTime()
          : new Date(existing.created_at).getTime();
        const isStale = Date.now() - lastUpdated > STALE_LEASE_MS;

        if (isStale) {
          // Reclaim stale lease from dead worker
          if (typeof dmsService.updateIdempotencyKeys === "function") {
            await dmsService.updateIdempotencyKeys({
              id: existing.id,
              status: "IN_PROGRESS",
              fingerprint: incomingFingerprint,
            });
          }
          return { status: "NEW", finalKey };
        }

        return {
          status: "CONFLICT",
          finalKey,
          message: `Concurrent request in progress for idempotency key '${finalKey}'.`,
        };
      }

      if (existing.status === "SUCCEEDED") {
        return {
          status: "REPLAY",
          finalKey,
          responseStatus: existing.response_status ?? 200,
          responseBody: existing.response_body ?? {},
        };
      }

      // FAILED_RETRYABLE
      if (typeof dmsService.updateIdempotencyKeys === "function") {
        await dmsService.updateIdempotencyKeys({
          id: existing.id,
          status: "IN_PROGRESS",
        });
      }
      return { status: "NEW", finalKey };
    } catch {
      return await this.memoryFallback.check(
        finalKey,
        actorId,
        operation,
        payload
      );
    }
  }

  public async record(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    ttlSeconds?: number,
    scope?: any
  ): Promise<void> {
    const dmsService = this.resolveDmsService(scope);
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);
    const ttlMs = (ttlSeconds ?? 86400) * 1000;
    const incomingFingerprint = computePayloadFingerprint(payload);

    await this.memoryFallback.record(
      finalKey,
      actorId,
      operation,
      payload,
      responseStatus,
      responseBody,
      ttlSeconds
    );

    if (!dmsService || typeof dmsService.listIdempotencyKeys !== "function") {
      return;
    }

    try {
      const records = (await dmsService.listIdempotencyKeys({
        idempotency_key: finalKey,
        actor_or_scope: actorId,
        operation,
      })) as any[];

      const existing = records && records.length > 0 ? records[0] : null;

      if (existing && typeof dmsService.updateIdempotencyKeys === "function") {
        await dmsService.updateIdempotencyKeys({
          id: existing.id,
          status: "SUCCEEDED",
          response_status: responseStatus,
          response_body: responseBody,
          expires_at: new Date(Date.now() + ttlMs),
        });
      } else if (typeof dmsService.createIdempotencyKeys === "function") {
        await dmsService.createIdempotencyKeys({
          id: `idemp_${crypto.randomUUID()}`,
          idempotency_key: finalKey,
          actor_or_scope: actorId,
          operation,
          fingerprint: incomingFingerprint,
          status: "SUCCEEDED",
          response_status: responseStatus,
          response_body: responseBody,
          expires_at: new Date(Date.now() + ttlMs),
        });
      }
    } catch (err) {
      console.warn(`[Idempotency] Failed to record durable key in DB:`, err);
    }
  }

  public async recordFailure(
    key: string | undefined | null,
    actorId: string,
    operation: string,
    payload: unknown,
    scope?: any
  ): Promise<void> {
    const dmsService = this.resolveDmsService(scope);
    const finalKey = resolveIdempotencyKey(key, actorId, operation, payload);

    await this.memoryFallback.recordFailure(
      finalKey,
      actorId,
      operation,
      payload
    );

    if (!dmsService || typeof dmsService.listIdempotencyKeys !== "function") {
      return;
    }

    try {
      const records = (await dmsService.listIdempotencyKeys({
        idempotency_key: finalKey,
        actor_or_scope: actorId,
        operation,
      })) as any[];

      const existing = records && records.length > 0 ? records[0] : null;
      if (existing && typeof dmsService.updateIdempotencyKeys === "function") {
        await dmsService.updateIdempotencyKeys({
          id: existing.id,
          status: "FAILED_RETRYABLE",
        });
      }
    } catch (err) {
      console.warn(`[Idempotency] Failed to record failure in DB:`, err);
    }
  }

  public clear(): void {
    this.memoryFallback.clear();
  }
}

const defaultDurableEngine = new DurableIdempotencyEngine();

export function getIdempotencyStore(): DurableIdempotencyEngine {
  return defaultDurableEngine;
}
