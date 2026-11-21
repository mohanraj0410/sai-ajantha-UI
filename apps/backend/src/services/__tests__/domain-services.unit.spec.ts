import {
  SellerRoutingService,
  PricingService,
  CatalogReadService,
  MediaService,
} from "../index";

describe("Work Unit P4.4 & P4.5: Domain Services & Media Security", () => {
  describe("1. SellerRoutingService", () => {
    it("authoritatively routes the 9 direct Sai Ajantha categories", () => {
      const directCategories = [
        "Finished insect screens",
        "Aluminium sections",
        "Hardware",
        "Ladders",
        "Rubber and PVC beading",
        "FGM fittings and channels",
        "Clips",
        "Frames and channels",
        "Mesh",
      ];

      for (const cat of directCategories) {
        expect(SellerRoutingService.getRouteForCategory(cat)).toBe("SAI_AJANTHA_DIRECT");
      }
    });

    it("routes House of Ajantha categories to DISTRIBUTOR_RESALE", () => {
      expect(SellerRoutingService.getRouteForCategory("Door closers")).toBe("DISTRIBUTOR_RESALE");
      expect(SellerRoutingService.getRouteForCategory("Kitchen baskets")).toBe("DISTRIBUTOR_RESALE");
    });

    it("routes Floor springs to ENQUIRY_ONLY per DEC-003 fail-closed policy", () => {
      expect(SellerRoutingService.getRouteForCategory("Floor springs")).toBe("ENQUIRY_ONLY");
    });

    it("evaluates cart checkout as fail-closed when distributor resale or enquiry items are present", () => {
      // 1. Pure direct cart can proceed to payment
      const directCart = [{ category: "Hardware", quantity: 2 }];
      const res1 = SellerRoutingService.evaluateCartCheckout(directCart);
      expect(res1.canProceedToPayment).toBe(true);
      expect(res1.isPureDirect).toBe(true);

      // 2. Cart with distributor resale cannot proceed when flag is false
      const distributorCart = [{ category: "Door closers", quantity: 1 }];
      const res2 = SellerRoutingService.evaluateCartCheckout(distributorCart, {
        distributorOnlineCheckoutEnabled: false,
        floorSpringsRouteConfirmed: false,
        distributorPaymentCaptureEnabled: false,
        distributorRefundsEnabled: false,
        liveRazorpayEnabled: false,
      });
      expect(res2.canProceedToPayment).toBe(false);
      expect(res2.hasDistributorResale).toBe(true);
      expect(res2.rejectionReason).toContain("Distributor resale online checkout is currently disabled");

      // 3. Cart with Floor springs cannot proceed (Quote-First)
      const enquiryCart = [{ category: "Floor springs", quantity: 1 }];
      const res3 = SellerRoutingService.evaluateCartCheckout(enquiryCart);
      expect(res3.canProceedToPayment).toBe(false);
      expect(res3.hasEnquiryOnly).toBe(true);
    });
  });

  describe("2. PricingService", () => {
    it("computes integer paise arithmetic and GST 18%", () => {
      // Rs 1,000 base price, 2 units -> Rs 2,000 subtotal (200,000 paise) + Rs 360 GST (36,000 paise) = Rs 2,360 total (236,000 paise)
      const res = PricingService.calculateLinePrice(1000, "CUSTOMER", 2, 18);
      expect(res.unitPricePaise).toBe(100000);
      expect(res.subtotalPaise).toBe(200000);
      expect(res.gstAmountPaise).toBe(36000);
      expect(res.totalPaise).toBe(236000);
      expect(res.totalInr).toBe(2360);
    });

    it("authoritatively applies dealer and distributor tier discounts", () => {
      // Rs 1,000 base: Dealer gets 15% discount = Rs 850 (85,000 paise)
      const dealerRes = PricingService.calculateLinePrice(1000, "DEALER", 1, 18);
      expect(dealerRes.unitPricePaise).toBe(85000);

      // Rs 1,000 base: Distributor gets 25% discount = Rs 750 (75,000 paise)
      const distRes = PricingService.calculateLinePrice(1000, "DISTRIBUTOR", 1, 18);
      expect(distRes.unitPricePaise).toBe(75000);
    });
  });

  describe("3. CatalogReadService", () => {
    it("projects public B2C catalog without leaking confidential wholesale prices", () => {
      const rawProducts = [
        {
          id: "prod_1",
          name: "Standard Section",
          category: "Aluminium sections",
          publicPriceInr: 500,
          dealerPriceInr: 425,
          distributorPriceInr: 375,
          baseLandingCost: 300,
        },
      ];

      const projected = CatalogReadService.projectPublicCatalog(rawProducts);
      expect(projected.length).toBe(1);
      expect(projected[0].publicPriceInr).toBe(500);
      expect(projected[0].publicPricePaise).toBe(50000);

      // Verify confidential fields are NOT on public projection
      const pub = projected[0] as any;
      expect(pub.dealerPriceInr).toBeUndefined();
      expect(pub.dealerPricePaise).toBeUndefined();
      expect(pub.distributorPriceInr).toBeUndefined();
      expect(pub.baseLandingCost).toBeUndefined();
    });

    it("forces null prices for quote-only products", () => {
      const rawProducts = [
        {
          id: "prod_floor_1",
          name: "Floor Spring 90kg",
          category: "Floor springs",
          price: 4500,
          isQuoteOnly: true,
        },
      ];

      const projected = CatalogReadService.projectPublicCatalog(rawProducts);
      expect(projected[0].isQuoteOnly).toBe(true);
      expect(projected[0].publicPriceInr).toBeNull();
      expect(projected[0].publicPricePaise).toBeNull();
    });
  });

  describe("4. MediaService Security", () => {
    it("rejects path traversal attempts with 403 Forbidden", () => {
      const res1 = MediaService.resolvePublicAsset("/static/../../../etc/passwd");
      expect(res1.allowed).toBe(false);
      expect(res1.statusCode).toBe(403);

      const res2 = MediaService.resolvePublicAsset("/static/%2e%2e%2f%2e%2e%2fconfig.json");
      expect(res2.allowed).toBe(false);
      expect(res2.statusCode).toBe(403);
    });

    it("rejects null byte injection with 400 Bad Request", () => {
      const res = MediaService.resolvePublicAsset("/static/image.png\0.exe");
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(400);
    });

    it("rejects dotfiles and hidden files with 403 Forbidden", () => {
      const res = MediaService.resolvePublicAsset("/static/.env");
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it("prohibits access to private documents root from public static resolver", () => {
      const res = MediaService.resolvePublicAsset("/static/private/customer-invoice-123.pdf");
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it("rejects non-allowlisted file extensions (.exe, .sh, .ts, .json)", () => {
      const res1 = MediaService.resolvePublicAsset("/static/script.sh");
      expect(res1.allowed).toBe(false);
      expect(res1.statusCode).toBe(403);

      const res2 = MediaService.resolvePublicAsset("/static/catalog-manifest.json");
      expect(res2.allowed).toBe(false);
      expect(res2.statusCode).toBe(403);
    });
  });
});
