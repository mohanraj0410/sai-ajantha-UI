import { model } from "@medusajs/framework/utils";

const TradePromoDraft = model.define("dms_trade_promo_draft", {
  id: model.id({ prefix: "prm" }).primaryKey(),
  code: model.text().unique(),
  title: model.text(),
  target_tier: model.text().default("DEALER"), // CUSTOMER | DEALER | DISTRIBUTOR
  category_scope: model.text().default("ALL"),
  discount_percent: model.number().default(0),
  valid_from: model.dateTime().nullable(),
  valid_until: model.dateTime().nullable(),
  status: model.text().default("DRAFT"), // DRAFT | PENDING_APPROVAL | ARCHIVED (never auto-applies at checkout)
  internal_notes: model.text().default(""),
  created_by_id: model.text().nullable(),
});

export default TradePromoDraft;
