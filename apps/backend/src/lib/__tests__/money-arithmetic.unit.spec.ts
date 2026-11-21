import { describe, expect, it } from "@jest/globals";
import {
  computeOrderMoneyBreakdown,
  formatInrDisplay,
  inrToPaise,
  isQuoteOnlyPrice,
  paiseToInr,
  reconcileOrderMonetaryAmounts,
} from "../money";

describe("Exact Monetary Arithmetic & Reconciliation (Task 03.2 - BE-15 Precursor)", () => {
  describe("inrToPaise & paiseToInr Conversion", () => {
    it("converts standard rupee amounts to exact integer paise", () => {
      expect(inrToPaise(100)).toBe(10000);
      expect(inrToPaise(100.5)).toBe(10050);
      expect(inrToPaise(49.99)).toBe(4999);
      expect(inrToPaise(0)).toBe(0);
    });

    it("eliminates binary floating-point drift (e.g. 0.1 + 0.2)", () => {
      const floatSum = 0.1 + 0.2; // 0.30000000000000004 in raw JS
      expect(inrToPaise(floatSum)).toBe(30);
    });

    it("handles large commercial order amounts within safe integer range", () => {
      const largeOrderInr = 50_000_000; // ₹5 crore
      const paise = inrToPaise(largeOrderInr);
      expect(paise).toBe(5_000_000_000);
      expect(Number.isSafeInteger(paise)).toBe(true);
    });

    it("converts exact integer paise back to 2-decimal INR", () => {
      expect(paiseToInr(10050)).toBe(100.5);
      expect(paiseToInr(4999)).toBe(49.99);
      expect(paiseToInr(0)).toBe(0);
    });

    it("rejects non-integer fractional paise to prevent silent truncation errors", () => {
      expect(() => paiseToInr(100.45 as any)).toThrow(TypeError);
    });
  });

  describe("₹0 Quote-Only Policy Enforcement", () => {
    it("marks zero-priced products as quote-only (never payable for free)", () => {
      expect(isQuoteOnlyPrice(0)).toBe(true);
      expect(isQuoteOnlyPrice(0.0)).toBe(true);
    });

    it("marks missing or null-priced products as quote-only", () => {
      expect(isQuoteOnlyPrice(null)).toBe(true);
      expect(isQuoteOnlyPrice(undefined)).toBe(true);
      expect(isQuoteOnlyPrice(-50)).toBe(true);
    });

    it("marks positive-priced products as payable", () => {
      expect(isQuoteOnlyPrice(1)).toBe(false);
      expect(isQuoteOnlyPrice(4500)).toBe(false);
    });
  });

  describe("Deterministic Tax & Order Money Breakdown", () => {
    it("computes exact integer paise subtotal, GST, and total without float rounding loss", () => {
      // Order of ₹1,000 subtotal at 18% GST
      const breakdown = computeOrderMoneyBreakdown({
        subtotalInr: 1000,
        gstRatePercent: 18,
      });

      expect(breakdown.subtotalPaise).toBe(100000);
      expect(breakdown.gstAmountPaise).toBe(18000);
      expect(breakdown.totalPaise).toBe(118000);

      expect(breakdown.subtotalInr).toBe(1000);
      expect(breakdown.gstAmountInr).toBe(180);
      expect(breakdown.totalInr).toBe(1180);
    });

    it("computes exact GST breakdown when total is tax-inclusive", () => {
      const breakdown = computeOrderMoneyBreakdown({
        subtotalInr: 1180,
        gstRatePercent: 18,
        inclusiveGst: true,
      });

      expect(breakdown.totalPaise).toBe(118000);
      expect(breakdown.subtotalPaise).toBe(100000);
      expect(breakdown.gstAmountPaise).toBe(18000);
    });
  });

  describe("Monetary Reconciliation", () => {
    it("confirms reconciled order when order total matches payment paise exactly", () => {
      const result = reconcileOrderMonetaryAmounts({
        orderId: "ord_001",
        orderNumber: "ORD-2026-0001",
        orderTotalInr: 500,
        paymentAmountPaise: 50000,
      });

      expect(result.isReconciled).toBe(true);
      expect(result.variancePaise).toBe(0);
    });

    it("detects and reports underpayment discrepancy", () => {
      const result = reconcileOrderMonetaryAmounts({
        orderId: "ord_002",
        orderNumber: "ORD-2026-0002",
        orderTotalInr: 500,
        paymentAmountPaise: 49000, // ₹490 paid instead of ₹500
      });

      expect(result.isReconciled).toBe(false);
      expect(result.variancePaise).toBe(-1000); // 1000 paise (₹10) deficit
      expect(result.notes).toContain("underpayment of 1000 paise");
    });
  });

  describe("Executive INR Formatting", () => {
    it("formats rupee values with Indian numbering standard (Lakhs/Crores)", () => {
      const formatted = formatInrDisplay(150000);
      expect(formatted).toContain("1,50,000.00");
    });
  });
});
