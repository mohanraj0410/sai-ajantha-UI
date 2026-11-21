import { describe, expect, it } from "@jest/globals";
import {
  PaymentProvider,
  RazorpayProvider,
  setPaymentProvider,
} from "../razorpay-provider";
import { computeRazorpayPaymentSignature } from "../signature-verification";

describe("Razorpay Provider Adapter & Verification (Task 02.2 - BE-02, BE-04)", () => {
  describe("RazorpayProvider in Test / Isolated Mode", () => {
    it("creates deterministic test orders without making external network calls", async () => {
      const provider = new RazorpayProvider({ keyId: null, keySecret: null });

      const result = await provider.createOrder({
        amountPaise: 250000,
        currency: "INR",
        receipt: "rcpt_test_001",
      });

      expect(result.id).toMatch(/^order_test_[a-f0-9]+$/);
      expect(result.amount).toBe(250000);
      expect(result.currency).toBe("INR");
      expect(result.testMode).toBe(true);
      expect(result.status).toBe("created");
    });

    it("verifies checkout HMAC signatures accurately", () => {
      const provider = new RazorpayProvider();
      const orderId = "order_test_abc123";
      const paymentId = "pay_test_xyz789";
      const validSig = computeRazorpayPaymentSignature(orderId, paymentId);

      expect(provider.verifyCheckoutSignature(orderId, paymentId, validSig)).toBe(true);
      expect(provider.verifyCheckoutSignature(orderId, paymentId, "tampered_sig_1234")).toBe(false);
    });

    it("fetches deterministic payment details for test payments", async () => {
      const provider = new RazorpayProvider();
      const details = await provider.fetchPayment("pay_test_12345", {
        orderId: "order_test_abc123",
        expectedPaise: 750000,
      });

      expect(details.id).toBe("pay_test_12345");
      expect(details.order_id).toBe("order_test_abc123");
      expect(details.amount).toBe(750000);
      expect(details.currency).toBe("INR");
      expect(details.status).toBe("captured");
    });

    it("blocks live payment lookup when liveRazorpayEnabled is false", async () => {
      const provider = new RazorpayProvider();
      await expect(
        provider.fetchPayment("pay_live_real99999999")
      ).rejects.toThrow("Live payment lookup blocked: liveRazorpayEnabled flag is false.");
    });

    it("blocks live order creation when liveRazorpayEnabled is false even if keys are set", async () => {
      const provider = new RazorpayProvider({
        keyId: "rzp_live_key_mock",
        keySecret: "mock_secret_live",
      });

      await expect(
        provider.createOrder({
          amountPaise: 50000,
          receipt: "rcpt_live_block",
        })
      ).rejects.toThrow("Live payment order creation blocked: liveRazorpayEnabled flag is false.");
    });
  });

  describe("Payment Details Validation Rules in Provider Interface", () => {
    it("allows mocking the PaymentProvider for deterministic route tests", async () => {
      const mockProvider: PaymentProvider = {
        createOrder: jest.fn().mockResolvedValue({
          id: "order_mock_test",
          amount: 50000,
          currency: "INR",
          receipt: "rcpt_mock",
          status: "created",
          testMode: true,
        }),
        verifyCheckoutSignature: jest.fn().mockReturnValue(true),
        fetchPayment: jest.fn().mockResolvedValue({
          id: "pay_mock_1",
          order_id: "order_mock_test",
          amount: 50000,
          currency: "INR",
          status: "captured",
        }),
      };

      setPaymentProvider(mockProvider);

      const fetched = await mockProvider.fetchPayment("pay_mock_1");
      expect(fetched.amount).toBe(50000);
      expect(fetched.currency).toBe("INR");

      // Reset to default provider
      setPaymentProvider(null);
    });
  });
});
