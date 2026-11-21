import { Pool, PoolClient } from "pg";
import {
  CanonicalSellerResolutionDto,
  CanonicalSellerRoute,
  AllowedNextAction,
  DEFAULT_COMMERCIAL_FEATURE_FLAGS,
  CommercialFeatureFlags,
} from "@sai-ajanta/types";
import { assertDisposableDbConnection } from "../lib/disposable-db-guard";

export interface ResolveSellerInput {
  sku: string;
  postalCode?: string;
  actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
  actorId?: string;
  flags?: CommercialFeatureFlags;
}

function normalizeCategorySlug(categoryName: string): string {
  const norm = (categoryName || "").toLowerCase().trim();
  if (norm.includes("door closer") || norm.includes("floor spring")) return "door-closer-floor-spring";
  if (norm.includes("kitchen basket")) return "kitchen-basket";
  if (norm.includes("pvc concealed")) return "pvc-concealed-brackets";
  if (norm.includes("screw")) return "ss-screws";
  if (norm.includes("tape")) return "adhesive-tapes";
  if (norm.includes("sliding door lock") || norm.includes("lock")) return "sliding-door-locks";
  if (norm.includes("ladder")) return "ladder";
  if (norm.includes("rubber")) return "rubber-pvc";
  if (norm.includes("clip")) return "clip";
  if (norm.includes("fgm")) return "fgm-fittings";
  if (norm.includes("frame") || norm.includes("channel")) return "frames-channels";
  if (norm.includes("mesh") || norm.includes("screen")) return "mesh";
  return norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export class SellerResolutionService {
  /**
   * P8.1 & P8.2: Authoritative Server-Side Seller & Route Resolution.
   * Fail-Closed Precedence:
   * 1. Catalog Existence & Publish status
   * 2. Floor Springs Override (DEC-003) -> strictly ENQUIRY_ONLY
   * 3. Distributor Buy Stock (Rule C) -> Sai Ajantha Central (Wholesale Stock Supply)
   * 4. 9 Direct Categories (Rule A) -> SAI_AJANTHA_DIRECT (Central Warehouse)
   * 5. Distributor Categories (Closers, Baskets - Rule B):
   *    - For DEALER: verify dealer approved & retrieve linked distributor, check if serves PIN
   *    - For CUSTOMER: match active (PIN, Category) coverage, check suspended & overlap
   *    - Unserved PIN / Ambiguity -> ENQUIRY_ONLY manual queue (never select first row automatically)
   * 6. Availability & Role-Scoped Price computation (Masked, zero confidential leak)
   */
  static async resolveCanonicalSeller(
    poolOrClient: Pool | PoolClient,
    input: ResolveSellerInput
  ): Promise<CanonicalSellerResolutionDto> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);

      const skuUpper = (input.sku || "").trim().toUpperCase();
      if (!skuUpper) {
        const err: any = new Error("SKU is required for seller resolution.");
        err.code = "VALIDATION_FAILED";
        err.statusCode = 400;
        throw err;
      }

      // 1. Catalog lookup in dms_product_import_row
      const prodRes = await client.query(
        `SELECT id, sku, product_name, category, subcategory, customer_price_inr, dealer_price_inr, distributor_price_inr,
                stock_qty, gst_rate, route, is_quote_only, status
         FROM "dms_product_import_row"
         WHERE UPPER(sku) = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [skuUpper]
      );

      if (prodRes.rows.length === 0) {
        const err: any = new Error(`Product SKU '${skuUpper}' not found in authoritative catalog.`);
        err.code = "PRODUCT_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const prod = prodRes.rows[0];
      const categoryName = prod.category || "General Hardware";
      const categorySlug = normalizeCategorySlug(categoryName);
      const title = prod.product_name || skuUpper;

      // 2. Floor Springs Override (DEC-003 / Rule D)
      const isFloorSpring =
        skuUpper.startsWith("SA-I-FS-") ||
        skuUpper.includes("-FS-") ||
        title.toLowerCase().includes("floor spring");

      if (isFloorSpring) {
        return {
          sku: skuUpper,
          variantId: undefined,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Enquiry Only)",
          warehouseId: "loc_central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          allowedNextAction: "REQUEST_QUOTE",
          serviceable: true,
          availableStock: null,
          inStock: false,
          unitPricePaise: null,
          taxRatePercent: null,
          reason: "Hydraulic Floor Springs route unconfirmed per DEC-003: strictly enquiry-only",
          timestamp: new Date().toISOString(),
        };
      }

      // Check whether category is distributor resale
      const isDistributorCategory =
        categorySlug === "kitchen-basket" || categorySlug === "door-closer-floor-spring";

      // 3. Distributor Stock Purchase (Rule C)
      // When an approved distributor buys Door Closers or Kitchen Basket stock from Sai Ajantha:
      // Seller = Sai Ajantha. Buyer = Approved distributor. Fulfil from central inventory.
      if (isDistributorCategory && input.actorRole === "DISTRIBUTOR") {
        const distPriceInr = prod.distributor_price_inr;
        const effectivePricePaise = distPriceInr !== null && !isNaN(Number(distPriceInr))
          ? Math.round(Number(distPriceInr) * 100)
          : null;
        const gstRate = prod.gst_rate !== null && !isNaN(Number(prod.gst_rate))
          ? Number(prod.gst_rate)
          : null;
        const stockQty = prod.stock_qty !== null && !isNaN(Number(prod.stock_qty))
          ? Number(prod.stock_qty)
          : 0;
        const inStock = stockQty > 0;
        const isQuoteOnly = effectivePricePaise === null || effectivePricePaise <= 0 || gstRate === null;

        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "SAI_AJANTHA_DIRECT",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Wholesale Stock Supply)",
          warehouseId: "loc_central",
          isQuoteOnly,
          requiresEnquiry: isQuoteOnly,
          allowedNextAction: isQuoteOnly ? "REQUEST_QUOTE" : inStock ? "READY_FOR_TEST_CHECKOUT" : "OUT_OF_STOCK",
          serviceable: true,
          availableStock: stockQty,
          inStock,
          unitPricePaise: effectivePricePaise,
          taxRatePercent: gstRate,
          reason: isQuoteOnly
            ? "Wholesale purchase order requires quote verification"
            : "Distributor stock replenishment fulfilled by Sai Ajantha Central Warehouse",
          timestamp: new Date().toISOString(),
        };
      }

      // 4. 9 Direct Categories -> SAI_AJANTHA_DIRECT (Central Warehouse - Rule A)
      if (!isDistributorCategory) {
        const publicPriceInr = prod.customer_price_inr;
        const publicMrp = publicPriceInr !== null && !isNaN(Number(publicPriceInr))
          ? Math.round(Number(publicPriceInr) * 100)
          : null;
        const gstRate = prod.gst_rate !== null && !isNaN(Number(prod.gst_rate))
          ? Number(prod.gst_rate)
          : null;
        const stockQty = prod.stock_qty !== null && !isNaN(Number(prod.stock_qty))
          ? Number(prod.stock_qty)
          : 0;
        const inStock = stockQty > 0;

        // If price is null or 0, or GST is null, or stock is 0 -> quote-only
        const isQuoteOnly = publicMrp === null || publicMrp <= 0 || gstRate === null || !inStock;
        const allowedNextAction: AllowedNextAction = isQuoteOnly
          ? (inStock ? "REQUEST_QUOTE" : "OUT_OF_STOCK")
          : "READY_FOR_TEST_CHECKOUT";

        // Role-based price computation
        let effectivePricePaise = publicMrp;
        if (input.actorRole === "DEALER" && prod.dealer_price_inr !== null) {
          effectivePricePaise = Math.round(Number(prod.dealer_price_inr) * 100);
        } else if (input.actorRole === "DISTRIBUTOR" && prod.distributor_price_inr !== null) {
          effectivePricePaise = Math.round(Number(prod.distributor_price_inr) * 100);
        }

        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "SAI_AJANTHA_DIRECT",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central Warehouse",
          warehouseId: "loc_central",
          isQuoteOnly,
          requiresEnquiry: isQuoteOnly,
          allowedNextAction,
          serviceable: true,
          availableStock: stockQty,
          inStock,
          unitPricePaise: effectivePricePaise,
          taxRatePercent: gstRate,
          reason: isQuoteOnly
            ? (!inStock ? "Stock unavailable at central warehouse. Request a quotation." : "Product pricing or GST rate requires quotation verification")
            : "Direct fulfillment from Sai Ajantha Central Warehouse",
          timestamp: new Date().toISOString(),
        };
      }

      // 5. Distributor Resale Categories (Door Closers & Kitchen Baskets - Rule B)
      const pin = input.postalCode ? input.postalCode.trim() : "";
      if (!pin || !/^\d{6}$/.test(pin)) {
        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "DISTRIBUTOR_RESALE",
          sellerId: "DISTRIBUTOR_PENDING_PIN",
          sellerName: "Authorized Regional Distributor (PIN Required)",
          warehouseId: "loc_dist_pending",
          isQuoteOnly: true,
          requiresEnquiry: false,
          allowedNextAction: "REQUEST_QUOTE",
          serviceable: false,
          availableStock: null,
          inStock: false,
          unitPricePaise: prod.customer_price_inr !== null ? Math.round(Number(prod.customer_price_inr) * 100) : null,
          taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
          reason: "Postal PIN code required to route to your authorized territory distributor",
          timestamp: new Date().toISOString(),
        };
      }

      // 5A. DEALER SPECIFIC ROUTING (Rule B & TC-PIN-004, TC-PIN-005)
      if (input.actorRole === "DEALER") {
        let dealerProfile: any = null;
        if (input.actorId) {
          const dRes = await client.query(
            `SELECT id, customer_id, business_name, role, status, parent_distributor_id
             FROM "account_profile"
             WHERE (customer_id = $1 OR id = $1) AND deleted_at IS NULL
             LIMIT 1`,
            [input.actorId]
          );
          if (dRes.rows.length > 0) {
            dealerProfile = dRes.rows[0];
          }
        }

        // If dealer is active and has linked distributor
        if (dealerProfile && (dealerProfile.status || "").toUpperCase() === "ACTIVE") {
          const parentDistId = dealerProfile.parent_distributor_id;
          if (!parentDistId) {
            // Dealer has no linked distributor -> fallback to manual enquiry
            return {
              sku: skuUpper,
              title,
              categorySlug,
              categoryName,
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              warehouseId: "loc_central",
              isQuoteOnly: true,
              requiresEnquiry: true,
              allowedNextAction: "REQUEST_QUOTE",
              serviceable: false,
              availableStock: 0,
              inStock: false,
              unitPricePaise: prod.dealer_price_inr !== null ? Math.round(Number(prod.dealer_price_inr) * 100) : null,
              taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
              reason: "Approved dealer has no authorized linked distributor assigned. Routed to Admin enquiry queue.",
              timestamp: new Date().toISOString(),
            };
          }

          // Verify linked distributor exists and is ACTIVE
          const parentDistRes = await client.query(
            `SELECT id, customer_id, business_name, role, status, stock_location_id
             FROM "account_profile"
             WHERE (customer_id = $1 OR id = $1) AND role = 'DISTRIBUTOR' AND deleted_at IS NULL
             LIMIT 1`,
            [parentDistId]
          );

          if (parentDistRes.rows.length === 0 || (parentDistRes.rows[0].status || "").toUpperCase() !== "ACTIVE") {
            const distName = parentDistRes.rows[0]?.business_name || parentDistId;
            return {
              sku: skuUpper,
              title,
              categorySlug,
              categoryName,
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              warehouseId: "loc_central",
              isQuoteOnly: true,
              requiresEnquiry: true,
              allowedNextAction: "REQUEST_QUOTE",
              serviceable: false,
              availableStock: 0,
              inStock: false,
              unitPricePaise: prod.dealer_price_inr !== null ? Math.round(Number(prod.dealer_price_inr) * 100) : null,
              taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
              reason: `Dealer's linked distributor '${distName}' is suspended or inactive. Cannot receive new orders. Routed to manual enquiry queue.`,
              timestamp: new Date().toISOString(),
            };
          }

          const linkedDist = parentDistRes.rows[0];

          // Check if linked distributor serves the delivery PIN and category
          const isDoorCloserProd = categorySlug.includes("closer");
          const isKitchenBasketProd = categorySlug.includes("basket");
          const linkCovRes = await client.query(
            `SELECT c.id, c.distributor_id, c.postal_code, c.category_slug, c.status
             FROM "dms_distributor_coverage" c
             WHERE (c.distributor_id = $1 OR c.distributor_id = $2)
               AND c.postal_code = $3
               AND (
                 c.category_slug = $4
                 OR c.category_slug = 'all'
                 OR ($5 = true AND (c.category_slug = 'door-closer-floor-spring' OR c.category_slug = 'door-closers'))
                 OR ($6 = true AND (c.category_slug = 'kitchen-basket' OR c.category_slug = 'kitchen-baskets'))
               )
               AND c.status = 'ACTIVE'
               AND c.deleted_at IS NULL
             LIMIT 1`,
            [linkedDist.customer_id, linkedDist.id, pin, categorySlug, isDoorCloserProd, isKitchenBasketProd]
          );

          if (linkCovRes.rows.length === 0) {
            // TC-PIN-005: Dealer linked distributor does not serve the PIN -> enquiry fallback
            return {
              sku: skuUpper,
              title,
              categorySlug,
              categoryName,
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              warehouseId: "loc_central",
              isQuoteOnly: true,
              requiresEnquiry: true,
              allowedNextAction: "REQUEST_QUOTE",
              serviceable: false,
              availableStock: 0,
              inStock: false,
              unitPricePaise: prod.dealer_price_inr !== null ? Math.round(Number(prod.dealer_price_inr) * 100) : null,
              taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
              reason: `Dealer linked distributor '${linkedDist.business_name}' does not serve delivery PIN ${pin} for ${categoryName}. Fallback to manual enquiry queue.`,
              timestamp: new Date().toISOString(),
            };
          }

          // TC-PIN-004: Linked distributor serves the PIN -> Resolved!
          // Check stock
          const invRes = await client.query(
            `SELECT stocked_qty, reserved_qty, in_transit_qty
             FROM "dms_distributor_inventory"
             WHERE (distributor_id = $1 OR distributor_id = $2) AND UPPER(sku) = $3 AND deleted_at IS NULL
             LIMIT 1`,
            [linkedDist.customer_id, linkedDist.id, skuUpper]
          );
          const stocked = invRes.rows.length > 0 ? Number(invRes.rows[0].stocked_qty) : 0;
          const reserved = invRes.rows.length > 0 ? Number(invRes.rows[0].reserved_qty) : 0;
          const availableStock = Math.max(0, stocked - reserved);
          const inStock = availableStock > 0;
          const unitPricePaise = prod.dealer_price_inr !== null ? Math.round(Number(prod.dealer_price_inr) * 100) : null;

          return {
            sku: skuUpper,
            title,
            categorySlug,
            categoryName,
            resolvedRoute: "DISTRIBUTOR_RESALE",
            sellerId: linkedDist.customer_id || linkedDist.id,
            sellerName: linkedDist.business_name || "Authorized Regional Distributor",
            warehouseId: linkedDist.stock_location_id || `loc_dist_${(linkedDist.customer_id || linkedDist.id).slice(-6)}`,
            isQuoteOnly: true, // Online checkout disabled per DEC-002
            requiresEnquiry: false,
            allowedNextAction: inStock ? "REQUEST_QUOTE" : "REQUEST_QUOTE",
            serviceable: true,
            availableStock,
            inStock,
            unitPricePaise,
            taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
            reason: `Routed to dealer's authorized linked distributor '${linkedDist.business_name}' covering PIN ${pin}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // 5B. CUSTOMER & GENERAL DISTRIBUTOR ROUTING (Rule B & TC-PIN-002, TC-PIN-003, TC-PIN-006, TC-PIN-007, TC-PIN-008)
      // Query all active distributor coverages for PIN & category
      const isDoorCloserCategory = categorySlug.includes("closer");
      const isKitchenBasketCategory = categorySlug.includes("basket");
      const covRes = await client.query(
        `SELECT c.id as coverage_id, c.distributor_id, c.postal_code, c.category_slug,
                p.business_name, p.status as profile_status, p.stock_location_id
         FROM "dms_distributor_coverage" c
         JOIN "account_profile" p ON (p.customer_id = c.distributor_id OR p.id = c.distributor_id)
         WHERE c.postal_code = $1 
           AND (
             c.category_slug = $2
             OR c.category_slug = 'all'
             OR ($3 = true AND (c.category_slug = 'door-closer-floor-spring' OR c.category_slug = 'door-closers'))
             OR ($4 = true AND (c.category_slug = 'kitchen-basket' OR c.category_slug = 'kitchen-baskets'))
           )
           AND c.status = 'ACTIVE' 
           AND c.deleted_at IS NULL`,
        [pin, categorySlug, isDoorCloserCategory, isKitchenBasketCategory]
      );

      // TC-PIN-006: Unserved PIN -> Route to manual enquiry queue with no invented seller
      if (covRes.rows.length === 0) {
        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Manual Enquiry)",
          warehouseId: "loc_central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          allowedNextAction: "REQUEST_QUOTE",
          serviceable: false,
          availableStock: 0,
          inStock: false,
          unitPricePaise: prod.customer_price_inr !== null ? Math.round(Number(prod.customer_price_inr) * 100) : null,
          taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
          reason: `Unserved territory postal code (${pin}). No authorized distributor found. Routed to manual enquiry queue.`,
          timestamp: new Date().toISOString(),
        };
      }

      // Group active candidates by unique distributor
      const uniqueDistributors = new Map<string, any>();
      for (const r of covRes.rows) {
        if ((r.profile_status || "").toUpperCase() === "ACTIVE") {
          if (!uniqueDistributors.has(r.distributor_id)) {
            uniqueDistributors.set(r.distributor_id, r);
          }
        }
      }

      // TC-PIN-007: Check for suspended distributor accounts
      if (uniqueDistributors.size === 0) {
        const distName = covRes.rows[0]?.business_name || covRes.rows[0]?.distributor_id;
        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Manual Enquiry)",
          warehouseId: "loc_central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          allowedNextAction: "REQUEST_QUOTE",
          serviceable: false,
          availableStock: 0,
          inStock: false,
          unitPricePaise: prod.customer_price_inr !== null ? Math.round(Number(prod.customer_price_inr) * 100) : null,
          taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
          reason: `Assigned distributor '${distName}' covering PIN ${pin} is suspended or inactive. Cannot receive new orders. Routed to manual enquiry queue.`,
          timestamp: new Date().toISOString(),
        };
      }

      // TC-PIN-008: Overlapping distinct distributors without approved priority rule -> Unresolved routing
      if (uniqueDistributors.size > 1) {
        return {
          sku: skuUpper,
          title,
          categorySlug,
          categoryName,
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Manual Enquiry)",
          warehouseId: "loc_central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          allowedNextAction: "REQUEST_QUOTE",
          serviceable: false,
          availableStock: 0,
          inStock: false,
          unitPricePaise: prod.customer_price_inr !== null ? Math.round(Number(prod.customer_price_inr) * 100) : null,
          taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
          reason: `Multiple active distributors overlap on PIN ${pin} without approved priority rule. Ambiguous route sent to Admin enquiry queue.`,
          timestamp: new Date().toISOString(),
        };
      }

      // Exactly 1 active distributor candidate (TC-PIN-002, TC-PIN-003)
      const dist = Array.from(uniqueDistributors.values())[0];

      // Query distributor's owned inventory (TC-PIN-011)
      const invRes = await client.query(
        `SELECT stocked_qty, reserved_qty, in_transit_qty
         FROM "dms_distributor_inventory"
         WHERE distributor_id = $1 AND UPPER(sku) = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [dist.distributor_id, skuUpper]
      );

      const stocked = invRes.rows.length > 0 ? Number(invRes.rows[0].stocked_qty) : 0;
      const reserved = invRes.rows.length > 0 ? Number(invRes.rows[0].reserved_qty) : 0;
      const availableStock = Math.max(0, stocked - reserved);
      const inStock = availableStock > 0;

      // Resale price calculation
      let unitPricePaise = prod.customer_price_inr !== null ? Math.round(Number(prod.customer_price_inr) * 100) : null;
      if (input.actorRole === "DEALER" && prod.dealer_price_inr !== null) {
        unitPricePaise = Math.round(Number(prod.dealer_price_inr) * 100);
      } else if (input.actorRole === "DISTRIBUTOR" && prod.distributor_price_inr !== null) {
        unitPricePaise = Math.round(Number(prod.distributor_price_inr) * 100);
      }

      // Per DEC-002: Distributor online checkout is strictly disabled -> REQUEST_QUOTE only
      return {
        sku: skuUpper,
        title,
        categorySlug,
        categoryName,
        resolvedRoute: "DISTRIBUTOR_RESALE",
        sellerId: dist.distributor_id,
        sellerName: dist.business_name || "Authorized Regional Distributor",
        warehouseId: dist.stock_location_id || `loc_dist_${dist.distributor_id.slice(-6)}`,
        isQuoteOnly: true, // Always quote-only while distributorOnlineCheckoutEnabled is false
        requiresEnquiry: false,
        allowedNextAction: inStock ? "REQUEST_QUOTE" : "REQUEST_QUOTE",
        serviceable: true,
        availableStock,
        inStock,
        unitPricePaise,
        taxRatePercent: prod.gst_rate !== null ? Number(prod.gst_rate) : null,
        reason: !inStock
          ? `Stock unavailable at regional distributor '${dist.business_name || dist.distributor_id}'. Quotation required.`
          : `Authorized regional distributor fulfillment via official quotation (online checkout disabled per DEC-002)`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }
}
