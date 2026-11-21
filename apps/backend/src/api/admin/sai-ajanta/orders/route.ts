import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { inrToPaise } from "../../../../lib/money";
import {
  RawTradeOrder,
  RawTradePayment,
  serializeTradeOrder,
} from "../../../../lib/order-serializer";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const [orders, payments] = (await Promise.all([
    dmsService.listTradeOrders({}, { take: null }),
    dmsService.listTradePayments({}, { take: null }),
  ])) as [RawTradeOrder[], RawTradePayment[]];

  orders.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const byOrder = new Map<string, RawTradePayment[]>();
  for (const p of payments) {
    const arr = byOrder.get(p.order_id) || [];
    arr.push(p);
    byOrder.set(p.order_id, arr);
  }

  return res.json({
    orders: orders.map((o) => serializeTradeOrder(o, byOrder.get(o.id))),
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const body = (req.body || {}) as {
    orderNumber?: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerCity?: string;
    totalAmount?: number;
    itemsSummary?: string;
    type?: string;
    status?: string;
    isManufactured?: boolean;
    routingStatus?: string;
    assignedDistributorId?: string;
    assignedDistributorName?: string;
    assignedDealerId?: string;
    assignedDealerName?: string;
    notes?: string;
    fulfillmentType?: string;
    isDirectSaiAjanta?: boolean;
    cancellationReason?: string;
    returnStatus?: string;
    damagedQty?: number;
    damageClaimStatus?: string;
    shipmentFailureReason?: string;
  };

  const orderNumber =
    body.orderNumber || `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const totalAmount = Number(body.totalAmount || 50000);
  const subtotal = Math.round(totalAmount / 1.18);
  const gst = totalAmount - subtotal;
  const isMfg = Boolean(body.isManufactured);
  const routingStatus =
    body.routingStatus || (isMfg ? "PENDING_DISTRIBUTOR" : "DIRECT_FULFILLMENT");

  const created = (await dmsService.createTradeOrders({
    order_number: orderNumber,
    customer_id: body.customerId || `cust-${Date.now()}`,
    customer_name: body.customerName || "Trade Customer",
    customer_email: body.customerEmail || "customer@example.com",
    customer_phone: body.customerPhone || "+91 98424 00000",
    role_at_order: "DEALER",
    price_tier_applied: "DEALER",
    status: body.status || "PROCESSING",
    payment_status: "PENDING_OFFLINE_SETTLEMENT",
    payment_method: "BANK_TRANSFER",
    shipping_address: body.customerCity || "Trichy",
    subtotal_inr: subtotal,
    gst_amount_inr: gst,
    total_inr: totalAmount,
    subtotal_paise: inrToPaise(subtotal),
    gst_amount_paise: inrToPaise(gst),
    total_paise: inrToPaise(totalAmount),
    fulfillment_type: body.fulfillmentType || "DELIVERY",
    is_direct_sai_ajanta: body.isDirectSaiAjanta ?? true,
    return_status: body.returnStatus || "NONE",
    damaged_qty: body.damagedQty || 0,
    damage_claim_status: body.damageClaimStatus || "NONE",
    shipment_failure_reason: body.shipmentFailureReason || null,
    cancellation_reason: body.cancellationReason || null,
    notes: body.notes || (isMfg ? "MANUFACTURED_ALUMINIUM" : "GENERAL_HARDWARE"),
    items: [
      {
        product_id: `prod-${Date.now()}`,
        name: body.itemsSummary || "Consignment Items",
        quantity: 1,
        unit_price_inr: totalAmount,
        line_total_inr: totalAmount,
        is_manufactured: isMfg,
        routing_status: routingStatus,
        assigned_distributor_id: body.assignedDistributorId || null,
        assigned_distributor_name: body.assignedDistributorName || null,
        assigned_dealer_id: body.assignedDealerId || null,
        assigned_dealer_name: body.assignedDealerName || null,
      },
    ] as unknown as Record<string, unknown>,
    events: [
      {
        id: `evt-${Date.now()}`,
        status: body.status || "PROCESSING",
        note: `Order ${orderNumber} created via Admin Portal.`,
        created_at: new Date().toISOString(),
      },
    ] as unknown as Record<string, unknown>,
  })) as unknown as RawTradeOrder;

  await recordDurableAuditEvent(req, "ADMIN_ORDER_CREATE", `order:${created.order_number}`, {
    totalAmount: created.total_inr,
    routingStatus: created.status,
  });

  return res.status(201).json({
    order: serializeTradeOrder(created),
  });
}
