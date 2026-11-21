import { POST as createOrder } from "../route";
import { POST as capturePayment } from "../[id]/payment/route";

describe("Commercial Policy Feature Flag Enforcement (DEC-002 / DEC-003)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("POST /store/sai-ajanta/orders (Commercial Restrictions)", () => {
    it("rejects online checkout for DISTRIBUTOR when distributorOnlineCheckoutEnabled is false (403)", async () => {
      delete process.env.FEATURE_DISTRIBUTOR_ONLINE_CHECKOUT;

      const mockDmsService = {
        listAccountProfiles: jest.fn().mockResolvedValue([
          { customer_id: "cus_123", role: "DISTRIBUTOR", status: "ACTIVE" },
        ]),
      };

      const req: any = {
        auth_context: { actor_id: "cus_123" },
        scope: {
          resolve: jest.fn().mockReturnValue(mockDmsService),
        },
        body: {
          customerName: "Distributor Acme",
          customerEmail: "acme@distributor.com",
          customerPhone: "9876543210",
          shippingAddress: "123 Warehouse Rd",
          paymentMethod: "Razorpay Online Checkout",
          items: [
            {
              productId: "prod_1",
              name: "Standard Handle",
              category: "Handles",
              quantity: 10,
              packMultiplier: 1,
            },
          ],
        },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Distributor online checkout is currently disabled"),
        })
      );
    });

    it("rejects direct automated checkout for floor spring products when floorSpringsRouteConfirmed is false (403)", async () => {
      delete process.env.FEATURE_FLOOR_SPRINGS_CONFIRMED;

      const mockDmsService = {
        listAccountProfiles: jest.fn().mockResolvedValue([
          { customer_id: "cus_456", role: "DEALER", status: "ACTIVE" },
        ]),
      };

      const req: any = {
        auth_context: { actor_id: "cus_456" },
        scope: {
          resolve: jest.fn().mockReturnValue(mockDmsService),
        },
        body: {
          customerName: "Dealer Beta",
          customerEmail: "beta@dealer.com",
          customerPhone: "9876543211",
          shippingAddress: "456 Glass Lane",
          paymentMethod: "Proforma Invoice / Trade PO",
          status: "CONFIRMED_TRADE_PO",
          items: [
            {
              productId: "prod_fs1",
              name: "Heavy Duty Floor Spring Double Cylinder",
              category: "Floor Springs",
              quantity: 2,
              packMultiplier: 1,
            },
          ],
        },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Floor springs products are restricted to BOQ quotation"),
        })
      );
    });
  });

  describe("POST /store/sai-ajanta/orders/:id/payment (Payment Capture Policy)", () => {
    it("rejects payment capture for DISTRIBUTOR order when distributorPaymentCaptureEnabled is false (403)", async () => {
      delete process.env.FEATURE_DISTRIBUTOR_PAYMENT_CAPTURE;

      const mockDmsService = {
        listTradeOrders: jest.fn().mockResolvedValue([
          {
            id: "ord_dist_1",
            customer_id: "cus_dist_1",
            role_at_order: "DISTRIBUTOR",
            razorpay_order_id: "order_rzp_123",
            payment_status: "PENDING",
            items: [],
            events: [],
          },
        ]),
        listTradePayments: jest.fn().mockResolvedValue([]),
      };

      const req: any = {
        params: { id: "ord_dist_1" },
        auth_context: { actor_id: "cus_dist_1" },
        scope: {
          resolve: jest.fn().mockReturnValue(mockDmsService),
        },
        body: {
          action: "CAPTURE",
          razorpayOrderId: "order_rzp_123",
          razorpayPaymentId: "pay_rzp_456",
        },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await capturePayment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Distributor payment capture is disabled"),
        })
      );
    });
  });
});
