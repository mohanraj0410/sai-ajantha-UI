import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { applyCatalogStockChanges } from "../../../../../lib/inventory";
import {
  RawTradeOrder,
  RawTradePayment,
  serializeTradeOrder,
  TradeOrderEventRecord,
  TradeOrderItemRecord,
} from "../../../../../lib/order-serializer";
import { checkStaffPermission } from "../../../../../lib/permissions";
import {
  parseRequestBody,
  UpdateOrderStatusSchema,
} from "../../../../../lib/validation/schemas";
import { DMS_MODULE } from "../../../../../modules/dms";
import DmsModuleService from "../../../../../modules/dms/services";

const ALLOWED_ORDER_STATUSES = new Set([
  "PENDING_PAYMENT",
  "BOQ_QUOTE_REQUESTED",
  "CONFIRMED_TRADE_PO",
  "CONFIRMED",
  "PROCESSING",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "PAYMENT_FAILED",
]);

async function findOrder(
  dmsService: DmsModuleService,
  idOrNumber: string
): Promise<RawTradeOrder | null> {
  const byId = (await dmsService.listTradeOrders({
    id: idOrNumber,
  })) as unknown as RawTradeOrder[];
  if (byId[0]) return byId[0];

  const byNum = (await dmsService.listTradeOrders({
    order_number: idOrNumber,
  })) as unknown as RawTradeOrder[];
  return byNum[0] || null;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const order = await findOrder(dmsService, req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }
  const payments = (await dmsService.listTradePayments({
    order_id: order.id,
  })) as unknown as RawTradePayment[];

  return res.json({
    order: serializeTradeOrder(order, payments),
  });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const existing = await findOrder(dmsService, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Order not found." });
  }

  const validation = parseRequestBody(UpdateOrderStatusSchema, req.body);
  if (!validation.success) {
    return res.status(400).json(validation.envelope);
  }

  const body = (req.body || {}) as {
    action?: string;
    reason?: string;
    status?: string;
    paymentStatus?: string;
    shippingCarrier?: string | null;
    trackingReference?: string | null;
    refundStatus?: string;
    eventNote?: string;
    actorName?: string;
    routingStatus?: string;
    assignedDistributorId?: string;
    assignedDistributorName?: string;
    assignedDealerId?: string;
    assignedDealerName?: string;
  };

  const now = new Date().toISOString();
  const existingEvents = Array.isArray(existing.events)
    ? (existing.events as TradeOrderEventRecord[])
    : [];

  if (body.action === "CANCEL") {
    if (["DISPATCHED", "DELIVERED", "CANCELLED"].includes(existing.status)) {
      return res.status(400).json({
        message: `Order in ${existing.status} state cannot be cancelled online.`,
      });
    }
    const reason = (body.reason || "Cancelled by administrator").trim();
    const nextRefundStatus =
      existing.payment_status === "PAID" ? "REFUND_REQUESTED" : "NONE";

    const shouldRestoreStock =
      existing.status !== "PENDING_PAYMENT" &&
      existing.status !== "PAYMENT_FAILED";

    if (shouldRestoreStock && Array.isArray(existing.items)) {
      const items = existing.items as TradeOrderItemRecord[];
      await applyCatalogStockChanges(
        req.scope,
        items.map((item) => ({
          productId: item.product_id,
          name: item.name,
          units:
            Math.max(1, item.quantity) * Math.max(1, item.pack_multiplier || 1),
        })),
        { mode: "adjust" }
      );
    }

    const updated = (await dmsService.updateTradeOrders({
      id: existing.id,
      status: "CANCELLED",
      cancellation_reason: reason,
      refund_status: nextRefundStatus,
      events: [
        ...existingEvents,
        {
          id: `evt-${crypto.randomUUID()}`,
          order_id: existing.id,
          status: "CANCELLED",
          note:
            nextRefundStatus === "REFUND_REQUESTED"
              ? `Order cancelled (${reason}). Refund queued for Razorpay settlement.`
              : `Order cancelled (${reason}).`,
          actor_name: body.actorName || "Admin",
          created_at: now,
        },
      ] as unknown as Record<string, unknown>,
    })) as unknown as RawTradeOrder;

    await recordDurableAuditEvent(req, "ORDER_CANCEL", `order:${existing.id}`, {
      id: existing.id,
      orderNumber: existing.order_number,
      status: "CANCELLED",
      refundStatus: nextRefundStatus,
      reason,
    });

    return res.json({
      ok: true,
      status: "CANCELLED",
      refundStatus: nextRefundStatus,
      order: serializeTradeOrder(updated),
    });
  }

  const nextStatus = body.status
    ? body.status.toUpperCase()
    : existing.status;

  if (!ALLOWED_ORDER_STATUSES.has(nextStatus)) {
    return res.status(400).json({ message: "Invalid order status." });
  }

  const nextPaymentStatus = body.paymentStatus
    ? body.paymentStatus.toUpperCase()
    : existing.payment_status;

  const shippingCarrier =
    body.shippingCarrier !== undefined
      ? (body.shippingCarrier || "").trim() || null
      : (existing.shipping_carrier ?? null);

  const trackingReference =
    body.trackingReference !== undefined
      ? (body.trackingReference || "").trim() || null
      : (existing.tracking_reference ?? null);

  const refundStatus = body.refundStatus
    ? body.refundStatus.toUpperCase()
    : existing.refund_status;

  const note =
    (body.eventNote || "").trim() ||
    `Status updated to ${nextStatus}${
      trackingReference
        ? ` (Ref: ${shippingCarrier || "Courier"} ${trackingReference})`
        : ""
    }.`;

  const updatedItems = Array.isArray(existing.items)
    ? (existing.items as any[]).map((itm) => ({
        ...itm,
        routing_status: body.routingStatus || itm.routing_status,
        assigned_distributor_id:
          body.assignedDistributorId !== undefined
            ? body.assignedDistributorId
            : itm.assigned_distributor_id,
        assigned_distributor_name:
          body.assignedDistributorName !== undefined
            ? body.assignedDistributorName
            : itm.assigned_distributor_name,
        assigned_dealer_id:
          body.assignedDealerId !== undefined
            ? body.assignedDealerId
            : itm.assigned_dealer_id,
        assigned_dealer_name:
          body.assignedDealerName !== undefined
            ? body.assignedDealerName
            : itm.assigned_dealer_name,
      }))
    : existing.items;

  const updated = (await dmsService.updateTradeOrders({
    id: existing.id,
    status: nextStatus,
    payment_status: nextPaymentStatus,
    shipping_carrier: shippingCarrier,
    tracking_reference: trackingReference,
    refund_status: refundStatus,
    items: updatedItems as unknown as Record<string, unknown>,
    events: [
      ...existingEvents,
      {
        id: `evt-${crypto.randomUUID()}`,
        order_id: existing.id,
        status: nextStatus,
        note,
        actor_name: body.actorName || "Admin",
        created_at: now,
      },
    ] as unknown as Record<string, unknown>,
  })) as unknown as RawTradeOrder;

  const payments = (await dmsService.listTradePayments({
    order_id: existing.id,
  })) as unknown as RawTradePayment[];

  await recordDurableAuditEvent(req, "ORDER_UPDATE", `order:${existing.id}`, {
    id: existing.id,
    orderNumber: existing.order_number,
    status: nextStatus,
    paymentStatus: nextPaymentStatus,
    action: body.action,
  });

  return res.json({
    order: serializeTradeOrder(updated, payments),
  });
}
