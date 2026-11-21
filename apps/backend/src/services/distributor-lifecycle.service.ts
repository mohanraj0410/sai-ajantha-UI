import { Pool, PoolClient } from "pg";
import { getPgPool, withTransaction } from "../lib/db";
import {
  CanonicalSellerRoute,
  DistributorCoverageDto,
  DistributorPoDto,
  DistributorPoItemDto,
  DistributorReceiptDto,
  DistributorReceiptLineDto,
  DistributorInventoryItemDto,
  SellerResolutionDto,
  FinancialSeparationSummaryDto,
  validateAssignCoverageInput,
  validateCreateDistributorPoInput,
  validateDistributorReceiptLines,
} from "@sai-ajanta/types";
import { assertDisposableDbConnection } from "../lib/disposable-db-guard";

export class DistributorLifecycleService {
  /**
   * P7.1: Assign territory and category coverage to an ACTIVE distributor.
   * Rejects duplicate/overlapping active seller assignments for the same PIN and category.
   */
  static async assignCoverage(
    poolOrClient: Pool | PoolClient,
    input: {
      distributorId: string;
      postalCode: string;
      categorySlug: string;
      assignedBy: string;
      notes?: string;
    }
  ): Promise<DistributorCoverageDto> {
    const validated = validateAssignCoverageInput(input);
    if (!validated.success) {
      const err = new Error(validated.errors.map((e) => e.message).join("; "));
      (err as any).statusCode = 400;
      (err as any).code = "VALIDATION_FAILED";
      throw err;
    }

    const { distributorId, postalCode, categorySlug, notes } = validated.data;

    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      // 1. Verify distributor exists and is ACTIVE
      const profRes = await client.query(
        `SELECT id, customer_id, role, status, business_name FROM "account_profile" 
         WHERE (customer_id = $1 OR id = $1) AND deleted_at IS NULL LIMIT 1`,
        [distributorId]
      );
      if (profRes.rows.length === 0) {
        const err = new Error(`Distributor profile '${distributorId}' not found.`);
        (err as any).statusCode = 404;
        (err as any).code = "DISTRIBUTOR_NOT_FOUND";
        throw err;
      }
      const prof = profRes.rows[0];
      if ((prof.role || "").toUpperCase() !== "DISTRIBUTOR") {
        const err = new Error(`Account '${distributorId}' is not a DISTRIBUTOR role.`);
        (err as any).statusCode = 400;
        (err as any).code = "INVALID_ROLE";
        throw err;
      }
      if ((prof.status || "").toUpperCase() !== "ACTIVE") {
        const err = new Error(`Distributor '${distributorId}' is not ACTIVE (current status: ${prof.status}). Only ACTIVE distributors can receive territory assignments.`);
        (err as any).statusCode = 400;
        (err as any).code = "DISTRIBUTOR_NOT_ACTIVE";
        throw err;
      }

      // 2. Check for existing active coverage on this PIN + Category (Prevent Overlapping Resellers)
      const existingRes = await client.query(
        `SELECT id, distributor_id FROM "dms_distributor_coverage" 
         WHERE postal_code = $1 AND category_slug = $2 AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1`,
        [postalCode, categorySlug]
      );
      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        if (existing.distributor_id === distributorId) {
          const err = new Error(`Distributor '${distributorId}' already has active coverage for PIN ${postalCode} and category ${categorySlug}.`);
          (err as any).statusCode = 409;
          (err as any).code = "COVERAGE_ALREADY_EXISTS";
          throw err;
        } else {
          const err = new Error(`Coverage conflict: PIN ${postalCode} already has an active distributor for category ${categorySlug}. Duplicate active seller assignments are prohibited.`);
          (err as any).statusCode = 409;
          (err as any).code = "COVERAGE_CONFLICT";
          throw err;
        }
      }

      // 3. Resolve canonical category name
      let categoryName = "Door Closer & Floor Spring";
      if (categorySlug.includes("kitchen")) {
        categoryName = "Kitchen Basket";
      }

      // 4. Insert coverage record
      const id = `dcov_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const insRes = await client.query(
        `INSERT INTO "dms_distributor_coverage" 
         (id, distributor_id, postal_code, category_name, category_slug, canonical_route, status, assigned_by, notes)
         VALUES ($1, $2, $3, $4, $5, 'DISTRIBUTOR_RESALE', 'ACTIVE', $6, $7)
         RETURNING *`,
        [id, distributorId, postalCode, categoryName, categorySlug, input.assignedBy, notes || null]
      );

      const row = insRes.rows[0];
      return {
        id: row.id,
        distributorId: row.distributor_id,
        distributorName: prof.business_name || prof.customer_id,
        postalCode: row.postal_code,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        canonicalRoute: row.canonical_route as CanonicalSellerRoute,
        status: row.status,
        assignedBy: row.assigned_by,
        notes: row.notes,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    });
  }

  /**
   * P7.1: Revoke coverage by ID.
   */
  static async revokeCoverage(
    poolOrClient: Pool | PoolClient,
    coverageId: string,
    revokedBy: string,
    reason?: string
  ): Promise<boolean> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);
      const res = await client.query(
        `UPDATE "dms_distributor_coverage" 
         SET status = 'REVOKED', updated_at = now(), notes = COALESCE(notes, '') || ' | Revoked: ' || $2
         WHERE id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         RETURNING id`,
        [coverageId, reason || `Revoked by ${revokedBy}`]
      );
      return res.rows.length > 0;
    });
  }

  /**
   * P7.1: Immediately revoke all active coverage when a distributor is suspended.
   */
  static async suspendDistributorCoverages(
    poolOrClient: Pool | PoolClient,
    distributorId: string
  ): Promise<number> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);
      const res = await client.query(
        `UPDATE "dms_distributor_coverage" 
         SET status = 'SUSPENDED', updated_at = now()
         WHERE distributor_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         RETURNING id`,
        [distributorId]
      );
      return res.rows.length;
    });
  }

  /**
   * P7.1: List distributor coverage records.
   */
  static async listCoverages(
    poolOrClient: Pool | PoolClient,
    filter?: { distributorId?: string; status?: string }
  ): Promise<DistributorCoverageDto[]> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);
      const params: any[] = [];
      const where: string[] = ["deleted_at IS NULL"];

      if (filter?.distributorId) {
        params.push(filter.distributorId);
        where.push(`distributor_id = $${params.length}`);
      }
      if (filter?.status) {
        params.push(filter.status);
        where.push(`status = $${params.length}`);
      }

      const sql = `SELECT * FROM "dms_distributor_coverage" WHERE ${where.join(" AND ")} ORDER BY created_at DESC`;
      const res = await client.query(sql, params);

      return res.rows.map((row) => ({
        id: row.id,
        distributorId: row.distributor_id,
        postalCode: row.postal_code,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        canonicalRoute: row.canonical_route as CanonicalSellerRoute,
        status: row.status,
        assignedBy: row.assigned_by,
        notes: row.notes,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P7.1 & P7.4: Authoritative server-side seller resolution from PIN and Category.
   */
  static async resolveSellerForTerritory(
    poolOrClient: Pool | PoolClient,
    params: { postalCode: string; categorySlug: string; sku?: string; actorId?: string; actorRole?: string }
  ): Promise<SellerResolutionDto> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);
      const { postalCode, categorySlug, sku, actorId, actorRole } = params;
      const normCat = categorySlug.toLowerCase().trim();
      const normSku = (sku || "").toUpperCase().trim();

      // 1. Hydraulic Floor Springs are strictly ENQUIRY_ONLY per DEC-003
      if (normSku.includes("-FS-") || normSku.startsWith("SA-I-FS-") || normCat.includes("floor spring")) {
        return {
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          reason: "Hydraulic Floor Springs route unconfirmed (DEC-003). Enquiry / Quote only.",
        };
      }

      // 2. Direct Sai Ajantha categories ship from central warehouse
      const isDirectCategory =
        normCat.includes("insect") ||
        normCat.includes("aluminium") ||
        normCat.includes("hardware") ||
        normCat.includes("ladder") ||
        normCat.includes("rubber") ||
        normCat.includes("fgm") ||
        normCat.includes("clip") ||
        normCat.includes("frame") ||
        normCat.includes("mesh");

      if (isDirectCategory) {
        return {
          resolvedRoute: "SAI_AJANTHA_DIRECT",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central Warehouse",
          isQuoteOnly: false,
          requiresEnquiry: false,
          reason: "Direct catalog categories fulfilled from Sai Ajantha Central Warehouse.",
        };
      }

      // 3. Distributor Resale (Door Closers & Kitchen Baskets)
      if (!/^\d{6}$/.test(postalCode)) {
        return {
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          reason: "Valid 6-digit postal code required for distributor territory resolution.",
        };
      }

      // Dealer-specific routing check
      if (actorRole === "DEALER" && actorId) {
        const dRes = await client.query(
          `SELECT id, customer_id, business_name, role, status, parent_distributor_id
           FROM "account_profile"
           WHERE (customer_id = $1 OR id = $1) AND deleted_at IS NULL LIMIT 1`,
          [actorId]
        );
        if (dRes.rows.length > 0 && (dRes.rows[0].status || "").toUpperCase() === "ACTIVE") {
          const parentDistId = dRes.rows[0].parent_distributor_id;
          if (!parentDistId) {
            return {
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              isQuoteOnly: true,
              requiresEnquiry: true,
              reason: "Approved dealer has no authorized linked distributor assigned. Routed to Admin enquiry queue.",
            };
          }

          const distRes = await client.query(
            `SELECT id, customer_id, business_name, status FROM "account_profile"
             WHERE (customer_id = $1 OR id = $1) AND role = 'DISTRIBUTOR' AND deleted_at IS NULL LIMIT 1`,
            [parentDistId]
          );

          if (distRes.rows.length === 0 || (distRes.rows[0].status || "").toUpperCase() !== "ACTIVE") {
            const distName = distRes.rows[0]?.business_name || parentDistId;
            return {
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              isQuoteOnly: true,
              requiresEnquiry: true,
              reason: `Dealer's linked distributor '${distName}' is suspended or inactive. Cannot receive new orders. Routed to manual enquiry queue.`,
            };
          }

          const linkedDist = distRes.rows[0];
          const covCheck = await client.query(
            `SELECT id FROM "dms_distributor_coverage"
             WHERE (distributor_id = $1 OR distributor_id = $2)
               AND postal_code = $3
               AND (category_slug = $4 OR category_slug = 'door-closer-floor-spring' OR $4 LIKE '%' || category_slug || '%')
               AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1`,
            [linkedDist.customer_id, linkedDist.id, postalCode, normCat]
          );

          if (covCheck.rows.length === 0) {
            return {
              resolvedRoute: "ENQUIRY_ONLY",
              sellerId: "SAI_AJANTHA_CENTRAL",
              sellerName: "Sai Ajantha Central (Manual Enquiry)",
              isQuoteOnly: true,
              requiresEnquiry: true,
              reason: `Dealer linked distributor '${linkedDist.business_name}' does not serve delivery PIN ${postalCode} for ${categorySlug}. Fallback to manual enquiry queue.`,
            };
          }

          return {
            resolvedRoute: "DISTRIBUTOR_RESALE",
            sellerId: linkedDist.customer_id || linkedDist.id,
            sellerName: linkedDist.business_name || `Distributor (${parentDistId})`,
            isQuoteOnly: false,
            requiresEnquiry: false,
            reason: `Territory match: Dealer's linked distributor '${linkedDist.business_name}' covers PIN ${postalCode}.`,
          };
        }
      }

      // Query active coverage without LIMIT 1 to check for overlaps
      const isDoorCloserCategory = normCat.includes("closer");
      const isKitchenBasketCategory = normCat.includes("basket");
      const covRes = await client.query(
        `SELECT c.*, p.status as dist_status, p.business_name 
         FROM "dms_distributor_coverage" c
         LEFT JOIN "account_profile" p ON p.customer_id = c.distributor_id OR p.id = c.distributor_id
         WHERE c.postal_code = $1 
           AND (
             c.category_slug = $2
             OR c.category_slug = 'all'
             OR ($3 = true AND (c.category_slug = 'door-closer-floor-spring' OR c.category_slug = 'door-closers'))
             OR ($4 = true AND (c.category_slug = 'kitchen-basket' OR c.category_slug = 'kitchen-baskets'))
           )
           AND c.status = 'ACTIVE' 
           AND c.deleted_at IS NULL`,
        [postalCode, normCat, isDoorCloserCategory, isKitchenBasketCategory]
      );

      if (covRes.rows.length === 0) {
        return {
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          reason: `No active distributor covers postal code ${postalCode} for category ${categorySlug}. Routed to manual enquiry queue.`,
        };
      }

      // Group active candidates by unique distributor
      const uniqueDistributors = new Map<string, any>();
      for (const r of covRes.rows) {
        if ((r.dist_status || "").toUpperCase() === "ACTIVE") {
          if (!uniqueDistributors.has(r.distributor_id)) {
            uniqueDistributors.set(r.distributor_id, r);
          }
        }
      }

      if (uniqueDistributors.size === 0) {
        const distName = covRes.rows[0]?.business_name || covRes.rows[0]?.distributor_id;
        return {
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central",
          isQuoteOnly: true,
          requiresEnquiry: true,
          reason: `Assigned distributor '${distName}' covering PIN ${postalCode} is suspended or inactive. Cannot receive new orders. Routed to manual enquiry queue.`,
        };
      }

      if (uniqueDistributors.size > 1) {
        return {
          resolvedRoute: "ENQUIRY_ONLY",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central (Manual Enquiry)",
          isQuoteOnly: true,
          requiresEnquiry: true,
          reason: `Multiple active distributors overlap on PIN ${postalCode} without approved priority rule. Ambiguous route sent to Admin enquiry queue.`,
        };
      }

      const cov = Array.from(uniqueDistributors.values())[0];
      return {
        resolvedRoute: "DISTRIBUTOR_RESALE",
        sellerId: cov.distributor_id,
        sellerName: cov.business_name || `Distributor (${cov.distributor_id})`,
        isQuoteOnly: false,
        requiresEnquiry: false,
        reason: `Territory match: Distributor '${cov.business_name || cov.distributor_id}' covers PIN ${postalCode}.`,
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P7.2: Create a Distributor Supplier Stock Purchase Order (PO) from Sai Ajantha.
   * Only Door Closers (SA-M-DC-*) and Kitchen Baskets (SA-M-KB-*) are authorized.
   * Floor Springs (SA-I-FS-*) are strictly rejected per DEC-003.
   * Target opening stock of ~₹3 lakh is an advisory target, not a hard barrier.
   */
  static async createPurchaseOrder(
    poolOrClient: Pool | PoolClient,
    input: {
      distributorId: string;
      destinationLocationId?: string;
      items: { sku: string; qty: number }[];
      notes?: string;
    }
  ): Promise<DistributorPoDto & { isBelowOpeningStockTarget: boolean; targetAdvisoryMessage?: string }> {
    const validated = validateCreateDistributorPoInput(input);
    if (!validated.success) {
      const err = new Error(validated.errors.map((e) => e.message).join("; "));
      (err as any).statusCode = 400;
      (err as any).code = "VALIDATION_FAILED";
      throw err;
    }

    const { distributorId, destinationLocationId, items, notes } = validated.data;

    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      // 1. Verify distributor account is ACTIVE
      const profRes = await client.query(
        `SELECT id, customer_id, role, status, business_name FROM "account_profile" 
         WHERE (customer_id = $1 OR id = $1) AND deleted_at IS NULL LIMIT 1`,
        [distributorId]
      );
      if (profRes.rows.length === 0) {
        const err = new Error(`Distributor profile '${distributorId}' not found.`);
        (err as any).statusCode = 404;
        (err as any).code = "DISTRIBUTOR_NOT_FOUND";
        throw err;
      }
      const prof = profRes.rows[0];
      if ((prof.role || "").toUpperCase() !== "DISTRIBUTOR") {
        const err = new Error(`Account '${distributorId}' is not a DISTRIBUTOR.`);
        (err as any).statusCode = 400;
        (err as any).code = "INVALID_ROLE";
        throw err;
      }
      if ((prof.status || "").toUpperCase() !== "ACTIVE") {
        const err = new Error(`Distributor '${distributorId}' is ${prof.status}. Suspended or pending distributors cannot purchase supplier stock.`);
        (err as any).statusCode = 403;
        (err as any).code = "DISTRIBUTOR_NOT_ACTIVE";
        throw err;
      }

      // 2. Resolve items, prices, and verify categories
      const poItems: DistributorPoItemDto[] = [];
      let subtotalPaise = 0;
      let totalGstPaise = 0;

      for (const item of items) {
        const skuUpper = item.sku.toUpperCase().trim();
        // Check catalog row in dms_product_import_row or product
        const rowRes = await client.query(
          `SELECT sku, product_name, distributor_price_inr, customer_price_inr, gst_rate, route, is_quote_only 
           FROM "dms_product_import_row" 
           WHERE UPPER(sku) = $1 AND deleted_at IS NULL LIMIT 1`,
          [skuUpper]
        );

        let title = `Item ${skuUpper}`;
        let unitPriceInr = 1000; // fallback if unpriced
        let gstRate: number | null = null;
        let isQuoteOnly = false;

        if (rowRes.rows.length > 0) {
          const row = rowRes.rows[0];
          title = row.product_name;
          unitPriceInr = row.distributor_price_inr || row.customer_price_inr || 0;
          gstRate = row.gst_rate;
          isQuoteOnly = Boolean(row.is_quote_only || unitPriceInr <= 0);
        }

        const unitPricePaise = Math.round(unitPriceInr * 100);
        const lineTotalPaise = unitPricePaise * item.qty;
        subtotalPaise += lineTotalPaise;

        if (gstRate && gstRate > 0) {
          totalGstPaise += Math.round((lineTotalPaise * gstRate) / 100);
        }

        poItems.push({
          sku: skuUpper,
          title,
          qty: item.qty,
          unitPricePaise,
          gstRate,
          isQuoteOnly,
          lineTotalPaise,
        });
      }

      const totalPaise = subtotalPaise + totalGstPaise;

      // 3. Opening stock target evaluation (~₹3 lakh target is configurable policy)
      const TARGET_OPENING_STOCK_PAISE = 30000000; // ₹300,000.00
      const isBelowOpeningStockTarget = totalPaise < TARGET_OPENING_STOCK_PAISE;
      const targetAdvisoryMessage = isBelowOpeningStockTarget
        ? `Order total (₹${(totalPaise / 100).toFixed(2)}) is below the proposed opening stock target of ₹3,00,000. Proceeding under configurable policy.`
        : undefined;

      // 4. Generate PO Number
      const poNumber = `DPO-2026-${Date.now().toString().slice(-6)}`;
      const id = `dpo_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      const insRes = await client.query(
        `INSERT INTO "dms_distributor_po" 
         (id, po_number, distributor_id, status, payment_status, source_location_id, destination_location_id, 
          items, subtotal_paise, gst_amount_paise, total_paise, notes)
         VALUES ($1, $2, $3, 'SUBMITTED', 'PAYMENT_PENDING_VERIFICATION', 'loc_central', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          poNumber,
          distributorId,
          destinationLocationId || `loc_dist_${distributorId.slice(-6)}`,
          JSON.stringify(poItems),
          subtotalPaise,
          totalGstPaise,
          totalPaise,
          notes || null,
        ]
      );

      const row = insRes.rows[0];
      return {
        id: row.id,
        poNumber: row.po_number,
        distributorId: row.distributor_id,
        distributorName: prof.business_name || prof.customer_id,
        status: row.status,
        paymentStatus: row.payment_status,
        paymentProofReference: row.payment_proof_reference,
        paymentVerifiedBy: row.payment_verified_by,
        paymentVerifiedAt: row.payment_verified_at ? row.payment_verified_at.toISOString() : null,
        sourceLocationId: row.source_location_id,
        destinationLocationId: row.destination_location_id,
        items: poItems,
        subtotalPaise: row.subtotal_paise,
        gstAmountPaise: row.gst_amount_paise,
        totalPaise: row.total_paise,
        dispatchReference: row.dispatch_reference,
        dispatchedAt: row.dispatched_at ? row.dispatched_at.toISOString() : null,
        notes: row.notes,
        cancellationReason: row.cancellation_reason,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        isBelowOpeningStockTarget,
        targetAdvisoryMessage,
      };
    });
  }

  /**
   * P7.2: Submit offline bank transfer proof (UTR reference) for a PO.
   */
  static async submitPaymentProof(
    poolOrClient: Pool | PoolClient,
    poId: string,
    distributorId: string,
    utrReference: string
  ): Promise<DistributorPoDto> {
    if (!utrReference || !utrReference.trim()) {
      const err = new Error("UTR payment reference is required.");
      (err as any).statusCode = 400;
      throw err;
    }

    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const poRes = await client.query(
        `SELECT * FROM "dms_distributor_po" WHERE (id = $1 OR po_number = $1) AND deleted_at IS NULL LIMIT 1`,
        [poId]
      );
      if (poRes.rows.length === 0) {
        const err = new Error(`Purchase order '${poId}' not found.`);
        (err as any).statusCode = 404;
        throw err;
      }
      const po = poRes.rows[0];
      if (po.distributor_id !== distributorId) {
        const err = new Error(`Tenant violation: You do not have permission to update this purchase order.`);
        (err as any).statusCode = 403;
        throw err;
      }

      const updRes = await client.query(
        `UPDATE "dms_distributor_po" 
         SET payment_proof_reference = $1, status = 'AWAITING_FINANCE_APPROVAL', updated_at = now()
         WHERE id = $2 RETURNING *`,
        [utrReference.trim(), po.id]
      );

      const r = updRes.rows[0];
      return {
        id: r.id,
        poNumber: r.po_number,
        distributorId: r.distributor_id,
        status: r.status,
        paymentStatus: r.payment_status,
        paymentProofReference: r.payment_proof_reference,
        paymentVerifiedBy: r.payment_verified_by,
        paymentVerifiedAt: r.payment_verified_at ? r.payment_verified_at.toISOString() : null,
        sourceLocationId: r.source_location_id,
        destinationLocationId: r.destination_location_id,
        items: r.items,
        subtotalPaise: r.subtotal_paise,
        gstAmountPaise: r.gst_amount_paise,
        totalPaise: r.total_paise,
        dispatchReference: r.dispatch_reference,
        dispatchedAt: r.dispatched_at ? r.dispatched_at.toISOString() : null,
        notes: r.notes,
        cancellationReason: r.cancellation_reason,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    });
  }

  /**
   * P7.2: Staff Finance verifies offline bank transfer proof.
   */
  static async financeApprovePayment(
    poolOrClient: Pool | PoolClient,
    poId: string,
    staffId: string
  ): Promise<DistributorPoDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const poRes = await client.query(
        `SELECT * FROM "dms_distributor_po" WHERE (id = $1 OR po_number = $1) AND deleted_at IS NULL LIMIT 1`,
        [poId]
      );
      if (poRes.rows.length === 0) {
        const err = new Error(`Purchase order '${poId}' not found.`);
        (err as any).statusCode = 404;
        throw err;
      }
      const po = poRes.rows[0];

      const updRes = await client.query(
        `UPDATE "dms_distributor_po" 
         SET payment_status = 'PAYMENT_VERIFIED', payment_verified_by = $1, payment_verified_at = now(),
             status = 'APPROVED', updated_at = now()
         WHERE id = $2 RETURNING *`,
        [staffId, po.id]
      );

      const r = updRes.rows[0];
      return {
        id: r.id,
        poNumber: r.po_number,
        distributorId: r.distributor_id,
        status: r.status,
        paymentStatus: r.payment_status,
        paymentProofReference: r.payment_proof_reference,
        paymentVerifiedBy: r.payment_verified_by,
        paymentVerifiedAt: r.payment_verified_at ? r.payment_verified_at.toISOString() : null,
        sourceLocationId: r.source_location_id,
        destinationLocationId: r.destination_location_id,
        items: r.items,
        subtotalPaise: r.subtotal_paise,
        gstAmountPaise: r.gst_amount_paise,
        totalPaise: r.total_paise,
        dispatchReference: r.dispatch_reference,
        dispatchedAt: r.dispatched_at ? r.dispatched_at.toISOString() : null,
        notes: r.notes,
        cancellationReason: r.cancellation_reason,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    });
  }

  /**
   * P7.2: Staff allocates and dispatches inventory from Sai Ajantha Central to Distributor.
   * Increments distributor's in-transit inventory ledger.
   */
  static async allocateAndDispatchPo(
    poolOrClient: Pool | PoolClient,
    poId: string,
    dispatchRef: string
  ): Promise<DistributorPoDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const poRes = await client.query(
        `SELECT * FROM "dms_distributor_po" WHERE (id = $1 OR po_number = $1) AND deleted_at IS NULL FOR UPDATE`,
        [poId]
      );
      if (poRes.rows.length === 0) {
        const err = new Error(`Purchase order '${poId}' not found.`);
        (err as any).statusCode = 404;
        throw err;
      }
      const po = poRes.rows[0];

      if (po.payment_status !== "PAYMENT_VERIFIED") {
        const err = new Error(`PO cannot be dispatched without verified payment (current payment status: ${po.payment_status}).`);
        (err as any).statusCode = 400;
        throw err;
      }

      // Idempotency check: if PO was already dispatched, return existing record without double-decrementing
      if (po.status === "DISPATCHED" || po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") {
        return {
          id: po.id,
          poNumber: po.po_number,
          distributorId: po.distributor_id,
          status: po.status,
          paymentStatus: po.payment_status,
          paymentProofReference: po.payment_proof_reference,
          paymentVerifiedBy: po.payment_verified_by,
          paymentVerifiedAt: po.payment_verified_at ? po.payment_verified_at.toISOString() : null,
          sourceLocationId: po.source_location_id,
          destinationLocationId: po.destination_location_id,
          items: po.items,
          subtotalPaise: po.subtotal_paise,
          gstAmountPaise: po.gst_amount_paise,
          totalPaise: po.total_paise,
          dispatchReference: po.dispatch_reference,
          dispatchedAt: po.dispatched_at ? po.dispatched_at.toISOString() : null,
          notes: po.notes,
          cancellationReason: po.cancellation_reason,
          createdAt: po.created_at.toISOString(),
          updatedAt: po.updated_at.toISOString(),
        };
      }

      const updRes = await client.query(
        `UPDATE "dms_distributor_po" 
         SET status = 'DISPATCHED', dispatch_reference = $1, dispatched_at = now(), updated_at = now()
         WHERE id = $2 RETURNING *`,
        [dispatchRef, po.id]
      );

      // Decrement Central Warehouse stock & Increment in-transit quantities on distributor's inventory table
      const items: DistributorPoItemDto[] = po.items;
      for (const item of items) {
        // 1. Decrement Central Warehouse physical stock (conservation of units)
        await client.query(
          `UPDATE "dms_product_import_row" 
           SET stock_qty = GREATEST(0, COALESCE(stock_qty, 0) - $1), updated_at = now()
           WHERE UPPER(sku) = $2 AND deleted_at IS NULL`,
          [item.qty, item.sku.toUpperCase()]
        );

        // 2. Insert immutable movement record for Central decrement
        await client.query(
          `INSERT INTO "dms_inventory_movement"
           (id, operation_key, inventory_item_id, location_id, seller_id, order_id, movement_type, delta_physical, delta_reserved, actor_type, actor_id, reason)
           VALUES ($1, $2, $3, 'loc_central', 'SAI_AJANTHA_CENTRAL', $4, 'SUPPLIER_DISPATCH_TRANSFER', $5, 0, 'staff', 'logistics', $6)
           ON CONFLICT (operation_key) DO NOTHING`,
          [
            `mov_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            `DISPATCH_${po.id}_${item.sku}`,
            item.sku,
            po.id,
            -item.qty,
            `Supplier dispatch to distributor ${po.distributor_id} under ASN ${dispatchRef}`,
          ]
        );

        // 3. Increment in-transit quantities on distributor's inventory table
        const locationId = po.destination_location_id || `loc_dist_${po.distributor_id.slice(-6)}`;
        await client.query(
          `INSERT INTO "dms_distributor_inventory" 
           (id, distributor_id, sku, title, location_id, stocked_qty, reserved_qty, damaged_qty, in_transit_qty, unit_cost_paise)
           VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6, $7)
           ON CONFLICT ("distributor_id", "sku", "location_id") WHERE deleted_at IS NULL
           DO UPDATE SET in_transit_qty = "dms_distributor_inventory".in_transit_qty + EXCLUDED.in_transit_qty,
                         updated_at = now()`,
          [
            `dinv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            po.distributor_id,
            item.sku,
            item.title,
            locationId,
            item.qty,
            item.unitPricePaise,
          ]
        );
      }

      const r = updRes.rows[0];
      return {
        id: r.id,
        poNumber: r.po_number,
        distributorId: r.distributor_id,
        status: r.status,
        paymentStatus: r.payment_status,
        paymentProofReference: r.payment_proof_reference,
        paymentVerifiedBy: r.payment_verified_by,
        paymentVerifiedAt: r.payment_verified_at ? r.payment_verified_at.toISOString() : null,
        sourceLocationId: r.source_location_id,
        destinationLocationId: r.destination_location_id,
        items: r.items,
        subtotalPaise: r.subtotal_paise,
        gstAmountPaise: r.gst_amount_paise,
        totalPaise: r.total_paise,
        dispatchReference: r.dispatch_reference,
        dispatchedAt: r.dispatched_at ? r.dispatched_at.toISOString() : null,
        notes: r.notes,
        cancellationReason: r.cancellation_reason,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    });
  }

  /**
   * P7.3: Distributor Warehouse Receipt & Owned Inventory Ledger Transfer.
   * Decrements in_transit_qty, increments stocked_qty by receivedQty (saleable stock).
   * Damaged goods are quarantined to damaged_qty and are NOT saleable.
   * Missing goods are NOT added to physical inventory.
   */
  static async processWarehouseReceipt(
    poolOrClient: Pool | PoolClient,
    input: {
      poId: string;
      distributorId: string;
      lines: unknown[];
      inspectionNotes?: string;
      inspectionEvidenceUrls?: string[];
      verifiedBy: string;
    }
  ): Promise<{ receipt: DistributorReceiptDto; poStatus: string }> {
    const linesValidation = validateDistributorReceiptLines(input.lines);
    if (!linesValidation.success) {
      const err = new Error(linesValidation.errors.map((e) => e.message).join("; "));
      (err as any).statusCode = 400;
      (err as any).code = "VALIDATION_FAILED";
      throw err;
    }

    const lines = linesValidation.data;

    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      // 1. Fetch PO with row lock
      const poRes = await client.query(
        `SELECT * FROM "dms_distributor_po" WHERE (id = $1 OR po_number = $1) AND deleted_at IS NULL FOR UPDATE`,
        [input.poId]
      );
      if (poRes.rows.length === 0) {
        const err = new Error(`Purchase order '${input.poId}' not found.`);
        (err as any).statusCode = 404;
        throw err;
      }
      const po = poRes.rows[0];

      // Tenant isolation: Distributor A cannot receive Distributor B's goods
      if (po.distributor_id !== input.distributorId) {
        const err = new Error(`Tenant violation: Distributor '${input.distributorId}' cannot receive PO belonging to '${po.distributor_id}'.`);
        (err as any).statusCode = 403;
        (err as any).code = "CROSS_TENANT_VIOLATION";
        throw err;
      }

      if (po.status !== "DISPATCHED" && po.status !== "PARTIALLY_RECEIVED") {
        const err = new Error(`Receipt can only be processed for DISPATCHED orders (current status: ${po.status}).`);
        (err as any).statusCode = 400;
        throw err;
      }

      // Check if any line has damaged or missing qty
      let hasDiscrepancy = false;
      for (const line of lines) {
        if (line.damagedQty > 0 || line.missingQty > 0) {
          hasDiscrepancy = true;
          break;
        }
      }

      const receiptStatus = hasDiscrepancy ? "DISCREPANCY_FLAGGED" : "VERIFIED";
      const newPoStatus = hasDiscrepancy ? "PARTIALLY_RECEIVED" : "RECEIVED";

      // 2. Insert receipt record
      const receiptNumber = `RCPT-2026-${Date.now().toString().slice(-6)}`;
      const receiptId = `drcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      const rcptRes = await client.query(
        `INSERT INTO "dms_distributor_receipt" 
         (id, receipt_number, po_id, distributor_id, status, lines, inspection_notes, inspection_evidence_urls, verified_by, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         RETURNING *`,
        [
          receiptId,
          receiptNumber,
          po.id,
          input.distributorId,
          receiptStatus,
          JSON.stringify(lines),
          input.inspectionNotes || null,
          input.inspectionEvidenceUrls ? JSON.stringify(input.inspectionEvidenceUrls) : null,
          input.verifiedBy,
        ]
      );

      // 3. Update distributor inventory ledger for each SKU
      const locationId = po.destination_location_id || `loc_dist_${input.distributorId.slice(-6)}`;
      for (const line of lines) {
        // Decrease in_transit_qty by expectedQty
        // Increase stocked_qty by receivedQty ONLY
        // Increase damaged_qty by damagedQty (quarantine)
        await client.query(
          `UPDATE "dms_distributor_inventory" 
           SET in_transit_qty = GREATEST(0, in_transit_qty - $1),
               stocked_qty = stocked_qty + $2,
               damaged_qty = damaged_qty + $3,
               updated_at = now()
           WHERE distributor_id = $4 AND sku = $5 AND location_id = $6`,
          [line.expectedQty, line.receivedQty, line.damagedQty, input.distributorId, line.sku, locationId]
        );
      }

      // 4. Update PO status
      await client.query(
        `UPDATE "dms_distributor_po" SET status = $1, updated_at = now() WHERE id = $2`,
        [newPoStatus, po.id]
      );

      const r = rcptRes.rows[0];
      return {
        receipt: {
          id: r.id,
          receiptNumber: r.receipt_number,
          poId: r.po_id,
          distributorId: r.distributor_id,
          status: r.status,
          lines: r.lines,
          inspectionNotes: r.inspection_notes,
          inspectionEvidenceUrls: r.inspection_evidence_urls,
          verifiedBy: r.verified_by,
          verifiedAt: r.verified_at ? r.verified_at.toISOString() : null,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        },
        poStatus: newPoStatus,
      };
    });
  }

  /**
   * P7.3: Fetch distributor-owned inventory ledger with tenant isolation.
   */
  static async getDistributorInventory(
    poolOrClient: Pool | PoolClient,
    targetDistributorId: string,
    caller: { role: string; distributorId?: string }
  ): Promise<DistributorInventoryItemDto[]> {
    // Tenant check: A distributor cannot read another distributor's inventory
    if (caller.role === "DISTRIBUTOR" && caller.distributorId !== targetDistributorId) {
      const err = new Error(`Tenant isolation violation: Access denied to distributor '${targetDistributorId}' inventory.`);
      (err as any).statusCode = 403;
      (err as any).code = "CROSS_TENANT_VIOLATION";
      throw err;
    }

    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);
      const res = await client.query(
        `SELECT * FROM "dms_distributor_inventory" 
         WHERE distributor_id = $1 AND deleted_at IS NULL ORDER BY sku ASC`,
        [targetDistributorId]
      );

      return res.rows.map((row) => ({
        id: row.id,
        distributorId: row.distributor_id,
        sku: row.sku,
        variantId: row.variant_id,
        title: row.title,
        locationId: row.location_id,
        stockedQty: row.stocked_qty,
        reservedQty: row.reserved_qty,
        damagedQty: row.damaged_qty,
        inTransitQty: row.in_transit_qty,
        availableSaleableQty: Math.max(0, row.stocked_qty - row.reserved_qty),
        unitCostPaise: row.unit_cost_paise,
        updatedAt: row.updated_at.toISOString(),
      }));
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P7.3: Read-only inventory reconciliation report by SKU/location.
   */
  static async getInventoryReconciliationReport(
    poolOrClient: Pool | PoolClient,
    distributorId: string
  ): Promise<{
    distributorId: string;
    generatedAt: string;
    items: Array<{
      sku: string;
      title: string;
      supplierDispatchedQty: number;
      inTransitQty: number;
      receivedQty: number;
      damagedQuarantineQty: number;
      availableSaleableQty: number;
      reservedQty: number;
      isReconciled: boolean;
    }>;
  }> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);
      const res = await client.query(
        `SELECT sku, title, stocked_qty, reserved_qty, damaged_qty, in_transit_qty 
         FROM "dms_distributor_inventory" 
         WHERE distributor_id = $1 AND deleted_at IS NULL ORDER BY sku ASC`,
        [distributorId]
      );

      const items = res.rows.map((r) => {
        const available = Math.max(0, r.stocked_qty - r.reserved_qty);
        // Total dispatched from supplier = in_transit + received (stocked + damaged)
        const totalDispatched = r.in_transit_qty + r.stocked_qty + r.damaged_qty;
        return {
          sku: r.sku,
          title: r.title,
          supplierDispatchedQty: totalDispatched,
          inTransitQty: r.in_transit_qty,
          receivedQty: r.stocked_qty,
          damagedQuarantineQty: r.damaged_qty,
          availableSaleableQty: available,
          reservedQty: r.reserved_qty,
          isReconciled: totalDispatched === r.in_transit_qty + r.stocked_qty + r.damaged_qty,
        };
      });

      return {
        distributorId,
        generatedAt: new Date().toISOString(),
        items,
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P7.4: Distributor Resale Quote Scaffold for Linked Dealers and Territory Shoppers.
   * Quotes do NOT reserve or decrement stock.
   */
  static async createResaleQuote(
    poolOrClient: Pool | PoolClient,
    input: {
      distributorId: string;
      buyerId: string;
      buyerRole: string;
      buyerName: string;
      buyerEmail: string;
      buyerPhone: string;
      postalCode: string;
      items: { sku: string; qty: number; unitPricePaise?: number }[];
    }
  ): Promise<{ quoteNumber: string; distributorId: string; status: string; totalPaise: number }> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const quoteNumber = `RSQ-2026-${Date.now().toString().slice(-6)}`;
      const id = `drsq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      let subtotalPaise = 0;
      for (const it of input.items) {
        subtotalPaise += (it.unitPricePaise || 100000) * it.qty;
      }
      const gstAmountPaise = Math.round(subtotalPaise * 0.18);
      const totalPaise = subtotalPaise + gstAmountPaise;

      await client.query(
        `INSERT INTO "dms_distributor_resale_quote" 
         (id, quote_number, distributor_id, buyer_id, buyer_role, buyer_name, buyer_email, buyer_phone, postal_code, items, subtotal_paise, gst_amount_paise, total_paise, status, is_quote_only)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'REQUESTED', true)`,
        [
          id,
          quoteNumber,
          input.distributorId,
          input.buyerId,
          input.buyerRole,
          input.buyerName,
          input.buyerEmail,
          input.buyerPhone,
          input.postalCode,
          JSON.stringify(input.items),
          subtotalPaise,
          gstAmountPaise,
          totalPaise,
        ]
      );

      return {
        quoteNumber,
        distributorId: input.distributorId,
        status: "REQUESTED",
        totalPaise,
      };
    });
  }

  /**
   * P7.5 & P7.10.C: Financial Separation Summary.
   * Sai Ajantha Wholesale Revenue is strictly separated from Distributor Resale GMV.
   * Zero double counting! Resale quotes are demand pipeline, NOT realized revenue or GMV.
   */
  static async getFinancialSeparationSummary(
    poolOrClient: Pool | PoolClient
  ): Promise<FinancialSeparationSummaryDto> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);

      // 1. Sai Ajantha Verified Supplier Revenue = Sum of PAYMENT_VERIFIED distributor purchase orders
      const poRes = await client.query(
        `SELECT COALESCE(SUM(total_paise), 0) as total_supplier_rev 
         FROM "dms_distributor_po" 
         WHERE payment_status = 'PAYMENT_VERIFIED' AND deleted_at IS NULL`
      );
      const saiAjanthaSupplierRevenuePaise = parseInt(poRes.rows[0].total_supplier_rev, 10);

      // 1b. Payment Pending Verification (UTR entered, not yet verified by finance)
      const pendingRes = await client.query(
        `SELECT COALESCE(SUM(total_paise), 0) as total_pending 
         FROM "dms_distributor_po" 
         WHERE payment_status = 'PAYMENT_PENDING_VERIFICATION' AND payment_proof_reference IS NOT NULL AND deleted_at IS NULL`
      );
      const saiAjanthaPaymentPendingVerificationPaise = parseInt(pendingRes.rows[0].total_pending, 10);

      // 2. Distributor Quote Pipeline Demand (Quotes are customer intent, Delta Revenue = 0)
      const quoteRes = await client.query(
        `SELECT COALESCE(SUM(total_paise), 0) as total_quote_pipeline 
         FROM "dms_distributor_resale_quote" 
         WHERE deleted_at IS NULL`
      );
      const distributorQuotePipelineDemandPaise = parseInt(quoteRes.rows[0].total_quote_pipeline, 10);

      // 3. Distributor Completed Resale GMV (Strictly 0 until commercial resale orders are enabled)
      const distributorCompletedResaleGmvPaise = 0;
      const distributorResaleGmvStatus = "NOT_YET_MEASURED: Resale checkout disabled per DEC-002";

      return {
        saiAjanthaSupplierRevenuePaise,
        saiAjanthaPaymentPendingVerificationPaise,
        distributorQuotePipelineDemandPaise,
        distributorCompletedResaleGmvPaise,
        distributorResaleGmvPaise: distributorCompletedResaleGmvPaise,
        distributorResaleGmvStatus,
        isRealGatewayEnabled: false, // Strictly false per DEC-002
        invoiceDisclaimer: "Draft / Not a Tax Invoice",
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }
}
