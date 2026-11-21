import { Pool, type PoolClient } from "pg";
import {
  type CanonicalOrderLifecycleStatus,
  type CanonicalPaymentLifecycleStatus,
  type CanonicalFulfilmentLifecycleStatus,
  type CanonicalReturnLifecycleStatus,
  type CanonicalRefundLifecycleStatus,
  type CanonicalDocumentType,
  type FinancialDocumentDto,
  type ReturnRequestDto,
  type OrderTransitionInput,
  validateOrderTransition,
} from "@sai-ajanta/types";
import { assertDisposableDbConnection } from "../lib/disposable-db-guard";
import { TaxEngineService } from "./tax-engine.service";

async function withTransaction<T>(
  poolOrClient: Pool | PoolClient,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
  const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

  try {
    if (isPool) await client.query("BEGIN;");
    const result = await fn(client);
    if (isPool) await client.query("COMMIT;");
    return result;
  } catch (err) {
    if (isPool) await client.query("ROLLBACK;");
    throw err;
  } finally {
    if (isPool) (client as PoolClient).release();
  }
}

export class OrderLifecycleService {
  /**
   * P9.1: Executes a validated server-authoritative command transition on an order.
   */
  static async executeOrderCommand(
    poolOrClient: Pool | PoolClient,
    input: OrderTransitionInput
  ): Promise<{
    orderId: string;
    previousStatus: string;
    newStatus: string;
    paymentStatus: string;
    fulfilmentStatus: string;
  }> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      // 1. Fetch current order with row lock
      const orderRes = await client.query(
        `SELECT id, status, payment_status, fulfilment_status, customer_id, customer_email, total_paise
         FROM "dms_trade_order"
         WHERE id = $1
         FOR UPDATE`,
        [input.orderId]
      );

      if (orderRes.rows.length === 0) {
        const err: any = new Error(`Order '${input.orderId}' not found.`);
        err.code = "ORDER_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const order = orderRes.rows[0];
      const curStatus = (order.status || "DRAFT") as CanonicalOrderLifecycleStatus;
      const curPayment = (order.payment_status || "UNPAID") as CanonicalPaymentLifecycleStatus;
      const curFulfilment = (order.fulfilment_status || "UNALLOCATED") as CanonicalFulfilmentLifecycleStatus;

      // 2. Validate transition legality
      const validation = validateOrderTransition(curStatus, curPayment, input.command);
      if (!validation.allowed) {
        const err: any = new Error(validation.reason || "Illegal state transition.");
        err.code = "ILLEGAL_STATE_TRANSITION";
        err.statusCode = 400;
        throw err;
      }

      let nextStatus = curStatus;
      let nextPayment = curPayment;
      let nextFulfilment = curFulfilment;

      switch (input.command) {
        case "MARK_CONFIRMED":
          nextStatus = "CONFIRMED";
          break;

        case "SUBMIT_BANK_PROOF":
          if (!input.bankReference || !input.bankReference.trim()) {
            const err: any = new Error("bankReference is required when submitting bank transfer proof.");
            err.code = "BANK_REFERENCE_REQUIRED";
            err.statusCode = 400;
            throw err;
          }
          const cleanUtr = input.bankReference.trim();
          // P9.12.2: Guard against duplicate UTR submission/replay across orders
          const dupUtrRes = await client.query(
            `SELECT id, order_number FROM "dms_trade_order"
             WHERE bank_reference = $1 AND id != $2 AND bank_proof_status IN ('UTR_SUBMITTED', 'VERIFIED')`,
            [cleanUtr, input.orderId]
          );
          if (dupUtrRes.rows.length > 0) {
            const err: any = new Error(
              `Bank reference '${cleanUtr}' has already been registered on order ${dupUtrRes.rows[0].id}. Duplicate UTRs are rejected.`
            );
            err.code = "DUPLICATE_BANK_REFERENCE";
            err.statusCode = 409;
            throw err;
          }

          nextPayment = "AWAITING_BANK_VERIFICATION";
          await client.query(
            `UPDATE "dms_trade_order"
             SET bank_reference = $1, bank_proof_status = 'UTR_SUBMITTED', updated_at = now()
             WHERE id = $2`,
            [cleanUtr, input.orderId]
          );
          break;

        case "VERIFY_BANK_PAYMENT":
          // Security: only Finance or Super Admin staff can verify payments
          if (
            input.actorRole !== "STAFF_FINANCE" &&
            input.actorRole !== "STAFF_ADMIN"
          ) {
            const err: any = new Error("Forbidden: Only Finance staff can verify bank transfer payments.");
            err.code = "FORBIDDEN_FINANCE_ACTION";
            err.statusCode = 403;
            throw err;
          }
          nextPayment = "PAID";
          nextStatus = "CONFIRMED";
          await client.query(
            `UPDATE "dms_trade_order"
             SET bank_verified_by = $1,
                 bank_verified_at = now(),
                 bank_proof_status = 'VERIFIED',
                 updated_at = now()
             WHERE id = $2`,
            [input.actorId, input.orderId]
          );
          break;

        case "REJECT_BANK_PAYMENT":
          nextPayment = "FAILED";
          await client.query(
            `UPDATE "dms_trade_order"
             SET bank_proof_status = 'REJECTED', updated_at = now()
             WHERE id = $1`,
            [input.orderId]
          );
          break;

        case "PACK_ORDER":
          nextFulfilment = "PACKED";
          nextStatus = "PROCESSING";
          break;

        case "DISPATCH_ORDER":
          nextFulfilment = "DISPATCHED";
          nextStatus = "DISPATCHED";
          await client.query(
            `UPDATE "dms_trade_order"
             SET shipping_carrier = $1,
                 tracking_reference = $2,
                 updated_at = now()
             WHERE id = $3`,
            [input.carrierName || null, input.trackingNumber || null, input.orderId]
          );
          break;

        case "MARK_DELIVERED":
          nextFulfilment = "DELIVERED";
          nextStatus = "DELIVERED";
          break;

        case "CANCEL_ORDER":
          nextStatus = "CANCELLED";
          await client.query(
            `UPDATE "dms_trade_order"
             SET cancellation_reason = $1, updated_at = now()
             WHERE id = $2`,
            [input.cancellationReason || "Cancelled by user or staff", input.orderId]
          );
          break;
      }

      // Update order state
      await client.query(
        `UPDATE "dms_trade_order"
         SET status = $1, payment_status = $2, fulfilment_status = $3, updated_at = now()
         WHERE id = $4`,
        [nextStatus, nextPayment, nextFulfilment, input.orderId]
      );

      // Insert command audit log
      const logId = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      await client.query(
        `INSERT INTO "dms_order_command_log"
         (id, order_id, command, previous_status, new_status, actor_role, actor_id, notes, payload_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          logId,
          input.orderId,
          input.command,
          curStatus,
          nextStatus,
          input.actorRole,
          input.actorId,
          input.notes || null,
          JSON.stringify(input),
        ]
      );

      return {
        orderId: input.orderId,
        previousStatus: curStatus,
        newStatus: nextStatus,
        paymentStatus: nextPayment,
        fulfilmentStatus: nextFulfilment,
      };
    });
  }

  /**
   * P9.4: Generates a server-backed draft financial document (Proforma, Draft Invoice, Draft Credit Note).
   * Prominently marked: 'Draft / Not a Tax Invoice'.
   */
  static async generateFinancialDocument(
    poolOrClient: Pool | PoolClient,
    input: {
      orderId: string;
      docType: CanonicalDocumentType;
      issuerLegalName?: string;
      issuerGstin?: string | null;
      buyerStateCode?: string;
    }
  ): Promise<FinancialDocumentDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const orderRes = await client.query(
        `SELECT * FROM "dms_trade_order" WHERE id = $1`,
        [input.orderId]
      );
      if (orderRes.rows.length === 0) {
        const err: any = new Error(`Order '${input.orderId}' not found.`);
        err.code = "ORDER_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const order = orderRes.rows[0];
      const items = Array.isArray(order.items) ? order.items : [];

      const taxCalculation = TaxEngineService.calculateOrderTaxes(
        items.map((it: any) => ({
          sku: it.sku || "UNKNOWN",
          quantity: it.quantity || 1,
          unitPricePaise: it.unitPricePaise || Math.round((it.unitPriceInr || 0) * 100),
          gstRatePercent: it.gstRate !== undefined ? it.gstRate : 18,
          hsnCode: it.hsnCode || null,
        })),
        {
          sellerStateCode: "33",
          buyerStateCode: input.buyerStateCode || order.place_of_supply_state_code || "33",
        }
      );

      const docNumberPrefix =
        input.docType === "PROFORMA"
          ? "PI-DRAFT"
          : input.docType === "DRAFT_INVOICE"
          ? "INV-DRAFT"
          : "CN-DRAFT";

      const docNumber = `${docNumberPrefix}-${order.order_number || order.id}-${Date.now().toString().slice(-4)}`;
      const docId = `fdoc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

      const documentPayload: FinancialDocumentDto = {
        docId,
        docNumber,
        docType: input.docType,
        orderId: order.id,
        sellerId: order.is_direct_sai_ajanta ? "SAI_AJANTHA_CENTRAL" : "REGIONAL_DISTRIBUTOR",
        sellerLegalName: input.issuerLegalName || "Sai Ajantha Interior Solutions",
        sellerGstin: input.issuerGstin || order.gstin || null,
        sellerAddress: "Trichy Central Logistics Hub, Tamil Nadu 620001",
        buyerName: order.customer_name || "Customer",
        buyerEmail: order.customer_email || "customer@example.com",
        buyerGstin: order.gstin || null,
        shippingAddress: order.shipping_address || "",
        placeOfSupplyStateCode: input.buyerStateCode || order.place_of_supply_state_code || "33",
        currency: "INR",
        lines: taxCalculation.lineTaxDetails,
        totals: taxCalculation,
        disclaimer: "Draft / Not a Tax Invoice",
        isOfficialTaxDocument: false,
        issuedAt: new Date().toISOString(),
      };

      await client.query(
        `INSERT INTO "dms_financial_document"
         (id, doc_number, doc_type, order_id, seller_id, buyer_email, total_paise, tax_paise, document_payload, disclaimer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          docId,
          docNumber,
          input.docType,
          order.id,
          documentPayload.sellerId,
          documentPayload.buyerEmail,
          taxCalculation.grandTotalPaise,
          taxCalculation.totalTaxPaise,
          JSON.stringify(documentPayload),
          "Draft / Not a Tax Invoice",
        ]
      );

      return documentPayload;
    });
  }

  /**
   * P9.6: Creates a structured return request for an order line item.
   */
  static async requestReturn(
    poolOrClient: Pool | PoolClient,
    input: {
      orderId: string;
      lineId: string;
      sku: string;
      quantity: number;
      reason: string;
      customerNotes?: string;
    }
  ): Promise<ReturnRequestDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const orderRes = await client.query(
        `SELECT id, status, customer_id FROM "dms_trade_order" WHERE id = $1`,
        [input.orderId]
      );
      if (orderRes.rows.length === 0) {
        const err: any = new Error(`Order '${input.orderId}' not found.`);
        err.code = "ORDER_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      if (input.quantity <= 0) {
        const err: any = new Error("Return quantity must be a positive integer.");
        err.code = "INVALID_RETURN_QUANTITY";
        err.statusCode = 400;
        throw err;
      }

      const returnId = `ret_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      await client.query(
        `INSERT INTO "dms_order_return"
         (id, order_id, line_id, sku, quantity_requested, reason, customer_notes, status, refund_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'REQUESTED', 'NONE')`,
        [
          returnId,
          input.orderId,
          input.lineId,
          input.sku.toUpperCase(),
          input.quantity,
          input.reason,
          input.customerNotes || null,
        ]
      );

      await client.query(
        `UPDATE "dms_trade_order" SET return_status = 'REQUESTED', updated_at = now() WHERE id = $1`,
        [input.orderId]
      );

      return {
        id: returnId,
        orderId: input.orderId,
        lineId: input.lineId,
        sku: input.sku.toUpperCase(),
        quantityRequested: input.quantity,
        reason: input.reason,
        customerNotes: input.customerNotes,
        status: "REQUESTED",
        refundStatus: "NONE",
        inspectedQtyAccepted: 0,
        inspectedQtyScrapped: 0,
        restockedToInventory: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * P9.6: Staff inspects returned goods. Usable accepted items are restocked atomically.
   */
  static async inspectReturn(
    poolOrClient: Pool | PoolClient,
    input: {
      returnId: string;
      inspectedQtyAccepted: number;
      inspectedQtyScrapped: number;
      staffId: string;
      notes?: string;
    }
  ): Promise<{
    returnId: string;
    status: CanonicalReturnLifecycleStatus;
    restockedQty: number;
    scrappedQty: number;
  }> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const retRes = await client.query(
        `SELECT id, order_id, sku, quantity_requested, status FROM "dms_order_return" WHERE id = $1 FOR UPDATE`,
        [input.returnId]
      );
      if (retRes.rows.length === 0) {
        const err: any = new Error(`Return '${input.returnId}' not found.`);
        err.code = "RETURN_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const ret = retRes.rows[0];

      // P9.12.1: Idempotency & duplicate inspection prevention
      if (
        ret.status === "INSPECTED_ACCEPTED" ||
        ret.status === "INSPECTED_SCRAPPED" ||
        ret.restocked_to_inventory
      ) {
        const err: any = new Error(
          `Return '${input.returnId}' has already been inspected (current status: ${ret.status}). Duplicate inspections are rejected.`
        );
        err.code = "RETURN_ALREADY_INSPECTED";
        err.statusCode = 409;
        throw err;
      }

      const totalInspected = input.inspectedQtyAccepted + input.inspectedQtyScrapped;
      if (totalInspected !== ret.quantity_requested) {
        const err: any = new Error(
          `Inspected total (${totalInspected}) must exactly equal requested quantity (${ret.quantity_requested}).`
        );
        err.code = "INSPECTION_QUANTITY_MISMATCH";
        err.statusCode = 400;
        throw err;
      }

      // Identify order and seller for authoritative physical stock routing
      const orderRes = await client.query(
        `SELECT id, is_direct_sai_ajanta FROM "dms_trade_order" WHERE id = $1`,
        [ret.order_id]
      );
      const isDirectSaiAjantha = orderRes.rows[0]?.is_direct_sai_ajanta !== false;
      const sellerId = isDirectSaiAjantha ? "SAI_AJANTHA_CENTRAL" : "REGIONAL_DISTRIBUTOR";

      // Restock usable accepted units
      if (input.inspectedQtyAccepted > 0) {
        if (isDirectSaiAjantha) {
          // 1. Authoritative physical inventory in Medusa inventory_level
          const varRes = await client.query(
            `SELECT pv.id as variant_id, pvii.inventory_item_id
             FROM product_variant pv
             LEFT JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
             WHERE UPPER(pv.sku) = $1 AND pv.deleted_at IS NULL LIMIT 1`,
            [ret.sku.toUpperCase()]
          );
          if (varRes.rows.length > 0 && varRes.rows[0].inventory_item_id) {
            await client.query(
              `UPDATE inventory_level
               SET stocked_quantity = stocked_quantity + $1, updated_at = now()
               WHERE inventory_item_id = $2`,
              [input.inspectedQtyAccepted, varRes.rows[0].inventory_item_id]
            );
          }

          // 2. Update catalog presentation cache
          await client.query(
            `UPDATE "dms_product_import_row"
             SET stock_qty = COALESCE(stock_qty, 0) + $1, updated_at = now()
             WHERE UPPER(sku) = $2`,
            [input.inspectedQtyAccepted, ret.sku.toUpperCase()]
          );
        } else {
          // Distributor return: keep in quarantine per P9.12.1 until resale physical restock is owner authorized
        }

        // 3. Immutable ledger entry in dms_inventory_movement
        const opKey = `RETURN_RESTOCK_${ret.id}_${ret.sku}`;
        await client.query(
          `INSERT INTO "dms_inventory_movement"
           (id, operation_key, inventory_item_id, location_id, seller_id, order_id, movement_type, delta_physical, delta_reserved, actor_type, actor_id, reason, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, 'RETURN_RESTOCK', $7, 0, 'STAFF', $8, $9, $10)
           ON CONFLICT (operation_key) DO NOTHING`,
          [
            `mov_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            opKey,
            ret.sku,
            isDirectSaiAjantha ? "loc_central" : `loc_${sellerId}`,
            sellerId,
            ret.order_id,
            input.inspectedQtyAccepted,
            input.staffId,
            `Restocked ${input.inspectedQtyAccepted} verified usable units from return inspection (${ret.id}).`,
            JSON.stringify({ returnId: ret.id, sku: ret.sku, notes: input.notes, sellerId }),
          ]
        );
      }

      const finalStatus: CanonicalReturnLifecycleStatus =
        input.inspectedQtyAccepted > 0 ? "INSPECTED_ACCEPTED" : "INSPECTED_SCRAPPED";

      await client.query(
        `UPDATE "dms_order_return"
         SET inspected_qty_accepted = $1,
             inspected_qty_scrapped = $2,
             restocked_to_inventory = $3,
             status = $4,
             updated_at = now()
         WHERE id = $5`,
        [
          input.inspectedQtyAccepted,
          input.inspectedQtyScrapped,
          input.inspectedQtyAccepted > 0,
          finalStatus,
          input.returnId,
        ]
      );

      return {
        returnId: ret.id,
        status: finalStatus,
        restockedQty: input.inspectedQtyAccepted,
        scrappedQty: input.inspectedQtyScrapped,
      };
    });
  }
}
