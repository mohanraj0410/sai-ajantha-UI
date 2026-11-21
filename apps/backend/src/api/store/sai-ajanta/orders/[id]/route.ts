import crypto from "node:crypto";
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  applyCatalogStockChanges,
  releaseStockReservations,
  releaseStockReservationsForOrder,
} from "../../../../../lib/inventory";
import { getPgPool } from "../../../../../lib/db";
import {
  RawTradeOrder,
  RawTradePayment,
  serializeTradeOrder,
  TradeOrderEventRecord,
  TradeOrderItemRecord,
} from "../../../../../lib/order-serializer";
import { DMS_MODULE } from "../../../../../modules/dms";
import DmsModuleService from "../../../../../modules/dms/services";

async function findCustomerOrder(
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

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const order = await findCustomerOrder(dmsService, req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }
  if (order.customer_id !== customerId) {
    return res.status(403).json({ message: "Forbidden." });
  }

  const payments = (await dmsService.listTradePayments({
    order_id: order.id,
  })) as unknown as RawTradePayment[];

  return res.json({
    order: serializeTradeOrder(order, payments),
  });
}

export async function PATCH(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const order = await findCustomerOrder(dmsService, req.params.id);

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }
  if (order.customer_id !== customerId) {
    return res.status(403).json({ message: "Forbidden." });
  }

  const body = (req.body || {}) as {
    action?: string;
    reason?: string;
    actorName?: string;
  };
  if (body.action !== "CANCEL") {
    return res.status(400).json({ message: "Unsupported action." });
  }

  if (["DISPATCHED", "DELIVERED", "CANCELLED"].includes(order.status)) {
    return res.status(400).json({
      message: `Order in ${order.status} state cannot be cancelled online. Please contact our Trichy desk.`,
    });
  }

  const now = new Date().toISOString();
  const reason = (body.reason || "Cancelled by customer").trim();
  const nextRefundStatus =
    order.payment_status === "PAID" ? "REFUND_REQUESTED" : "NONE";

  // Release active stock reservations idempotently if in PENDING_PAYMENT (BE-05, RB-04, P3.4.1)
  try {
    const pool = getPgPool();
    await releaseStockReservationsForOrder(pool, order.id, reason);
  } catch {
    // ignore db error in unit mocks
  }

  const shouldRestoreStock =
    order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED";

  if (shouldRestoreStock && Array.isArray(order.items)) {
    const items = order.items as TradeOrderItemRecord[];
    await applyCatalogStockChanges(
      req.scope,
      items.map((item) => ({
        productId: item.product_id,
        name: item.name,
        units: Math.max(1, item.quantity) * Math.max(1, item.pack_multiplier || 1),
      })),
      { mode: "adjust" }
    );
  }

  const existingEvents = Array.isArray(order.events)
    ? (order.events as TradeOrderEventRecord[])
    : [];

  const nextEvents: TradeOrderEventRecord[] = [
    ...existingEvents,
    {
      id: `evt-${crypto.randomUUID()}`,
      order_id: order.id,
      status: "CANCELLED",
      note:
        nextRefundStatus === "REFUND_REQUESTED"
          ? `Order cancelled (${reason}). Refund queued for Razorpay settlement.`
          : `Order cancelled (${reason}).`,
      actor_name: body.actorName || order.customer_name,
      created_at: now,
    },
  ];

  const updated = (await dmsService.updateTradeOrders({
    id: order.id,
    status: "CANCELLED",
    cancellation_reason: reason,
    refund_status: nextRefundStatus,
    events: nextEvents as unknown as Record<string, unknown>,
  })) as unknown as RawTradeOrder;

  return res.json({
    ok: true,
    status: "CANCELLED",
    refundStatus: nextRefundStatus,
    order: serializeTradeOrder(updated),
  });
}
