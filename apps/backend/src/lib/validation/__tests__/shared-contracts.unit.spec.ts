import {
  validateActorSessionDto,
  validatePublicCatalogItemDto,
  validateOrderLineItemDto,
  createStandardErrorEnvelope,
} from "@sai-ajanta/types";

describe("Work Unit P4.2: Runtime-Validated Shared Contracts (@sai-ajanta/types)", () => {
  describe("1. Actor / Session & RBAC Permissions Contract", () => {
    it("validates and parses a valid authenticated staff session", () => {
      const input = {
        id: "usr_staff_123",
        email: "admin@sai-ajanta.com",
        name: "Staff Admin",
        phone: "+91 98400 12345",
        organization: "Sai Ajantha Internal",
        role: "STAFF",
        approvalStatus: "APPROVED",
      };

      const result = validateActorSessionDto(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("usr_staff_123");
        expect(result.data.role).toBe("STAFF");
        expect(result.data.isApprovedTradeAccount).toBe(false);
        expect(result.data.effectivePriceTier).toBe("CUSTOMER");
      }
    });

    it("authoritatively assigns DEALER tier ONLY if role=DEALER and approvalStatus=APPROVED", () => {
      const approvedDealer = {
        id: "usr_dealer_456",
        email: "dealer@hardware.in",
        name: "Approved Hardware Dealer",
        role: "DEALER",
        approvalStatus: "APPROVED",
      };
      const res1 = validateActorSessionDto(approvedDealer);
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.data.isApprovedTradeAccount).toBe(true);
        expect(res1.data.effectivePriceTier).toBe("DEALER");
      }

      // Unapproved/pending dealer MUST fall back to CUSTOMER tier (no trade prices)
      const pendingDealer = {
        id: "usr_dealer_789",
        email: "pending@hardware.in",
        name: "Pending Hardware Dealer",
        role: "DEALER",
        approvalStatus: "PENDING_APPROVAL",
      };
      const res2 = validateActorSessionDto(pendingDealer);
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.data.isApprovedTradeAccount).toBe(false);
        expect(res2.data.effectivePriceTier).toBe("CUSTOMER");
      }
    });

    it("rejects invalid roles or malformed email", () => {
      const invalidInput = {
        id: "usr_bad",
        email: "not-an-email",
        name: "Bad User",
        role: "SUPER_ADMIN", // Prohibited invented role
        approvalStatus: "APPROVED",
      };

      const result = validateActorSessionDto(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.errors.map((e) => e.field);
        expect(fields).toContain("email");
        expect(fields).toContain("role");
      }
    });
  });

  describe("2. Catalogue & Allowlisted B2C vs Confidential Pricing Isolation", () => {
    it("validates a public B2C product payload with safe fields", () => {
      const validItem = {
        id: "prod_insect_screen_01",
        sku: "AJ-IS-001",
        name: "Sliding Insect Screen Mesh",
        category: "Finished insect screens",
        route: "SAI_AJANTHA_DIRECT",
        isQuoteOnly: false,
        publicPriceInr: 1250,
      };

      const res = validatePublicCatalogItemDto(validItem);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.publicPriceInr).toBe(1250);
        expect(res.data.publicPricePaise).toBe(125000);
        expect(res.data.isQuoteOnly).toBe(false);
      }
    });

    it("enforces null price for quote-only products", () => {
      const quoteItem = {
        id: "prod_floor_spring_01",
        name: "Heavy Duty Floor Spring",
        category: "Floor springs",
        route: "ENQUIRY_ONLY",
        isQuoteOnly: true,
        publicPriceInr: 5000, // Should be forced to null
      };

      const res = validatePublicCatalogItemDto(quoteItem);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.publicPriceInr).toBeNull();
        expect(res.data.publicPricePaise).toBeNull();
        expect(res.data.isQuoteOnly).toBe(true);
      }
    });

    it("CRITICAL (ADM-17 / SF-04): Strictly rejects payloads leaking confidential trade prices", () => {
      const leakedItem = {
        id: "prod_mesh_02",
        name: "SS 304 Mesh Roll",
        category: "Mesh",
        route: "SAI_AJANTHA_DIRECT",
        publicPriceInr: 3000,
        dealerPricePaise: 200000, // Confidential field leaked!
        baseLandingCost: 150000, // Confidential field leaked!
      };

      const res = validatePublicCatalogItemDto(leakedItem);
      expect(res.success).toBe(false);
      if (!res.success) {
        const fields = res.errors.map((e) => e.field);
        expect(fields).toContain("dealerPricePaise");
        expect(fields).toContain("baseLandingCost");
      }
    });
  });

  describe("3. Order Line Item & Mathematical Validation", () => {
    it("validates positive integer quantities and computes paise", () => {
      const item = {
        productId: "prod_pvc_01",
        sku: "AJ-PVC-01",
        name: "Weather Beading EPDM",
        category: "Rubber and PVC beading",
        quantity: 10,
        unitPricePaise: 2500, // Rs 25.00
      };

      const res = validateOrderLineItemDto(item);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.quantity).toBe(10);
        expect(res.data.unitPricePaise).toBe(2500);
        expect(res.data.lineTotalPaise).toBe(25000);
      }
    });

    it("strictly rejects negative, zero, fractional, or NaN quantities", () => {
      const negativeQty = { productId: "p1", name: "Item", quantity: -5 };
      expect(validateOrderLineItemDto(negativeQty).success).toBe(false);

      const zeroQty = { productId: "p1", name: "Item", quantity: 0 };
      expect(validateOrderLineItemDto(zeroQty).success).toBe(false);

      const floatQty = { productId: "p1", name: "Item", quantity: 2.5 };
      expect(validateOrderLineItemDto(floatQty).success).toBe(false);

      const nanQty = { productId: "p1", name: "Item", quantity: NaN };
      expect(validateOrderLineItemDto(nanQty).success).toBe(false);
    });
  });

  describe("4. Standard Error Envelope Sanitization", () => {
    it("creates standard error and sanitizes sensitive traces or credentials", () => {
      const rawDetails = {
        field: "sku",
        stack: "Error at DatabaseClient.connect (pg/lib/client.js:123)",
        password: "secret_db_pass",
        secret: "supersecretjwt",
        database_url: "postgres://user:pass@host/db",
        allowedInfo: "SKU not found in catalog",
      };

      const envelope = createStandardErrorEnvelope(
        "VALIDATION_ERROR",
        "Invalid input provided",
        400,
        "corr_test_123",
        rawDetails
      );

      expect(envelope.code).toBe("VALIDATION_ERROR");
      expect(envelope.httpStatus).toBe(400);
      expect(envelope.correlationId).toBe("corr_test_123");
      expect(envelope.details).toBeDefined();

      // Ensure sensitive keys were purged
      expect(envelope.details?.stack).toBeUndefined();
      expect(envelope.details?.password).toBeUndefined();
      expect(envelope.details?.secret).toBeUndefined();
      expect(envelope.details?.database_url).toBeUndefined();
      expect(envelope.details?.allowedInfo).toBe("SKU not found in catalog");
    });
  });
});
