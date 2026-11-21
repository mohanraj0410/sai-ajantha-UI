import { model } from "@medusajs/framework/utils";

const TradePayment = model.define("dms_trade_payment", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  provider: model.text().default("RAZORPAY"),
  provider_order_id: model.text(),
  provider_payment_id: model.text().nullable(),
  signature_verified: model.boolean().default(false),
  amount_paise: model.number(),
  currency: model.text().default("INR"),
  status: model.text().default("CREATED"),
  failure_reason: model.text().nullable(),
  raw_event_json: model.text().nullable(),
});

export default TradePayment;
