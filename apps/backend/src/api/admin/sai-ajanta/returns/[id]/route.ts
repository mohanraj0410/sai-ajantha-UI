import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { RawTradeOrder, serializeTradeOrder, TradeOrderEventRecord } from "../../../../../lib/order-serializer";
import { checkStaffPermission } from "../../../../../lib/permissions";
import { DMS_MODULE } from "../../../../../modules/dms";
import type DmsModuleService from "../../../../../modules/dms/services";

const ReturnInspectionSchema = z.object({
  return_status: z.enum(["NONE", "REQUESTED", "RETURNED", "INSPECTED"]).optional(),
  damage_claim_status: z.enum(["NONE", "REPORTED", "VERIFIED", "REPLACED"]).optional(),
  damaged_qty: z.number().int().min(0).optional(),
  damage_notes: z.string().trim().max(1000).nullable().optional(),
  refund_status: z.string().optional(),
  trigger_restock: z.boolean().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listTradeOrders({
    id: req.params.id,
  })) as unknown as RawTradeOrder[];
  if (!rows[0]) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Order not found." });
  }
  return res.json({ order: serializeTradeOrder(rows[0], []) });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }

  const parsed = ReturnInspectionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }
  const body = parsed.data;

  // Refunds & automatic stock restock are strictly gated until DEC-002 / BE-14 / Phase 03 gate
  if (body.refund_status || body.trigger_restock) {
    await recordDurableAuditEvent(
      req,
      "RETURN_REFUND_RESTOCK_BLOCKED",
      `order:${req.params.id}`,
      { requestedRefund: Boolean(body.refund_status), requestedRestock: Boolean(body.trigger_restock) },
      { outcome: "DENIED", reason: "DEC-002 / BE-14 blocks automated refund and restock" }
    );
    return res.status(403).json({
      code: "OWNER_POLICY_LOCKED",
      message:
        "Refund execution and automatic restock are blocked until merchant liability and BE-14/Phase 03 rules are approved (DEC-002).",
    });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listTradeOrders({
    id: req.params.id,
  })) as unknown as RawTradeOrder[];
  const existing = rows[0];
  if (!existing) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Order not found." });
  }

  const totalOrderedQty = Array.isArray(existing.items)
    ? (existing.items as { quantity?: number }[]).reduce(
        (sum, it) => sum + Math.max(0, Number(it.quantity || 0)),
        0
      )
    : 0;

  if (body.damaged_qty !== undefined && totalOrderedQty > 0 && body.damaged_qty > totalOrderedQty) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: `Damaged qty (${body.damaged_qty}) cannot exceed total ordered qty (${totalOrderedQty}).`,
    });
  }

  const nextReturnStatus = body.return_status ?? existing.return_status ?? "NONE";
  const nextClaimStatus = body.damage_claim_status ?? existing.damage_claim_status ?? "NONE";
  const prevEvents = Array.isArray(existing.events)
    ? (existing.events as TradeOrderEventRecord[])
    : [];

  const updated = (await dmsService.updateTradeOrders({
    id: existing.id,
    return_status: nextReturnStatus,
    damage_claim_status: nextClaimStatus,
    ...(body.damaged_qty !== undefined ? { damaged_qty: body.damaged_qty } : {}),
    ...(body.damage_notes !== undefined ? { damage_notes: body.damage_notes } : {}),
    events: [
      ...prevEvents,
      {
        id: `evt-${crypto.randomUUID()}`,
        order_id: existing.id,
        status: existing.status,
        note: `Return/Damage Inspection recorded (return=${nextReturnStatus}, claim=${nextClaimStatus}, merchant=${existing.is_direct_sai_ajanta ? "SAI_AJANTHA_DIRECT" : "DISTRIBUTOR"}).`,
        actor_name: req.staff_user?.email || "Staff",
        created_at: new Date().toISOString(),
      },
    ] as unknown as Record<string, unknown>,
  })) as unknown as RawTradeOrder;

  await recordDurableAuditEvent(
    req,
    "RETURN_INSPECTION_UPDATE",
    `order:${existing.id}`,
    {
      orderNumber: existing.order_number,
      return_status: nextReturnStatus,
      damage_claim_status: nextClaimStatus,
      damaged_qty: body.damaged_qty ?? existing.damaged_qty,
      is_direct_sai_ajanta: existing.is_direct_sai_ajanta,
    },
    { required: true }
  );

  return res.json({ order: serializeTradeOrder(updated) });
}
