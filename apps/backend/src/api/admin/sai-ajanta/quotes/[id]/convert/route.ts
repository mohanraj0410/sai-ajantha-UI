import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { recordDurableAuditEvent } from "../../../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../../../lib/permissions";
import { DMS_MODULE } from "../../../../../../modules/dms";
import type DmsModuleService from "../../../../../../modules/dms/services";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE") && !checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }

  const quoteId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const staffEmail = req.staff_user?.email || "admin@sai-ajanta.com";
  const staffId = req.staff_user?.id || "admin";

  const { rows: [quote] } = await pg.raw(
    `SELECT * FROM dms_trade_quote WHERE (id = ? OR quote_number = ?) AND deleted_at IS NULL`,
    [quoteId, quoteId]
  );

  if (!quote) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Quotation not found." });
  }

  // 1. Reject duplicate conversion
  if (quote.converted_order_id || quote.status === "CONVERTED_TO_ORDER") {
    return res.status(400).json({
      code: "ALREADY_CONVERTED",
      message: `Quotation has already been converted to order '${quote.converted_order_id}'. Duplicate conversion is prohibited.`,
    });
  }

  // 2. Must be in ACCEPTED status to convert
  if (quote.status !== "ACCEPTED") {
    return res.status(400).json({
      code: "NOT_ACCEPTED",
      message: `Only accepted quotations can be converted to orders. Current quote status is '${quote.status}'.`,
    });
  }

  // 3. Expiration Check
  if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
    return res.status(400).json({
      code: "QUOTE_EXPIRED",
      message: `Quotation has expired on ${new Date(quote.valid_until).toISOString().split("T")[0]} and cannot be converted to an order.`,
    });
  }

  // 4. Line Items Validation
  const items = Array.isArray(quote.items) ? quote.items : [];
  if (items.length === 0) {
    return res.status(400).json({
      code: "EMPTY_QUOTE",
      message: "Quotation contains no valid line items.",
    });
  }

  // 5. Look up SKUs in catalogue to audit variants, tax, stock, and Floor Springs rule
  const skus = items.map((it: any) => it.sku);
  const { rows: catalogRows } = await pg.raw(
    `SELECT sku, product_name, category, customer_price_inr, dealer_price_inr, distributor_price_inr, gst_rate, stock_qty, route, is_quote_only 
     FROM dms_product_import_row 
     WHERE sku = ANY(?::text[])`,
    [skus]
  );
  const catalogBySku = new Map<string, any>(catalogRows.map((r: any) => [r.sku, r]));

  let subtotalInr = 0;
  let taxInr = 0;
  let hasStockShortage = false;

  for (const it of items) {
    const cat = catalogBySku.get(it.sku);

    // Rule D: Floor Springs are strictly ENQUIRY_ONLY per DEC-003
    const isFloorSpring =
      cat?.route === "ENQUIRY_ONLY" ||
      (it.sku || "").toUpperCase().includes("-FS-") ||
      (it.name || "").toLowerCase().includes("floor spring") ||
      ((cat?.product_name || "").toLowerCase().includes("floor spring") &&
        !(cat?.product_name || "").toLowerCase().includes("door closer"));

    if (isFloorSpring) {
      return res.status(400).json({
        code: "FLOOR_SPRING_ENQUIRY_ONLY",
        message: `SKU '${it.sku}' is a Hydraulic Floor Spring. Floor Springs remain strictly ENQUIRY_ONLY per DEC-003 and cannot be converted into checkout/payable orders.`,
      });
    }

    // Rule 1: Audit quotation GST calculations. Remove blanket 18% assumption.
    // Use only verified SKU-specific GST rate. Unverified tax data must block final confirmation.
    const verifiedGstRate =
      typeof it.gstRate === "number" ? it.gstRate : (cat && cat.gst_rate !== null ? Number(cat.gst_rate) : null);

    if (verifiedGstRate === null || isNaN(verifiedGstRate)) {
      return res.status(400).json({
        code: "UNVERIFIED_TAX_DATA",
        message: `Cannot convert quotation: SKU '${it.sku}' has unverified tax data. Commercial policy prohibits order conversion without verified SKU-specific GST rate.`,
      });
    }

    const unitPrice = Number(it.unitPriceInr || 0);
    const qty = Number(it.quantity || 1);
    if (unitPrice <= 0) {
      return res.status(400).json({
        code: "INVALID_PRICING",
        message: `Line item '${it.sku}' has invalid or zero unit price.`,
      });
    }

    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    const lineTax = Math.round(lineSubtotal * (verifiedGstRate / 100) * 100) / 100;

    subtotalInr += lineSubtotal;
    taxInr += lineTax;

    // Stock check
    if (cat && typeof cat.stock_qty === "number" && cat.stock_qty < qty) {
      hasStockShortage = true;
    }
  }

  subtotalInr = Math.round(subtotalInr);
  taxInr = Math.round(taxInr);
  const totalInr = subtotalInr + taxInr;
  const subtotalPaise = Math.round(subtotalInr * 100);
  const taxPaise = Math.round(taxInr * 100);
  const totalPaise = Math.round(totalInr * 100);

  // 6. Seller & Delivery PIN verification
  const isDirect = !quote.seller_id || quote.seller_id === "SAI_AJANTHA_CENTRAL" || quote.seller_type === "DIRECT";
  const postalCode = (quote.postal_code || "").trim();

  if (!isDirect && quote.seller_id) {
    // Distributor resale verification
    if (postalCode && /^\d{6}$/.test(postalCode)) {
      const { rows: distCov } = await pg.raw(
        `SELECT c.id FROM dms_distributor_coverage c
         JOIN account_profile p ON (p.customer_id = c.distributor_id OR p.id = c.distributor_id)
         WHERE (c.distributor_id = ? OR p.id = ? OR p.customer_id = ?)
           AND c.postal_code = ? AND c.status = 'ACTIVE' AND p.status = 'ACTIVE' AND c.deleted_at IS NULL
         LIMIT 1`,
        [quote.seller_id, quote.seller_id, quote.seller_id, postalCode]
      );
      if (distCov.length === 0) {
        return res.status(400).json({
          code: "SELLER_TERRITORY_UNVERIFIED",
          message: `Assigned distributor '${quote.seller_name || quote.seller_id}' does not have active authorized coverage for PIN ${postalCode}.`,
        });
      }
    }
  }

  // 7. Commercial Order Status & Non-Payable Pending Policy
  // Per DEC-002: Distributor resale online checkout/payment capture is DISABLED until owner sign-off.
  // Distributor orders require proforma offline settlement and non-payable pending state.
  let orderStatus: string = "CONFIRMED_TRADE_PO";
  let paymentMethod: string = "Proforma Invoice / Trade PO";
  let paymentStatus: string = "PENDING_OFFLINE_SETTLEMENT";

  if (!isDirect) {
    orderStatus = "PENDING_COMMERCIAL_VERIFICATION"; // Non-payable pending state
    paymentMethod = "Proforma Distributor Settlement (Offline)";
    paymentStatus = "PENDING_OFFLINE_SETTLEMENT";
  } else if (hasStockShortage) {
    orderStatus = "PENDING_STOCK_ALLOCATION";
    paymentMethod = "Proforma Invoice / Trade PO";
    paymentStatus = "PENDING_OFFLINE_SETTLEMENT";
  }

  // Create unique order identifiers
  const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const orderNumber = `SA-2026-${crypto.randomInt(10000, 99999)}`;
  const nowIso = new Date().toISOString();

  const orderLines = items.map((it: any, index: number) => {
    const cat = catalogBySku.get(it.sku);
    const rate = typeof it.gstRate === "number" ? it.gstRate : (cat?.gst_rate || 18);
    const qty = Number(it.quantity || 1);
    const price = Number(it.unitPriceInr || 0);
    return {
      id: `item_${orderId}_${index + 1}`,
      sku: it.sku || `SKU-${index + 1}`,
      name: it.name || cat?.product_name || "Hardware Line Item",
      quantity: qty,
      unitPriceInr: price,
      lineTotalInr: Math.round(qty * price * 100) / 100,
      gstRate: rate,
    };
  });

  const initialEvent = {
    action: "ORDER_CREATED_FROM_QUOTE",
    actor: staffEmail,
    timestamp: nowIso,
    note: `Order converted from accepted quotation ${quote.quote_number} (${orderStatus})`,
  };

  try {
    const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

    // Resolve real Medusa customer id if customer exists
    let resolvedCustomerId = quote.customer_email || `cust_${Date.now()}`;
    if (quote.customer_email) {
      const { rows: custMatches } = await pg.raw(
        `SELECT id FROM customer WHERE lower(email) = ? LIMIT 1`,
        [quote.customer_email.toLowerCase().trim()]
      );
      if (custMatches.length > 0) {
        resolvedCustomerId = custMatches[0].id;
      }
    }

    const createdOrder = await (dmsService as any).createTradeOrders({
      id: orderId,
      order_number: orderNumber,
      customer_id: resolvedCustomerId,
      assigned_distributor_id: !isDirect ? quote.seller_id : null,
      routing_status: !isDirect ? "ROUTED_TO_DISTRIBUTOR" : "DIRECT_FULFILLMENT",
      role_at_order: quote.organization ? "Contractor / Architect" : "Retail / Individual",
      price_tier_applied: "QUOTATION_VERIFIED",
      status: orderStatus,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      customer_name: quote.customer_name,
      customer_email: quote.customer_email || "",
      customer_phone: quote.customer_phone || "",
      organization: quote.organization || "",
      gstin: null,
      shipping_address: postalCode ? `PIN: ${postalCode}` : "Trichy Delivery Address",
      subtotal_inr: subtotalInr,
      gst_amount_inr: taxInr,
      total_inr: totalInr,
      subtotal_paise: subtotalPaise,
      gst_amount_paise: taxPaise,
      total_paise: totalPaise,
      has_quote_items: false,
      is_direct_sai_ajanta: isDirect,
      fulfillment_type: "DELIVERY",
      return_status: "NONE",
      refund_status: "NONE",
      damage_claim_status: "NONE",
      damaged_qty: 0,
      delivery_attempts: 0,
      items: orderLines as unknown as Record<string, unknown>,
      events: [initialEvent] as unknown as Record<string, unknown>,
      notes: `Converted from accepted quotation ${quote.quote_number}. Seller: ${quote.seller_name || quote.seller_id}. Status: ${orderStatus}. Customer notes: ${quote.customer_notes || 'None'}`,
    });

    // Update Quotation status to CONVERTED_TO_ORDER
    await dmsService.updateTradeQuotes({
      id: quote.id,
      status: "CONVERTED_TO_ORDER",
      converted_order_id: orderId,
    });

    // If quote has linked enquiry, update enquiry to CONVERTED_TO_ORDER and record activity
    if (quote.enquiry_id) {
      await pg.raw(
        `UPDATE dms_trade_enquiry SET status = 'CONVERTED_TO_ORDER', updated_at = now() WHERE id = ?`,
        [quote.enquiry_id]
      );

      const actId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      await pg.raw(
        `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, from_status, to_status, actor_id, actor_email, notes, created_at)
         VALUES (?, ?, 'CONVERTED_TO_ORDER', 'QUOTE_ACCEPTED', 'CONVERTED_TO_ORDER', ?, ?, ?, now())`,
        [actId, quote.enquiry_id, staffId, staffEmail, `Accepted quotation ${quote.quote_number} converted into Trade Order ${orderNumber} (${orderStatus})`]
      );
    }

    await recordDurableAuditEvent(
      req,
      "ORDER_CONVERT_FROM_QUOTE",
      `order:${orderNumber}`,
      {
        orderId,
        orderNumber,
        quoteId: quote.id,
        quoteNumber: quote.quote_number,
        enquiryId: quote.enquiry_id || null,
        subtotalInr,
        taxInr,
        totalInr,
        isDirect,
        orderStatus,
        paymentStatus,
      },
      { required: true }
    );

    const { rows: [updatedQuote] } = await pg.raw(`SELECT * FROM dms_trade_quote WHERE id = ?`, [quote.id]);

    return res.json({
      ok: true,
      success: true,
      message: `Accepted quotation ${quote.quote_number} converted into Trade Order ${orderNumber} (${orderStatus}).`,
      order: createdOrder,
      orderId,
      orderNumber,
      orderStatus,
      paymentStatus,
      quote: updatedQuote,
    });
  } catch (err: any) {
    console.error("CONVERT_ORDER_ERROR:", err);
    return res.status(500).json({
      code: "CONVERT_FAILED",
      message: err.message || "Failed to convert quote to order",
      detail: err.detail || String(err),
    });
  }
}
