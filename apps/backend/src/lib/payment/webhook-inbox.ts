import crypto from "node:crypto";

export type WebhookProcessingStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT"
  | "IGNORED";

export interface WebhookEventRecord {
  provider: string;
  providerEventId: string;
  eventType?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  rawPayload: string;
}

export interface WebhookInboxResult {
  duplicate: boolean;
  inboxId?: string;
  message?: string;
  alreadyProcessed?: boolean;
}

const STALE_PROCESSING_LEASE_MS = 60 * 1000; // 60 seconds

/**
 * Persists and coordinates an incoming webhook event in `dms_webhook_inbox`.
 * Guarantees that:
 * 1. PROCESSED events are safely acknowledged as duplicates without re-executing side effects.
 * 2. In-flight events within the lease window are protected against concurrent stampedes.
 * 3. FAILED_RETRYABLE events or stale PROCESSING claims (e.g. from a crashed worker)
 *    are safely reclaimed on retry rather than permanently suppressed (P3.3.1 - Requirement C).
 */
export async function recordWebhookIncoming(
  dmsService: any,
  event: WebhookEventRecord
): Promise<WebhookInboxResult> {
  const payloadHash = crypto
    .createHash("sha256")
    .update(event.rawPayload)
    .digest("hex");

  if (!dmsService) {
    return { duplicate: false, inboxId: undefined };
  }

  // 1. Check for existing event record
  if (typeof dmsService.listWebhookInboxes === "function") {
    try {
      const existingRecords = (await dmsService.listWebhookInboxes({
        provider: event.provider,
        provider_event_id: event.providerEventId,
      })) as any[];

      const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

      if (existing) {
        // A. Already successfully processed -> Safe duplicate acknowledgement
        if (existing.status === "PROCESSED") {
          return {
            duplicate: true,
            alreadyProcessed: true,
            inboxId: existing.id,
            message: `Webhook event '${event.providerEventId}' already processed.`,
          };
        }

        // B. Permanently failed -> Reject retry
        if (existing.status === "FAILED_PERMANENT") {
          return {
            duplicate: true,
            alreadyProcessed: false,
            inboxId: existing.id,
            message: `Webhook event '${event.providerEventId}' permanently failed: ${existing.error_message || "Unknown"}`,
          };
        }

        // C. Check if currently in-flight by an active worker
        const lastAttempt = existing.last_attempt_at
          ? new Date(existing.last_attempt_at).getTime()
          : new Date(existing.created_at).getTime();
        const isStale = Date.now() - lastAttempt > STALE_PROCESSING_LEASE_MS;

        if (existing.status === "PROCESSING" && !isStale) {
          return {
            duplicate: true,
            alreadyProcessed: false,
            inboxId: existing.id,
            message: `Webhook event '${event.providerEventId}' is currently being processed by another worker.`,
          };
        }

        // D. Recovery path: status is FAILED_RETRYABLE or stale PROCESSING claim
        // Reclaim lease and increment retry count
        const nextRetry = (existing.retry_count || 0) + 1;
        if (typeof dmsService.updateWebhookInboxes === "function") {
          await dmsService.updateWebhookInboxes({
            id: existing.id,
            status: "PROCESSING",
            retry_count: nextRetry,
            last_attempt_at: new Date(),
          });
        }

        return {
          duplicate: false,
          inboxId: existing.id,
          message: `Webhook event '${event.providerEventId}' reclaimed for retry #${nextRetry}.`,
        };
      }
    } catch {
      // Proceed to atomic insert on read errors
    }
  }

  // 2. New event: attempt atomic insert with PROCESSING status
  if (typeof dmsService.createWebhookInboxes !== "function") {
    return { duplicate: false, inboxId: undefined };
  }

  try {
    const created = await dmsService.createWebhookInboxes({
      id: `wkinb_${crypto.randomUUID()}`,
      provider: event.provider,
      provider_event_id: event.providerEventId,
      event_type: event.eventType || null,
      provider_order_id: event.providerOrderId || null,
      provider_payment_id: event.providerPaymentId || null,
      payload_hash: payloadHash,
      status: "PROCESSING",
      retry_count: 0,
      last_attempt_at: new Date(),
    });

    return {
      duplicate: false,
      inboxId: created?.id || created?.[0]?.id,
    };
  } catch (err: any) {
    // Unique constraint violation (SQLSTATE 23505)
    const isUniqueViolation =
      err?.code === "23505" ||
      err?.message?.includes("unique") ||
      err?.message?.includes("duplicate") ||
      err?.constraint?.includes("provider_event");

    if (isUniqueViolation) {
      // Re-read existing record to determine whether already PROCESSED or in-flight
      if (typeof dmsService.listWebhookInboxes === "function") {
        try {
          const records = await dmsService.listWebhookInboxes({
            provider: event.provider,
            provider_event_id: event.providerEventId,
          });
          const rec = records?.[0];
          if (rec?.status === "PROCESSED") {
            return {
              duplicate: true,
              alreadyProcessed: true,
              inboxId: rec.id,
              message: `Webhook event '${event.providerEventId}' already processed.`,
            };
          }
        } catch {
          // ignore
        }
      }

      return {
        duplicate: true,
        alreadyProcessed: false,
        message: `Webhook event '${event.providerEventId}' from provider '${event.provider}' was already received. Duplicate ignored.`,
      };
    }

    throw err;
  }
}

/**
 * Updates the processing status of a recorded webhook inbox item.
 */
export async function markWebhookProcessed(
  dmsService: any,
  inboxId: string | undefined,
  status: WebhookProcessingStatus = "PROCESSED",
  errorMessage?: string
): Promise<void> {
  if (!inboxId || !dmsService || typeof dmsService.updateWebhookInboxes !== "function") {
    return;
  }

  try {
    await dmsService.updateWebhookInboxes({
      id: inboxId,
      status,
      processed_at: status === "PROCESSED" ? new Date() : null,
      error_message: errorMessage || null,
    });
  } catch (err) {
    console.warn(`[WebhookInbox] Failed to update status for inbox ${inboxId}:`, err);
  }
}

/**
 * Explicit failure recording for retryable vs permanent errors.
 */
export async function markWebhookFailed(
  dmsService: any,
  inboxId: string | undefined,
  retryable: boolean,
  errorMessage: string
): Promise<void> {
  await markWebhookProcessed(
    dmsService,
    inboxId,
    retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT",
    errorMessage
  );
}
