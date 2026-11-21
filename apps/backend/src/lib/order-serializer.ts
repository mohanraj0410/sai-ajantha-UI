export interface TradeOrderEventRecord {
  id: string;
  order_id: string;
  status: string;
  note: string;
  actor_name: string;
  created_at: string;
}

export interface TradeOrderItemRecord {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  category: string;
  finish: string | null;
  pack_label: string | null;
  pack_multiplier: number;
  unit_price_inr: number | null;
  quantity: number;
  line_total_inr: number | null;
}

export interface RawTradeOrder {
  id: string;
  order_number: string;
  customer_id: string;
  role_at_order: string;
  price_tier_applied: string;
  status: string;
  payment_status: string;
  payment_method: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  organization: string;
  gstin?: string | null;
  shipping_address: string;
  subtotal_inr: number;
  gst_amount_inr: number;
  total_inr: number;
  subtotal_paise?: number | null;
  gst_amount_paise?: number | null;
  total_paise?: number | null;
  has_quote_items: boolean;
  shipping_carrier?: string | null;
  tracking_reference?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  refund_status: string;
  fulfillment_type?: string;
  is_direct_sai_ajanta?: boolean;
  return_status?: string;
  damaged_qty?: number;
  damage_claim_status?: string;
  damage_notes?: string | null;
  shipment_failure_reason?: string | null;
  delivery_attempts?: number;
  items: unknown;
  events: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface RawTradePayment {
  id: string;
  order_id: string;
  provider: string;
  provider_order_id: string;
  provider_payment_id?: string | null;
  signature_verified: boolean;
  amount_paise: number;
  currency: string;
  status: string;
  failure_reason?: string | null;
  raw_event_json?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(val: Date | string): string {
  return val instanceof Date ? val.toISOString() : String(val);
}

export function serializeTradePayment(
  payment: RawTradePayment,
  order?: { order_number?: string; customer_name?: string }
) {
  return {
    id: payment.id,
    order_id: payment.order_id,
    order_number: order?.order_number || "",
    customer_name: order?.customer_name || "",
    provider: payment.provider,
    provider_order_id: payment.provider_order_id,
    provider_payment_id: payment.provider_payment_id ?? null,
    signature_verified: payment.signature_verified ? 1 : 0,
    amount_paise: payment.amount_paise,
    currency: payment.currency,
    status: payment.status,
    failure_reason: payment.failure_reason ?? null,
    raw_event_json: payment.raw_event_json ?? null,
    created_at: toIso(payment.created_at),
    updated_at: toIso(payment.updated_at),
  };
}

export function serializeTradeOrder(
  order: RawTradeOrder,
  payments?: RawTradePayment[]
) {
  const items = Array.isArray(order.items) ? order.items : [];
  const events = Array.isArray(order.events) ? order.events : [];

  return {
    id: order.id,
    order_number: order.order_number,
    user_id: order.customer_id,
    role_at_order: order.role_at_order,
    price_tier_applied: order.price_tier_applied,
    status: order.status,
    payment_status: order.payment_status,
    payment_method: order.payment_method,
    bank_reference: (order as any).bank_reference ?? null,
    razorpay_order_id: order.razorpay_order_id ?? null,
    razorpay_payment_id: order.razorpay_payment_id ?? null,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    organization: order.organization,
    gstin: order.gstin ?? null,
    shipping_address: order.shipping_address,
    subtotal_inr: order.subtotal_inr,
    gst_amount_inr: order.gst_amount_inr,
    total_inr: order.total_inr,
    subtotal_paise: order.subtotal_paise ?? Math.round(order.subtotal_inr * 100),
    gst_amount_paise: order.gst_amount_paise ?? Math.round(order.gst_amount_inr * 100),
    total_paise: order.total_paise ?? Math.round(order.total_inr * 100),
    has_quote_items: order.has_quote_items ? 1 : 0,
    shipping_carrier: order.shipping_carrier ?? null,
    tracking_reference: order.tracking_reference ?? null,
    notes: order.notes ?? null,
    cancellation_reason: order.cancellation_reason ?? null,
    refund_status: order.refund_status,
    fulfillment_type: order.fulfillment_type || "DELIVERY",
    is_direct_sai_ajanta: order.is_direct_sai_ajanta ?? true,
    return_status: order.return_status || "NONE",
    damaged_qty: order.damaged_qty ?? 0,
    damage_claim_status: order.damage_claim_status || "NONE",
    damage_notes: order.damage_notes ?? null,
    shipment_failure_reason: order.shipment_failure_reason ?? null,
    delivery_attempts: order.delivery_attempts ?? 1,
    created_at: toIso(order.created_at),
    updated_at: toIso(order.updated_at),
    items,
    events,
    ...(payments
      ? {
          payments: payments.map((p) =>
            serializeTradePayment(p, {
              order_number: order.order_number,
              customer_name: order.customer_name,
            })
          ),
        }
      : {}),
  };
}
