import {
  CreateOrderRequestSchema,
  parseRequestBody,
  UpdateCustomerProfileSchema,
  UpdateOrderStatusSchema,
} from "../schemas";

describe("Runtime Input Validation & Standardized Error Envelopes (BE-16 / SF-10 / SF-11)", () => {
  describe("CreateOrderRequestSchema", () => {
    const validOrder = {
      customerName: "Ramesh Kumar",
      customerEmail: "ramesh@example.com",
      customerPhone: "9842406588",
      shippingAddress: "123 Anna Salai, Trichy",
      paymentMethod: "Proforma Invoice / Trade PO",
      items: [
        {
          productId: "prod_fs1",
          sku: "FS-01",
          name: "Floor Spring Standard",
          category: "Hardware",
          quantity: 2,
          packMultiplier: 1,
          unitPriceInr: 3500,
        },
      ],
    };

    it("accepts a completely valid order creation request", () => {
      const result = parseRequestBody(CreateOrderRequestSchema, validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe("Ramesh Kumar");
        expect(result.data.items[0].quantity).toBe(2);
      }
    });

    it("rejects an order with empty or missing customerName", () => {
      const invalid = { ...validOrder, customerName: "" };
      const result = parseRequestBody(CreateOrderRequestSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
        expect(result.envelope.message).toContain("customerName is required");
      }
    });

    it("rejects an order with an invalid email address", () => {
      const invalid = { ...validOrder, customerEmail: "not-an-email" };
      const result = parseRequestBody(CreateOrderRequestSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
        expect(result.envelope.message).toContain("customerEmail");
      }
    });

    it("rejects an order with negative or zero item quantities", () => {
      const invalid = {
        ...validOrder,
        items: [{ ...validOrder.items[0], quantity: -5 }],
      };
      const result = parseRequestBody(CreateOrderRequestSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
        expect(result.envelope.message).toContain("quantity must be >= 1");
      }
    });

    it("rejects an order with zero item quantity", () => {
      const invalid = {
        ...validOrder,
        items: [{ ...validOrder.items[0], quantity: 0 }],
      };
      const result = parseRequestBody(CreateOrderRequestSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
        expect(result.envelope.message).toContain("quantity must be >= 1");
      }
    });

    it("rejects an order with empty items array", () => {
      const invalid = { ...validOrder, items: [] };
      const result = parseRequestBody(CreateOrderRequestSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
        expect(result.envelope.message).toContain("At least one order item is required");
      }
    });
  });

  describe("UpdateCustomerProfileSchema", () => {
    it("accepts valid status and role mutations", () => {
      const valid = { status: "ACTIVE", role: "DEALER" };
      const result = parseRequestBody(UpdateCustomerProfileSchema, valid);
      expect(result.success).toBe(true);
    });

    it("rejects unauthorized arbitrary role names", () => {
      const invalid = { role: "SUPER_ADMIN_BYPASS" };
      const result = parseRequestBody(UpdateCustomerProfileSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects unauthorized arbitrary account statuses", () => {
      const invalid = { status: "UNAPPROVED_OVERRIDE" };
      const result = parseRequestBody(UpdateCustomerProfileSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("UpdateOrderStatusSchema", () => {
    it("accepts valid canonical order statuses", () => {
      const valid = { status: "CONFIRMED", paymentStatus: "PAID" };
      const result = parseRequestBody(UpdateOrderStatusSchema, valid);
      expect(result.success).toBe(true);
    });

    it("rejects unrecognized order status values", () => {
      const invalid = { status: "UNKNOWN_CUSTOM_STATUS" };
      const result = parseRequestBody(UpdateOrderStatusSchema, invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.envelope.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
