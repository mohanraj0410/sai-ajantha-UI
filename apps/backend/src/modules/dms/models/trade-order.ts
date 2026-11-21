import { model } from "@medusajs/framework/utils";

const TradeOrder = model.define("dms_trade_order", {
  id: model.id().primaryKey(),
  order_number: model.text().unique(),
  customer_id: model.text(),
  role_at_order: model.text(),
  price_tier_applied: model.text(),
  status: model.text(),
  payment_status: model.text(),
  payment_method: model.text(),
  razorpay_order_id: model.text().nullable(),
  razorpay_payment_id: model.text().nullable(),
  customer_name: model.text(),
  customer_email: model.text(),
  customer_phone: model.text(),
  organization: model.text().default(""),
  gstin: model.text().nullable(),
  shipping_address: model.text(),
  subtotal_inr: model.float(),
  gst_amount_inr: model.float(),
  total_inr: model.float(),
  subtotal_paise: model.number().nullable(),
  gst_amount_paise: model.number().nullable(),
  total_paise: model.number().nullable(),
  has_quote_items: model.boolean().default(false),
  shipping_carrier: model.text().nullable(),
  tracking_reference: model.text().nullable(),
  notes: model.text().nullable(),
  cancellation_reason: model.text().nullable(),
  refund_status: model.text().default("NONE"),
  fulfillment_type: model.text().default("DELIVERY"), // "DELIVERY" | "PICKUP"
  is_direct_sai_ajanta: model.boolean().default(true), // Direct Sai Ajantha Central Logistics vs Distributor/Dealer
  return_status: model.text().default("NONE"), // "NONE" | "REQUESTED" | "RETURNED" | "INSPECTED"
  damaged_qty: model.number().default(0),
  damage_claim_status: model.text().default("NONE"), // "NONE" | "REPORTED" | "VERIFIED" | "REPLACED"
  damage_notes: model.text().nullable(),
  shipment_failure_reason: model.text().nullable(),
  delivery_attempts: model.number().default(1),
  items: model.json(),
  events: model.json(),
});

export default TradeOrder;
