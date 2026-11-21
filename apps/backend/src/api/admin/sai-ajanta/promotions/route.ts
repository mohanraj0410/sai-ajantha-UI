import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import type DmsModuleService from "../../../../modules/dms/services";

const PromoDraftSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric/-/_"),
  title: z.string().trim().min(3).max(120),
  target_tier: z.enum(["CUSTOMER", "DEALER", "DISTRIBUTOR"]),
  category_scope: z.string().trim().min(1).default("ALL"),
  discount_percent: z.number().int().min(1).max(50),
  valid_from: z.string().trim().nullable().optional(),
  valid_until: z.string().trim().nullable().optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "ARCHIVED"]).optional().default("DRAFT"),
  internal_notes: z.string().trim().optional().default(""),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const promos = (await dmsService.listTradePromoDrafts({}, { take: null })) as unknown as Record<string, any>[];
  promos.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return res.json({
    promotions: promos,
    checkoutDiscountingEnabled: false,
    policyNotice:
      "Draft & approval governance ledger only. Checkout automatic discounting stays disabled until tax snapshot and owner sign-off (DEC-002).",
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const parsed = PromoDraftSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }
  const body = parsed.data;
  const normalizedCode = body.code.toUpperCase();

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const existing = (await dmsService.listTradePromoDrafts({}, { take: null })) as unknown as Record<string, any>[];

  if (existing.some((p) => String(p.code).toUpperCase() === normalizedCode)) {
    return res.status(409).json({
      code: "DUPLICATE_PROMO_CODE",
      message: `Promotion draft code "${normalizedCode}" already exists.`,
    });
  }

  const overlapWarning = existing.some(
    (p) =>
      p.status !== "ARCHIVED" &&
      p.target_tier === body.target_tier &&
      p.category_scope === body.category_scope
  );

  const created = await dmsService.createTradePromoDrafts({
    code: normalizedCode,
    title: body.title,
    target_tier: body.target_tier,
    category_scope: body.category_scope,
    discount_percent: body.discount_percent,
    valid_from: body.valid_from ? new Date(body.valid_from) : null,
    valid_until: body.valid_until ? new Date(body.valid_until) : null,
    status: body.status === "ARCHIVED" ? "ARCHIVED" : body.status,
    internal_notes: body.internal_notes,
    created_by_id: req.staff_user?.id || null,
  });

  await recordDurableAuditEvent(
    req,
    "PROMOTION_DRAFT_CREATE",
    `promo:${normalizedCode}`,
    {
      target_tier: body.target_tier,
      discount_percent: body.discount_percent,
      overlapWarning,
    },
    { required: true }
  );

  return res.status(201).json({ promotion: created, overlapWarning });
}
