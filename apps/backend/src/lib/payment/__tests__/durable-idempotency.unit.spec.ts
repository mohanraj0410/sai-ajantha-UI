import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import {
  computePayloadFingerprint,
  getIdempotencyStore,
  resolveIdempotencyKey,
} from "../idempotency";
import {
  markWebhookFailed,
  markWebhookProcessed,
  recordWebhookIncoming,
} from "../webhook-inbox";
import { Migration20261116180000 } from "../../../modules/dms/migrations/Migration20261116180000";

describe("Durable Identity, Idempotency & Webhook Inbox (Work Units P3.3 & P3.3.1)", () => {
  beforeEach(() => {
    getIdempotencyStore().clear();
  });

  describe("Checkout Intent Idempotency Resolution (P3.3.1 - Requirement A)", () => {
    it("preserves explicitly provided Idempotency-Key headers across retries (same intent + same key -> same order)", () => {
      const key = resolveIdempotencyKey(
        "  checkout_intent_uuid_999  ",
        "cus_1",
        "order:create",
        { items: [{ sku: "DOR-01", qty: 2 }] }
      );
      expect(key).toBe("checkout_intent_uuid_999");
    });

    it("resolves checkoutIntentId or checkout_intent_id from payload when header is omitted", () => {
      const payloadWithIntent = {
        checkoutIntentId: "intent_ui_client_456",
        items: [{ sku: "DOR-01", qty: 1 }],
      };
      const key = resolveIdempotencyKey("", "cus_1", "order:create", payloadWithIntent);
      expect(key).toBe("intent_ui_client_456");

      const payloadWithSnakeIntent = {
        checkout_intent_id: "intent_snake_789",
        action: "CAPTURE",
      };
      const snakeKey = resolveIdempotencyKey("", "cus_1", "payment:capture", payloadWithSnakeIntent);
      expect(snakeKey).toBe("intent_snake_789");
    });

    it("generates distinct unique intent IDs for un-keyed requests so legitimate identical purchases NEVER collapse (Requirement A.2)", () => {
      const identicalPayload = { items: [{ sku: "DOR-01", qty: 2 }], total: 1000 };

      // Customer buys on Monday without explicit intent header
      const keyMonday = resolveIdempotencyKey("", "cus_1", "order:create", identicalPayload);
      // Customer buys exact same items on Wednesday without explicit intent header
      const keyWednesday = resolveIdempotencyKey("", "cus_1", "order:create", identicalPayload);

      // They MUST be distinct intent keys, ensuring two distinct orders are created
      expect(keyMonday).not.toBe(keyWednesday);
      expect(keyMonday).toMatch(/^intent_order_create_[a-f0-9-]+$/);
      expect(keyWednesday).toMatch(/^intent_order_create_[a-f0-9-]+$/);
    });
  });

  describe("Durable Idempotency Engine State Machine & Anti-Stampede (P3.3.1 - Requirements A & B)", () => {
    it("scenario 1 & 3: transitions NEW -> IN_PROGRESS on initial check and rejects concurrent race with CONFLICT", async () => {
      const store = getIdempotencyStore();
      const payload = { orderId: "ord_1", amountPaise: 50000 };

      // Process 1 claims intent
      const check1 = await store.check("intent_abc", "cus_1", "payment:capture", payload);
      expect(check1.status).toBe("NEW");

      // Process 2 concurrently attempts same intent
      const check2 = await store.check("intent_abc", "cus_1", "payment:capture", payload);
      expect(check2.status).toBe("CONFLICT");
      if (check2.status === "CONFLICT") {
        expect(check2.message).toContain("Concurrent request in progress");
      }
    });

    it("scenario 5: replays exact cached response on lost network response and retry", async () => {
      const store = getIdempotencyStore();
      const payload = { orderId: "ord_1", amountPaise: 50000 };
      const responseBody = { verified: true, paymentStatus: "PAID", orderStatus: "CONFIRMED" };

      await store.check("intent_retry_safe", "cus_1", "payment:capture", payload);
      await store.record("intent_retry_safe", "cus_1", "payment:capture", payload, 200, responseBody);

      // Client lost response and retries
      const replayCheck = await store.check("intent_retry_safe", "cus_1", "payment:capture", payload);
      expect(replayCheck.status).toBe("REPLAY");
      if (replayCheck.status === "REPLAY") {
        expect(replayCheck.responseStatus).toBe(200);
        expect(replayCheck.responseBody).toEqual(responseBody);
      }
    });

    it("scenario 4: rejects mutated payload with CONFLICT (409) when same intent key is reused with differing content", async () => {
      const store = getIdempotencyStore();
      const payloadOrig = { orderId: "ord_1", amountPaise: 50000 };
      const payloadTampered = { orderId: "ord_1", amountPaise: 999999 };

      await store.check("intent_tamper_test", "cus_1", "payment:capture", payloadOrig);
      await store.record("intent_tamper_test", "cus_1", "payment:capture", payloadOrig, 200, { success: true });

      const conflictCheck = await store.check("intent_tamper_test", "cus_1", "payment:capture", payloadTampered);
      expect(conflictCheck.status).toBe("CONFLICT");
      if (conflictCheck.status === "CONFLICT") {
        expect(conflictCheck.message).toContain("different request payload");
      }
    });

    it("allows retry after recordFailure() sets status to FAILED_RETRYABLE", async () => {
      const store = getIdempotencyStore();
      const payload = { orderId: "ord_1", amountPaise: 50000 };

      await store.check("intent_failed_recovery", "cus_1", "payment:capture", payload);
      await store.recordFailure("intent_failed_recovery", "cus_1", "payment:capture", payload);

      const retryCheck = await store.check("intent_failed_recovery", "cus_1", "payment:capture", payload);
      expect(retryCheck.status).toBe("NEW");
    });
  });

  describe("Database Atomic Claim & Stale Owner Recovery (P3.3.1 - Requirement B)", () => {
    it("handles PostgreSQL unique constraint collision (SQLSTATE 23505) atomically", async () => {
      const store = getIdempotencyStore();
      const payload = { orderId: "ord_1", amountPaise: 50000 };

      const mockDmsService = {
        createIdempotencyKeys: (jest.fn() as any).mockRejectedValue({
          code: "23505",
          message: 'duplicate key value violates unique constraint "IDX_dms_idempotency_key_composite"',
        }),
        listIdempotencyKeys: (jest.fn() as any).mockResolvedValue([
          {
            id: "idemp_in_flight",
            idempotency_key: "intent_db_race",
            actor_or_scope: "cus_1",
            operation: "payment:capture",
            fingerprint: computePayloadFingerprint(payload),
            status: "IN_PROGRESS",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(), // fresh lease
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          },
        ]),
      };

      const mockScope = {
        resolve: (jest.fn() as any).mockReturnValue(mockDmsService),
      };

      const check = await store.check("intent_db_race", "cus_1", "payment:capture", payload, mockScope);
      expect(check.status).toBe("CONFLICT");
      if (check.status === "CONFLICT") {
        expect(check.message).toContain("Concurrent request in progress");
      }
    });

    it("reclaims stale lease (>60s) from a crashed worker so client retry can proceed", async () => {
      const store = getIdempotencyStore();
      const payload = { orderId: "ord_1", amountPaise: 50000 };

      // Worker 1 crashed 90 seconds ago while status was IN_PROGRESS
      const staleTimestamp = new Date(Date.now() - 90 * 1000).toISOString();

      const mockDmsService = {
        createIdempotencyKeys: (jest.fn() as any).mockRejectedValue({
          code: "23505",
          message: 'duplicate key value violates unique constraint "IDX_dms_idempotency_key_composite"',
        }),
        listIdempotencyKeys: (jest.fn() as any).mockResolvedValue([
          {
            id: "idemp_stale_1",
            idempotency_key: "intent_stale_worker",
            actor_or_scope: "cus_1",
            operation: "payment:capture",
            fingerprint: computePayloadFingerprint(payload),
            status: "IN_PROGRESS",
            created_at: staleTimestamp,
            updated_at: staleTimestamp,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          },
        ]),
        updateIdempotencyKeys: (jest.fn() as any).mockResolvedValue({}),
      };

      const mockScope = {
        resolve: (jest.fn() as any).mockReturnValue(mockDmsService),
      };

      // Worker 2 / client retry arrives
      const check = await store.check("intent_stale_worker", "cus_1", "payment:capture", payload, mockScope);

      // Must reclaim the stale lease rather than rejecting with conflict!
      expect(check.status).toBe("NEW");
      expect(mockDmsService.updateIdempotencyKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "idemp_stale_1",
          status: "IN_PROGRESS",
        })
      );
    });
  });

  describe("Webhook Inbox Resilience & Safe Retry Recovery (P3.3.1 - Requirement C)", () => {
    it("safely acknowledges duplicate deliveries of PROCESSED events without re-executing", async () => {
      const mockDmsService = {
        listWebhookInboxes: (jest.fn() as any).mockResolvedValue([
          {
            id: "wkinb_done_1",
            provider: "RAZORPAY",
            provider_event_id: "evt_1001",
            status: "PROCESSED",
            processed_at: new Date().toISOString(),
          },
        ]),
      };

      const result = await recordWebhookIncoming(mockDmsService, {
        provider: "RAZORPAY",
        providerEventId: "evt_1001",
        eventType: "payment.captured",
        providerOrderId: "order_test_A",
        providerPaymentId: "pay_test_A",
        rawPayload: JSON.stringify({ event: "payment.captured" }),
      });

      expect(result.duplicate).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
    });

    it("reclaims FAILED_RETRYABLE events on provider retry instead of permanently suppressing", async () => {
      const mockDmsService = {
        listWebhookInboxes: (jest.fn() as any).mockResolvedValue([
          {
            id: "wkinb_transient_err_1",
            provider: "RAZORPAY",
            provider_event_id: "evt_transient_1",
            status: "FAILED_RETRYABLE",
            retry_count: 1,
            last_attempt_at: new Date(Date.now() - 30000).toISOString(),
          },
        ]),
        updateWebhookInboxes: (jest.fn() as any).mockResolvedValue({}),
      };

      const result = await recordWebhookIncoming(mockDmsService, {
        provider: "RAZORPAY",
        providerEventId: "evt_transient_1",
        eventType: "payment.captured",
        providerOrderId: "order_test_A",
        providerPaymentId: "pay_test_A",
        rawPayload: JSON.stringify({ event: "payment.captured" }),
      });

      // Must NOT be treated as duplicate; must be reclaimed for retry
      expect(result.duplicate).toBe(false);
      expect(result.inboxId).toBe("wkinb_transient_err_1");
      expect(mockDmsService.updateWebhookInboxes).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "wkinb_transient_err_1",
          status: "PROCESSING",
          retry_count: 2,
        })
      );
    });

    it("reclaims stale PROCESSING claim from crashed worker on provider retry", async () => {
      const mockDmsService = {
        listWebhookInboxes: (jest.fn() as any).mockResolvedValue([
          {
            id: "wkinb_crashed_worker",
            provider: "RAZORPAY",
            provider_event_id: "evt_crashed_1",
            status: "PROCESSING",
            retry_count: 0,
            last_attempt_at: new Date(Date.now() - 90000).toISOString(), // 90s ago
          },
        ]),
        updateWebhookInboxes: (jest.fn() as any).mockResolvedValue({}),
      };

      const result = await recordWebhookIncoming(mockDmsService, {
        provider: "RAZORPAY",
        providerEventId: "evt_crashed_1",
        eventType: "payment.captured",
        providerOrderId: "order_test_A",
        providerPaymentId: "pay_test_A",
        rawPayload: JSON.stringify({ event: "payment.captured" }),
      });

      expect(result.duplicate).toBe(false);
      expect(result.inboxId).toBe("wkinb_crashed_worker");
      expect(mockDmsService.updateWebhookInboxes).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "wkinb_crashed_worker",
          status: "PROCESSING",
          retry_count: 1,
        })
      );
    });

    it("records explicit failure status via markWebhookFailed", async () => {
      const mockDmsService = {
        updateWebhookInboxes: (jest.fn() as any).mockResolvedValue({}),
      };

      await markWebhookFailed(mockDmsService, "wkinb_test", true, "Database lock timeout");
      expect(mockDmsService.updateWebhookInboxes).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "wkinb_test",
          status: "FAILED_RETRYABLE",
          error_message: "Database lock timeout",
        })
      );

      await markWebhookFailed(mockDmsService, "wkinb_test", false, "Amount mismatch");
      expect(mockDmsService.updateWebhookInboxes).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "wkinb_test",
          status: "FAILED_PERMANENT",
          error_message: "Amount mismatch",
        })
      );
    });
  });

  describe("Database Migration 20261116180000 (BE-09 Schema, Foreign Keys & Constraints)", () => {
    it("produces additive SQL statements for idempotency, webhook inbox, foreign keys, and indexes", async () => {
      const migration = new Migration20261116180000({} as any, {} as any);
      const sqlStatements: string[] = [];
      migration.addSql = (sql: string) => {
        sqlStatements.push(sql);
      };

      await migration.up();

      const fullSql = sqlStatements.join("\n");

      // Durable Idempotency
      expect(fullSql).toContain('"dms_idempotency_key"');
      expect(fullSql).toContain('"IDX_dms_idempotency_key_composite"');

      // Webhook Inbox with retry tracking
      expect(fullSql).toContain('"dms_webhook_inbox"');
      expect(fullSql).toContain('"retry_count"');
      expect(fullSql).toContain('"last_attempt_at"');

      // Foreign Key & Unique Payment Constraints (BE-09)
      expect(fullSql).toContain('"fk_dms_trade_payment_order_id"');
      expect(fullSql).toContain('"IDX_dms_trade_payment_provider_payment_id_unique"');

      // Backfill paise
      expect(fullSql).toContain('"subtotal_paise" = ROUND("subtotal_inr" * 100)::bigint');
    });
  });
});
