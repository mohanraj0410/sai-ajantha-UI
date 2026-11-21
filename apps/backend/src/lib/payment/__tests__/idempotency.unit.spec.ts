import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  computePayloadFingerprint,
  getIdempotencyStore,
} from "../idempotency";

describe("Idempotency & Retry Safety Store (Task 02.4 - SF-19)", () => {
  const store = getIdempotencyStore();

  beforeEach(() => {
    store.clear();
  });

  describe("computePayloadFingerprint", () => {
    it("generates deterministic hash regardless of object key order", () => {
      const payload1 = {
        amountPaise: 50000,
        customerEmail: "mohan@sai-ajanta.com",
        items: [{ id: "item-1", qty: 2 }],
      };

      const payload2 = {
        items: [{ id: "item-1", qty: 2 }],
        customerEmail: "mohan@sai-ajanta.com",
        amountPaise: 50000,
      };

      expect(computePayloadFingerprint(payload1)).toBe(
        computePayloadFingerprint(payload2)
      );
    });

    it("generates differing fingerprints for mutated payloads", () => {
      const payloadOriginal = { amountPaise: 50000, qty: 1 };
      const payloadMutated = { amountPaise: 100000, qty: 1 };

      expect(computePayloadFingerprint(payloadOriginal)).not.toBe(
        computePayloadFingerprint(payloadMutated)
      );
    });
  });

  describe("Idempotency Store Check and Record", () => {
    it("returns NEW when no idempotency key is provided", async () => {
      const result = await store.check(
        null,
        "cus_01",
        "order:create",
        { dummy: true }
      );
      expect(result.status).toBe("NEW");
    });

    it("returns NEW on first request with a novel key", async () => {
      const result = await store.check(
        "idem_key_abc_123",
        "cus_01",
        "order:create",
        { amount: 100 }
      );
      expect(result.status).toBe("NEW");
    });

    it("replays cached response when identical key and payload are submitted", async () => {
      const key = "idem_key_order_999";
      const actorId = "cus_01";
      const op = "order:create";
      const payload = { amount: 500, customer: "test@sai-ajanta.com" };
      const response = { orderId: "ord_123", status: "CREATED" };

      // Record first invocation
      await store.record(key, actorId, op, payload, 201, response);

      // Replay request
      const replayResult = await store.check(key, actorId, op, payload);
      expect(replayResult.status).toBe("REPLAY");
      if (replayResult.status === "REPLAY") {
        expect(replayResult.responseStatus).toBe(201);
        expect(replayResult.responseBody).toEqual(response);
      }
    });

    it("detects conflict (409) when idempotency key is reused with differing payload", async () => {
      const key = "idem_key_conflict_test";
      const actorId = "cus_01";
      const op = "order:create";
      const originalPayload = { amount: 500 };
      const mutatedPayload = { amount: 1000 }; // Attacker tampering payload
      const response = { orderId: "ord_original" };

      await store.record(key, actorId, op, originalPayload, 201, response);

      const conflictResult = await store.check(
        key,
        actorId,
        op,
        mutatedPayload
      );

      expect(conflictResult.status).toBe("CONFLICT");
      if (conflictResult.status === "CONFLICT") {
        expect(conflictResult.message).toContain("different request payload");
      }
    });

    it("scopes idempotency keys by actor and operation to prevent cross-tenant/cross-action collisions", async () => {
      const key = "common_shared_uuid_key";
      const payload = { test: true };

      await store.record(
        key,
        "cus_user_A",
        "order:create",
        payload,
        201,
        { user: "A" }
      );

      // Same key, different user -> NEW
      const userBResult = await store.check(
        key,
        "cus_user_B",
        "order:create",
        payload
      );
      expect(userBResult.status).toBe("NEW");

      // Same key, same user, different operation -> NEW
      const captureResult = await store.check(
        key,
        "cus_user_A",
        "payment:capture",
        payload
      );
      expect(captureResult.status).toBe("NEW");
    });
  });
});
