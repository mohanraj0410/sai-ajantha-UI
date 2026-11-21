import crypto from "node:crypto";
import type { MedusaRequest } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DMS_MODULE } from "../modules/dms";
import type DmsModuleService from "../modules/dms/services";

export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  email: string;
  actor_role: string;
  action: string;
  resource: string;
  outcome: AuditOutcome;
  reason?: string | null;
  correlation_id: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /(password|pass|token|secret|authorization|cookie|jwt|api_?key|private_?key|phone|mobile|address|shipping_address|gstin|gst_number|raw_body|razorpay_signature|internal_notes)/i;

/**
 * Recursively strips passwords, tokens, secrets, and raw customer PII before
 * persisting or logging audit summaries.
 */
export function redactAuditSummary(
  value: unknown,
  depth = 0
): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[REDACTED_DEPTH]";
  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => redactAuditSummary(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactAuditSummary(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function buildAuditEntry(
  req: MedusaRequest,
  action: string,
  resource: string,
  details?: Record<string, unknown>,
  options?: { outcome?: AuditOutcome; reason?: string | null }
): AuditLogEntry {
  const staff = req.staff_user;
  const actorId = staff?.id || req.auth_context?.actor_id || "system";
  const email = staff?.email || "system@sai-ajanta.internal";
  const role =
    staff?.metadata && typeof staff.metadata.role === "string"
      ? staff.metadata.role
      : staff
        ? "admin"
        : "system";

  const rawCorr =
    req.headers?.["x-correlation-id"] ||
    req.headers?.["x-request-id"];
  const correlationId =
    typeof rawCorr === "string" && rawCorr.trim()
      ? rawCorr.trim().slice(0, 80)
      : crypto.randomUUID();

  const redactedDetails = details
    ? (redactAuditSummary(details) as Record<string, unknown>)
    : undefined;

  return {
    id: `aud_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
    actor_id: actorId,
    email,
    actor_role: role,
    action,
    resource,
    outcome: options?.outcome || "SUCCESS",
    reason: options?.reason ?? null,
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    details: redactedDetails,
  };
}

function emitConsoleAudit(req: MedusaRequest, entry: AuditLogEntry): void {
  try {
    const logger = req.scope?.resolve(ContainerRegistrationKeys.LOGGER, {
      allowUnregistered: true,
    }) as { info?: (msg: string) => void } | undefined;

    if (logger && typeof logger.info === "function") {
      logger.info(`[STAFF_AUDIT] ${JSON.stringify(entry)}`);
    } else {
      console.info(`[STAFF_AUDIT] ${JSON.stringify(entry)}`);
    }
  } catch {
    console.info(`[STAFF_AUDIT] ${JSON.stringify(entry)}`);
  }
}

async function persistEntryToDms(
  req: MedusaRequest,
  entry: AuditLogEntry
): Promise<boolean> {
  try {
    const dmsService = req.scope?.resolve<DmsModuleService>(DMS_MODULE, {
      allowUnregistered: true,
    });
    if (!dmsService || typeof dmsService.createStaffAuditEvents !== "function") {
      return false;
    }
    await dmsService.createStaffAuditEvents({
      id: entry.id,
      actor_id: entry.actor_id,
      actor_email: entry.email,
      actor_role: entry.actor_role,
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome,
      reason: entry.reason ?? null,
      correlation_id: entry.correlation_id,
      summary: entry.details ?? null,
      occurred_at: new Date(entry.timestamp),
    });
    return true;
  } catch (err) {
    console.error(
      `[STAFF_AUDIT_DB_WRITE_FAILED] action=${entry.action} resource=${entry.resource}:`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

/**
 * Persists an append-only durable staff audit event into `dms_staff_audit_event`.
 * Returns `{ persisted, entry }` so audit-critical routes can verify durable storage.
 */
export async function recordDurableAuditEvent(
  req: MedusaRequest,
  action: string,
  resource: string,
  details?: Record<string, unknown>,
  options?: { outcome?: AuditOutcome; reason?: string | null; required?: boolean }
): Promise<{ persisted: boolean; entry: AuditLogEntry }> {
  const entry = buildAuditEntry(req, action, resource, details, options);
  emitConsoleAudit(req, entry);
  const persisted = await persistEntryToDms(req, entry);
  if (!persisted && options?.required) {
    throw new Error(
      `Durable audit write failed for critical operation ${action} on ${resource}`
    );
  }
  return { persisted, entry };
}

/**
 * Synchronous audit helper preserved for backward compatibility; emits redacted log
 * and schedules durable DB write when `DMS_MODULE` is registered in `req.scope`.
 */
export function logAuditEvent(
  req: MedusaRequest,
  action: string,
  resource: string,
  details?: Record<string, unknown>,
  options?: { outcome?: AuditOutcome; reason?: string | null }
): AuditLogEntry {
  const entry = buildAuditEntry(req, action, resource, details, options);
  emitConsoleAudit(req, entry);
  void persistEntryToDms(req, entry);
  return entry;
}
