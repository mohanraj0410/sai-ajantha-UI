import { describe, expect, it } from "@jest/globals";
import {
  assertValidPaymentTransition,
  CanonicalOrderStatus,
  CanonicalPaymentStatus,
  deriveInitialOrderState,
  isValidPaymentTransition,
} from "../state-machine";

describe("Payment State Machine (Task 02.1 - BE-02, BE-03, BE-12)", () => {
  describe("Payment State Transitions", () => {
    it("allows valid forward transitions", () => {
      expect(isValidPaymentTransition("PENDING", "AUTHORIZED")).toBe(true);
      expect(isValidPaymentTransition("PENDING", "PAID")).toBe(true);
      expect(isValidPaymentTransition("PENDING", "PAYMENT_FAILED")).toBe(true);
      expect(isValidPaymentTransition("PENDING", "EXPIRED")).toBe(true);

      expect(isValidPaymentTransition("AUTHORIZED", "PAID")).toBe(true);
      expect(isValidPaymentTransition("PAID", "REFUND_REQUESTED")).toBe(true);
      expect(isValidPaymentTransition("PAID", "REFUNDED")).toBe(true);
      expect(isValidPaymentTransition("REFUND_REQUESTED", "REFUNDED")).toBe(true);
      expect(isValidPaymentTransition("PENDING_OFFLINE_SETTLEMENT", "PAID")).toBe(true);
    });

    it("allows identity transitions (no-op status updates)", () => {
      expect(isValidPaymentTransition("PENDING", "PENDING")).toBe(true);
      expect(isValidPaymentTransition("PAID", "PAID")).toBe(true);
      expect(isValidPaymentTransition("REFUNDED", "REFUNDED")).toBe(true);
    });

    it("rejects illegal payment transitions", () => {
      expect(isValidPaymentTransition("PENDING", "REFUNDED")).toBe(false);
      expect(isValidPaymentTransition("REFUNDED", "PAID")).toBe(false);
      expect(isValidPaymentTransition("PAYMENT_FAILED", "PAID")).toBe(false);
      expect(isValidPaymentTransition("PAID", "PENDING")).toBe(false);
    });

    it("throws a descriptive error on assertValidPaymentTransition failure", () => {
      expect(() =>
        assertValidPaymentTransition("PENDING", "REFUNDED")
      ).toThrow("Illegal payment status transition: cannot transition payment from [PENDING] to [REFUNDED].");

      expect(() =>
        assertValidPaymentTransition("REFUNDED", "PAID")
      ).toThrow("Illegal payment status transition: cannot transition payment from [REFUNDED] to [PAID].");
    });
  });

  describe("deriveInitialOrderState", () => {
    it("derives PENDING_PAYMENT / PENDING for online Razorpay orders, ignoring client input", () => {
      const state = deriveInitialOrderState({
        isRazorpay: true,
        hasQuoteItems: false,
      });

      expect(state.status).toBe("PENDING_PAYMENT");
      expect(state.paymentStatus).toBe("PENDING");
    });

    it("derives BOQ_QUOTE_REQUESTED / PENDING_OFFLINE_SETTLEMENT for orders with custom quote items", () => {
      const state = deriveInitialOrderState({
        isRazorpay: false,
        hasQuoteItems: true,
      });

      expect(state.status).toBe("BOQ_QUOTE_REQUESTED");
      expect(state.paymentStatus).toBe("PENDING_OFFLINE_SETTLEMENT");
    });

    it("derives CONFIRMED_TRADE_PO / PENDING_OFFLINE_SETTLEMENT for trade purchase orders", () => {
      const state = deriveInitialOrderState({
        isRazorpay: false,
        hasQuoteItems: false,
      });

      expect(state.status).toBe("CONFIRMED_TRADE_PO");
      expect(state.paymentStatus).toBe("PENDING_OFFLINE_SETTLEMENT");
    });
  });
});
