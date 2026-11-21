import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import type DmsModuleService from "../../../../modules/dms/services";

const QuoteLineSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPriceInr: z.number().nonnegative(),
  gstRate: z.number().nonnegative().nullable().optional(),
});

const CreateQuoteSchema = z.object({
  enquiry_id: z.string().trim().nullable().optional(),
  customer_name: z.string().trim().min(2, "Customer or firm name is required."),
  customer_email: z.string().trim().email("Valid email is required.").optional().or(z.literal("")),
  customer_phone: z.string().trim().optional().default(""),
  postal_code: z.string().trim().optional().default(""),
  organization: z.string().trim().optional().default(""),
  division: z.string().trim().min(1).default("Custom BOQ / Hardware"),
  valid_until: z.string().trim().nullable().optional(),
  items: z.array(QuoteLineSchema).min(1, "Add at least one quoted SKU or BOQ line."),
  customer_notes: z.string().trim().optional().default(""),
  internal_notes: z.string().trim().optional().default(""),
  status: z.enum(["DRAFT", "REVIEWED", "SHARED_NONPAYABLE"]).optional().default("DRAFT"),
  seller_id: z.string().trim().optional().default("SAI_AJANTHA_CENTRAL"),
  seller_name: z.string().trim().optional().default("Sai Ajantha Central"),
  seller_type: z.string().trim().optional().default("DIRECT"),
  is_service_quote: z.boolean().optional().default(false),
  contractor_id: z.string().trim().nullable().optional(),
  contractor_name: z.string().trim().nullable().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listTradeQuotes({}, { take: null })) as unknown as Record<string, any>[];
  rows.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return res.json({
    quotes: rows,
    nonpayableNotice: "Nonpayable BOQ quotations only — never generates Razorpay capture or paid order status.",
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const parsed = CreateQuoteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }
  const body = parsed.data;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // 1. Audit quotation price selection & prevent cross-role price leakage
  let buyerRole: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" = "CUSTOMER";
  if (body.customer_email || body.customer_phone) {
    const { rows: buyerRows } = await pg.raw(
      `SELECT p.role, p.status
       FROM customer c
       JOIN account_profile p ON (p.customer_id = c.id OR p.id = c.id)
       WHERE (lower(c.email) = ? OR c.phone = ?) AND p.deleted_at IS NULL LIMIT 1`,
      [(body.customer_email || "").toLowerCase().trim(), (body.customer_phone || "").trim()]
    );
    if (buyerRows.length > 0 && buyerRows[0].status === "ACTIVE") {
      buyerRole = buyerRows[0].role as any;
    }
  }

  // Look up catalog details for each SKU in dms_product_import_row
  const skus = body.items.map((i) => i.sku);
  const { rows: catalogRows } = await pg.raw(
    `SELECT sku, product_name, category, customer_price_inr, dealer_price_inr, distributor_price_inr, gst_rate, route, is_quote_only 
     FROM dms_product_import_row 
     WHERE sku = ANY(?::text[])`,
    [skus]
  );
  const catalogBySku = new Map<string, any>(catalogRows.map((r: any) => [r.sku, r]));

  let subtotalInr = 0;
  let taxInr = 0;
  const verifiedItems: any[] = [];

  for (const it of body.items) {
    const cat = catalogBySku.get(it.sku);

    // Cross-role price leakage prevention:
    // Retail customers cannot receive dealer wholesale or distributor wholesale prices
    if (buyerRole === "CUSTOMER" && cat) {
      if (
        (cat.dealer_price_inr && it.unitPriceInr < cat.customer_price_inr && it.unitPriceInr <= cat.dealer_price_inr) ||
        (cat.distributor_price_inr && it.unitPriceInr <= cat.distributor_price_inr)
      ) {
        return res.status(400).json({
          code: "PRICE_ROLE_LEAKAGE",
          message: `Cross-role price leakage blocked: Retail customer cannot be quoted wholesale dealer/distributor price for SKU '${it.sku}'. Authorized customer price is ₹${cat.customer_price_inr}.`,
        });
      }
    } else if (buyerRole === "DEALER" && cat) {
      if (cat.distributor_price_inr && it.unitPriceInr <= cat.distributor_price_inr) {
        return res.status(400).json({
          code: "PRICE_ROLE_LEAKAGE",
          message: `Cross-role price leakage blocked: Dealer cannot be quoted distributor stock purchase price for SKU '${it.sku}'.`,
        });
      }
    }

    // Verified SKU-specific GST rate calculation
    // All four price tiers are GST-exclusive.
    let verifiedGstRate: number | null = null;
    if (typeof it.gstRate === "number") {
      verifiedGstRate = it.gstRate;
    } else if (cat && cat.gst_rate !== null && !isNaN(Number(cat.gst_rate))) {
      verifiedGstRate = Number(cat.gst_rate);
    }

    // If quotation is being issued (SHARED_NONPAYABLE), missing tax data must block confirmation
    if (body.status === "SHARED_NONPAYABLE" && (verifiedGstRate === null || isNaN(verifiedGstRate))) {
      return res.status(400).json({
        code: "UNVERIFIED_TAX_DATA",
        message: `SKU '${it.sku}' has unverified tax data. Quotation cannot be issued to customer without verified SKU-specific GST rate. Blanket 18% assumption is strictly prohibited.`,
      });
    }

    const lineSubtotal = Math.round(it.quantity * it.unitPriceInr * 100) / 100;
    const lineTax = verifiedGstRate !== null ? Math.round(lineSubtotal * (verifiedGstRate / 100) * 100) / 100 : 0;

    subtotalInr += lineSubtotal;
    taxInr += lineTax;

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

  subtotalInr = Math.round(subtotalInr);
  taxInr = Math.round(taxInr);
  const totalInr = subtotalInr + taxInr;

  const quoteNumber = `QT-2026-${crypto.randomInt(10000, 99999)}`;
  const nowIso = new Date().toISOString();

  const initialRevision = {
    revision: 1,
    status: body.status,
    subtotal_inr: subtotalInr,
    tax_inr: taxInr,
    total_inr: totalInr,
    items: verifiedItems,
    actor_email: req.staff_user?.email || "admin@sai-ajanta.com",
    updated_at: nowIso,
    note: body.status === "SHARED_NONPAYABLE" ? "Quotation issued to customer" : "Initial nonpayable quote revision created",
  };

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const created = await dmsService.createTradeQuotes({
    quote_number: quoteNumber,
    enquiry_id: body.enquiry_id || null,
    customer_name: body.customer_name,
    customer_email: body.customer_email || "",
    customer_phone: body.customer_phone || "",
    postal_code: body.postal_code || "",
    organization: body.organization || "",
    division: body.division,
    status: body.status,
    revision: 1,
    valid_until: body.valid_until ? new Date(body.valid_until) : null,
    assigned_staff_id: req.staff_user?.id || null,
    assigned_staff_email: req.staff_user?.email || null,
    seller_id: body.seller_id,
    seller_name: body.seller_name,
    seller_type: body.seller_type,
    subtotal_inr: subtotalInr,
    tax_inr: taxInr,
    total_inr: totalInr,
    is_service_quote: body.is_service_quote,
    contractor_id: body.contractor_id || null,
    contractor_name: body.contractor_name || null,
    items: verifiedItems as unknown as Record<string, unknown>,
    revisions: [initialRevision] as unknown as Record<string, unknown>,
    customer_notes: body.customer_notes,
    internal_notes: body.internal_notes,
  });

  // If linked to an enquiry, update the enquiry status and log activity
  if (body.enquiry_id) {
    const actId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    if (body.status === "SHARED_NONPAYABLE") {
      await pg.raw(
        `UPDATE dms_trade_enquiry SET status = 'QUOTED', updated_at = now() WHERE id = ?`,
        [body.enquiry_id]
      );
      await pg.raw(
        `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, from_status, to_status, actor_id, actor_email, notes, created_at)
         VALUES (?, ?, 'QUOTE_SENT', 'QUOTE_PREPARING', 'QUOTED', ?, ?, ?, now())`,
        [actId, body.enquiry_id, req.staff_user?.id || "admin", req.staff_user?.email || "admin@sai-ajanta.com", `Quotation ${quoteNumber} (${body.is_service_quote ? 'Service Quote' : 'Product Quote'}) issued and sent to customer`]
      );
    } else {
      await pg.raw(
        `UPDATE dms_trade_enquiry SET status = 'QUOTE_PREPARING', updated_at = now() WHERE id = ? AND status IN ('NEW', 'IN_REVIEW', 'AWAITING_SELLER')`,
        [body.enquiry_id]
      );
      await pg.raw(
        `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, to_status, actor_id, actor_email, notes, created_at)
         VALUES (?, ?, 'QUOTE_DRAFTED', 'QUOTE_PREPARING', ?, ?, ?, now())`,
        [actId, body.enquiry_id, req.staff_user?.id || "admin", req.staff_user?.email || "admin@sai-ajanta.com", `Draft quotation ${quoteNumber} prepared`]
      );
    }
  }

  await recordDurableAuditEvent(
    req,
    "QUOTE_CREATED",
    `quote:${quoteNumber}`,
    {
      quoteNumber,
      enquiryId: body.enquiry_id || null,
      subtotalInr,
      taxInr,
      totalInr,
      sellerId: body.seller_id,
      status: body.status,
      buyerRole,
    },
    { required: true }
  );

  return res.status(201).json({
    quote: created,
    quoteNumber,
    verifiedGstApplied: true,
    subtotalInr,
    taxInr,
    totalInr,
  });
}
