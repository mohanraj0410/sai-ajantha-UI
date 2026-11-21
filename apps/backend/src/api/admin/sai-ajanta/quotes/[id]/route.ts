import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../../lib/permissions";
import { DMS_MODULE } from "../../../../../modules/dms";
import type DmsModuleService from "../../../../../modules/dms/services";

const UpdateQuoteSchema = z.object({
  status: z
    .enum(["DRAFT", "REVIEWED", "SHARED_NONPAYABLE", "ACCEPTED", "REJECTED", "REVISION_REQUESTED", "CONVERTED_TO_ORDER", "EXPIRED", "ARCHIVED"])
    .optional(),
  valid_until: z.string().trim().nullable().optional(),
  assigned_staff_email: z.string().trim().nullable().optional(),
  customer_notes: z.string().trim().optional(),
  internal_notes: z.string().trim().optional(),
  revision_note: z.string().trim().optional(),
  seller_id: z.string().trim().optional(),
  seller_name: z.string().trim().optional(),
  seller_type: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        name: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        unitPriceInr: z.number().nonnegative(),
        gstRate: z.number().nonnegative().nullable().optional(),
      })
    )
    .optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listTradeQuotes({
    id: req.params.id,
  })) as unknown as Record<string, any>[];
  if (!rows[0]) {
    const byNum = (await dmsService.listTradeQuotes({
      quote_number: req.params.id,
    })) as unknown as Record<string, any>[];
    if (!byNum[0]) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Quote not found." });
    }
    return res.json({ quote: byNum[0] });
  }
  return res.json({ quote: rows[0] });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const parsed = UpdateQuoteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }
  const body = parsed.data;
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const existingRows = (await dmsService.listTradeQuotes({
    id: req.params.id,
  })) as unknown as Record<string, any>[];

  const existing = existingRows[0];
  if (!existing) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Quote not found." });
  }

  if (existing.status === "ARCHIVED" && body.status !== "ARCHIVED") {
    return res.status(400).json({
      code: "QUOTE_ARCHIVED",
      message: "Archived quotations cannot be reopened.",
    });
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Determine buyer role to prevent cross-role price leakage
  let buyerRole: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" = "CUSTOMER";
  if (existing.customer_email || existing.customer_phone) {
    const { rows: buyerRows } = await pg.raw(
      `SELECT p.role, p.status
       FROM customer c
       JOIN account_profile p ON (p.customer_id = c.id OR p.id = c.id)
       WHERE (lower(c.email) = ? OR c.phone = ?) AND p.deleted_at IS NULL LIMIT 1`,
      [(existing.customer_email || "").toLowerCase().trim(), (existing.customer_phone || "").trim()]
    );
    if (buyerRows.length > 0 && buyerRows[0].status === "ACTIVE") {
      buyerRole = buyerRows[0].role as any;
    }
  }

  const rawItems = (body.items ?? existing.items ?? []) as any[];
  const skus = rawItems.map((i: any) => i.sku);
  const { rows: catalogRows } = await pg.raw(
    `SELECT sku, product_name, category, customer_price_inr, dealer_price_inr, distributor_price_inr, gst_rate, route, is_quote_only 
     FROM dms_product_import_row 
     WHERE sku = ANY(?::text[])`,
    [skus]
  );
  const catalogBySku = new Map<string, any>(catalogRows.map((r: any) => [r.sku, r]));

  let nextSubtotal = 0;
  let nextTax = 0;
  const verifiedItems: any[] = [];
  const nextStatus = body.status ?? existing.status;

  for (const it of rawItems) {
    const cat = catalogBySku.get(it.sku);
    const unitPrice = Number(it.unitPriceInr || 0);
    const qty = Number(it.quantity || 1);

    // Cross-role price leakage prevention
    if (buyerRole === "CUSTOMER" && cat) {
      if (
        (cat.dealer_price_inr && unitPrice < cat.customer_price_inr && unitPrice <= cat.dealer_price_inr) ||
        (cat.distributor_price_inr && unitPrice <= cat.distributor_price_inr)
      ) {
        return res.status(400).json({
          code: "PRICE_ROLE_LEAKAGE",
          message: `Cross-role price leakage blocked: Retail customer cannot be quoted wholesale dealer/distributor price for SKU '${it.sku}'. Authorized customer price is ₹${cat.customer_price_inr}.`,
        });
      }
    } else if (buyerRole === "DEALER" && cat) {
      if (cat.distributor_price_inr && unitPrice <= cat.distributor_price_inr) {
        return res.status(400).json({
          code: "PRICE_ROLE_LEAKAGE",
          message: `Cross-role price leakage blocked: Dealer cannot be quoted distributor stock purchase price for SKU '${it.sku}'.`,
        });
      }
    }

    // Verified SKU-specific GST rate calculation
    let verifiedGstRate: number | null = null;
    if (typeof it.gstRate === "number") {
      verifiedGstRate = it.gstRate;
    } else if (cat && cat.gst_rate !== null && !isNaN(Number(cat.gst_rate))) {
      verifiedGstRate = Number(cat.gst_rate);
    }

    if (nextStatus === "SHARED_NONPAYABLE" && (verifiedGstRate === null || isNaN(verifiedGstRate))) {
      return res.status(400).json({
        code: "UNVERIFIED_TAX_DATA",
        message: `SKU '${it.sku}' has unverified tax data. Quotation cannot be issued to customer without verified SKU-specific GST rate. Blanket 18% assumption is strictly prohibited.`,
      });
    }

    const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
    const lineTax = verifiedGstRate !== null ? Math.round(lineSubtotal * (verifiedGstRate / 100) * 100) / 100 : 0;

    nextSubtotal += lineSubtotal;
    nextTax += lineTax;

    verifiedItems.push({
      ...it,
      name: it.name || cat?.product_name || it.sku,
      gstRate: verifiedGstRate,
      lineSubtotalInr: lineSubtotal,
      lineTaxInr: lineTax,
      lineTotalInr: lineSubtotal + lineTax,
      taxStatus: verifiedGstRate !== null ? "VERIFIED" : "UNVERIFIED",
    });
  }

  nextSubtotal = Math.round(nextSubtotal);
  nextTax = Math.round(nextTax);
  const nextTotal = nextSubtotal + nextTax;

  const nextRevisionNum = Number(existing.revision || 1) + 1;
  const prevHistory = Array.isArray(existing.revisions) ? existing.revisions : [];

  const updated = await dmsService.updateTradeQuotes({
    id: existing.id,
    status: nextStatus,
    revision: nextRevisionNum,
    subtotal_inr: nextSubtotal,
    tax_inr: nextTax,
    total_inr: nextTotal,
    ...(body.valid_until !== undefined
      ? { valid_until: body.valid_until ? new Date(body.valid_until) : null }
      : {}),
    ...(body.assigned_staff_email !== undefined
      ? { assigned_staff_email: body.assigned_staff_email }
      : {}),
    ...(body.seller_id !== undefined ? { seller_id: body.seller_id } : {}),
    ...(body.seller_name !== undefined ? { seller_name: body.seller_name } : {}),
    ...(body.seller_type !== undefined ? { seller_type: body.seller_type } : {}),
    ...(body.customer_notes !== undefined ? { customer_notes: body.customer_notes } : {}),
    ...(body.internal_notes !== undefined ? { internal_notes: body.internal_notes } : {}),
    items: verifiedItems as unknown as Record<string, unknown>,
    revisions: [
      ...prevHistory,
      {
        revision: nextRevisionNum,
        status: nextStatus,
        subtotal_inr: nextSubtotal,
        tax_inr: nextTax,
        total_inr: nextTotal,
        items: verifiedItems,
        actor_email: req.staff_user?.email || "admin@sai-ajanta.com",
        updated_at: new Date().toISOString(),
        note: body.revision_note || `Updated to revision #${nextRevisionNum} (${nextStatus})`,
      },
    ] as unknown as Record<string, unknown>,
  });

  // If quote is issued (SHARED_NONPAYABLE) and linked to an enquiry:
  if (existing.enquiry_id && nextStatus === "SHARED_NONPAYABLE" && existing.status !== "SHARED_NONPAYABLE") {
    await pg.raw(
      `UPDATE dms_trade_enquiry SET status = 'QUOTED', updated_at = now() WHERE id = ?`,
      [existing.enquiry_id]
    );
    const actId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    await pg.raw(
      `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, from_status, to_status, actor_id, actor_email, notes, created_at)
       VALUES (?, ?, 'QUOTE_SENT', ?, 'QUOTED', ?, ?, ?, now())`,
      [actId, existing.enquiry_id, existing.status, req.staff_user?.id || "admin", req.staff_user?.email || "admin@sai-ajanta.com", `Quotation ${existing.quote_number} issued and sent to customer (Rev #${nextRevisionNum})`]
    );
  }

  await recordDurableAuditEvent(
    req,
    "QUOTE_UPDATED",
    `quote:${existing.quote_number}`,
    {
      quoteNumber: existing.quote_number,
      revision: nextRevisionNum,
      status: nextStatus,
      subtotalInr: nextSubtotal,
      taxInr: nextTax,
      totalInr: nextTotal,
      actor: req.staff_user?.email || "admin@sai-ajanta.com",
    },
    { required: true }
  );

  return res.json({
    quote: updated,
    verifiedGstApplied: true,
    subtotalInr: nextSubtotal,
    taxInr: nextTax,
    totalInr: nextTotal,
  });
}
