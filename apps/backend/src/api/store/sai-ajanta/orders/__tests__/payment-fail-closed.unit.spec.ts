import { POST as handlePayment } from "../[id]/payment/route";
import { computeRazorpayPaymentSignature } from "../../../../../lib/payment/signature-verification";
import { getIdempotencyStore } from "../../../../../lib/payment/idempotency";

describe("Fail-Closed Payment Capture Protection (P2.0.B / BE-02 / BE-03)", () => {
  beforeEach(() => {
    getIdempotencyStore().clear();
  });

  const mockOrder = {
    id: "ord_test_123",
    customer_id: "cus_customer_1",
    role_at_order: "CUSTOMER",
    razorpay_order_id: "order_test_rzp123",
    payment_status: "PENDING",
    total_inr: 5000,
    items: [],
    events: [],
  };

  it("rejects client-asserted capture without signature with 400 PAYMENT_SIGNATURE_REQUIRED", async () => {
    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([mockOrder]),
      listTradePayments: jest.fn().mockResolvedValue([]),
    };

    const req: any = {
      params: { id: "ord_test_123" },
      auth_context: { actor_id: "cus_customer_1" },
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
      body: {
        action: "CAPTURE",
        razorpayOrderId: "order_test_rzp123",
        razorpayPaymentId: "pay_forged_999",
        // No signature provided
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handlePayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PAYMENT_SIGNATURE_REQUIRED",
        message: expect.stringContaining("Client-asserted capture is forbidden"),
      })
    );
  });

  it("rejects client-asserted capture with tampered/invalid signature with 400 INVALID_PAYMENT_SIGNATURE", async () => {
    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([mockOrder]),
      listTradePayments: jest.fn().mockResolvedValue([]),
    };

    const req: any = {
      params: { id: "ord_test_123" },
      auth_context: { actor_id: "cus_customer_1" },
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
      body: {
        action: "CAPTURE",
        razorpayOrderId: "order_test_rzp123",
        razorpayPaymentId: "pay_tampered_999",
        razorpaySignature: "deadbeef0123456789abcdef",
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handlePayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "INVALID_PAYMENT_SIGNATURE",
      })
    );
  });

  it("rejects capture for non-test order when live payments are disabled with 403 LIVE_PAYMENTS_DISABLED", async () => {
    const liveOrder = {
      ...mockOrder,
      razorpay_order_id: "order_live_real_gateway_id_456",
    };

    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([liveOrder]),
      listTradePayments: jest.fn().mockResolvedValue([]),
    };

    const validSig = computeRazorpayPaymentSignature(
      "order_live_real_gateway_id_456",
      "pay_live_789"
    );

    const req: any = {
      params: { id: "ord_test_123" },
      auth_context: { actor_id: "cus_customer_1" },
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
      body: {
        action: "CAPTURE",
        razorpayOrderId: "order_live_real_gateway_id_456",
        razorpayPaymentId: "pay_live_789",
        razorpaySignature: validSig,
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handlePayment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "LIVE_PAYMENTS_DISABLED",
      })
    );
  });

  it("permits capture verification for valid test-mode signature", async () => {
    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([mockOrder]),
      listTradePayments: jest.fn().mockImplementation((filter: any) => {
        if (filter.provider_payment_id) return Promise.resolve([]);
        return Promise.resolve([{ id: "pmt_1", order_id: "ord_test_123" }]);
      }),
      updateTradePayments: jest.fn().mockResolvedValue({}),
      updateTradeOrders: jest.fn().mockResolvedValue({}),
    };

    const validSignature = computeRazorpayPaymentSignature(
      "order_test_rzp123",
      "pay_valid_123"
    );

    const req: any = {
      params: { id: "ord_test_123" },
      auth_context: { actor_id: "cus_customer_1" },
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
      body: {
        action: "CAPTURE",
        razorpayOrderId: "order_test_rzp123",
        razorpayPaymentId: "pay_valid_123",
        razorpaySignature: validSignature,
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handlePayment(req, res);

    expect(mockDmsService.updateTradeOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ord_test_123",
        status: "CONFIRMED",
        payment_status: "PAID",
        razorpay_payment_id: "pay_valid_123",
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        verified: true,
        paymentStatus: "PAID",
      })
    );
  });

  it("rejects payment capture if order status is CANCELLED with 400 ORDER_NOT_PAYABLE", async () => {
    const cancelledOrder = {
      ...mockOrder,
      status: "CANCELLED",
    };

    const mockDmsService = {
      listTradeOrders: jest.fn().mockResolvedValue([cancelledOrder]),
      listTradePayments: jest.fn().mockResolvedValue([]),
    };

    const req: any = {
      params: { id: "ord_test_123" },
      auth_context: { actor_id: "cus_customer_1" },
      scope: {
        resolve: jest.fn().mockReturnValue(mockDmsService),
      },
      body: {
        action: "CAPTURE",
        razorpayOrderId: "order_test_rzp123",
        razorpayPaymentId: "pay_valid_123",
        razorpaySignature: "sig_abc",
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handlePayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "ORDER_NOT_PAYABLE",
      })
    );
  });
});
