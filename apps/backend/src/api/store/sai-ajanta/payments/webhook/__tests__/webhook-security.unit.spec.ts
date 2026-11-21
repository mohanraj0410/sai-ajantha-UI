import { describe, expect, it } from "@jest/globals";
import { POST as handleWebhook } from "../route";
import { computeRazorpayWebhookSignature } from "../../../../../../lib/payment/signature-verification";

describe("Webhook Security & Payload Binding (Task 02.3 - BE-04 / SF-19)", () => {
  const mockOrderA = {
    id: "ord_db_id_A",
    customer_id: "cus_customer_A",
    role_at_order: "CUSTOMER",
    razorpay_order_id: "order_test_A",
    payment_status: "PENDING",
    total_inr: 100, // 10,000 paise
    items: [],
    events: [],
  };

  const mockOrderB = {
    id: "ord_db_id_B",
    customer_id: "cus_customer_B",
    role_at_order: "CUSTOMER",
    razorpay_order_id: "order_test_B",
    payment_status: "PENDING",
    total_inr: 10000, // 1,000,000 paise
    items: [],
    events: [],
  };

  it("rejects webhook requests without signature header with 401 INVALID_WEBHOOK_SIGNATURE", async () => {
    const req: any = {
      headers: {},
      body: { event: "payment.captured" },
      scope: { resolve: jest.fn() },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INVALID_WEBHOOK_SIGNATURE",
      })
    );
  });

  it("rejects webhook requests with forged/invalid signature with 401 INVALID_WEBHOOK_SIGNATURE", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const req: any = {
      headers: { "x-razorpay-signature": "deadbeefcafebabe0123456789" },
      body: rawBody,
      scope: { resolve: jest.fn() },
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INVALID_WEBHOOK_SIGNATURE",
      })
    );
  });

  it("neutralizes top-level wrapper substitution attacks (BE-04 exploit prevention)", async () => {
    // Valid signed payload for Order A (10,000 paise)
    const orderAPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_order_A_payment",
            order_id: "order_test_A",
            amount: 10000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const validSignatureForOrderA = computeRazorpayWebhookSignature(orderAPayload);

    const mockDmsService = {
      listTradeOrders: jest.fn().mockImplementation((query: any) => {
        if (query.razorpay_order_id === "order_test_A") return Promise.resolve([mockOrderA]);
        if (query.razorpay_order_id === "order_test_B") return Promise.resolve([mockOrderB]);
        return Promise.resolve([]);
      }),
      listTradePayments: jest.fn().mockResolvedValue([]),
      updateTradePayments: jest.fn().mockResolvedValue({}),
      updateTradeOrders: jest.fn().mockResolvedValue({}),
    };

    // Attacker crafts wrapper attempting to route Order A's signature to Order B
    const maliciousBody = {
      rawEventJson: orderAPayload,
      providerOrderId: "order_test_B", // Malicious outer substitution target
      eventType: "payment.captured",
      providerPaymentId: "pay_test_order_A_payment",
    };

    const req: any = {
      headers: { "x-razorpay-signature": validSignatureForOrderA },
      body: maliciousBody,
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    // Verify: The order updated was Order A, NOT Order B!
    expect(mockDmsService.updateTradeOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ord_db_id_A",
        status: "CONFIRMED",
        payment_status: "PAID",
      })
    );
    expect(mockDmsService.updateTradeOrders).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ord_db_id_B",
      })
    );
  });

  it("handles duplicate webhook idempotently without re-executing updates", async () => {
    const alreadyPaidOrder = {
      ...mockOrderA,
      payment_status: "PAID",
    };

    const rawPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_dup",
            order_id: "order_test_A",
            amount: 10000,
            currency: "INR",
          },
        },
      },
    });

    const signature = computeRazorpayWebhookSignature(rawPayload);

    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([alreadyPaidOrder]),
      listTradePayments: jest.fn().mockResolvedValue([]),
      updateTradePayments: jest.fn().mockResolvedValue({}),
      updateTradeOrders: jest.fn().mockResolvedValue({}),
    };

    const req: any = {
      headers: { "x-razorpay-signature": signature },
      body: rawPayload,
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    expect(mockDmsService.updateTradeOrders).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        received: true,
        duplicate: true,
      })
    );
  });

  it("rejects webhook if payment amount does not match expected order amount with 400 WEBHOOK_AMOUNT_MISMATCH", async () => {
    // Payload with underpayment: 500 paise instead of 10,000 paise
    const underpaymentPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_underpaid",
            order_id: "order_test_A",
            amount: 500, // Underpayment!
            currency: "INR",
          },
        },
      },
    });

    const signature = computeRazorpayWebhookSignature(underpaymentPayload);

    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([mockOrderA]),
      listTradePayments: jest.fn().mockResolvedValue([]),
      updateTradeOrders: jest.fn().mockResolvedValue({}),
    };

    const req: any = {
      headers: { "x-razorpay-signature": signature },
      body: underpaymentPayload,
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "WEBHOOK_AMOUNT_MISMATCH",
      })
    );
    expect(mockDmsService.updateTradeOrders).not.toHaveBeenCalled();
  });
});
