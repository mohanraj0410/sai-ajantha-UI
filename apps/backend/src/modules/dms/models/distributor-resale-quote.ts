import { model } from "@medusajs/framework/utils";

const DistributorResaleQuote = model.define("dms_distributor_resale_quote", {
  id: model.id({ prefix: "drsq" }).primaryKey(),
  quote_number: model.text().unique(),
  distributor_id: model.text().index(),
  buyer_id: model.text().index(),
  buyer_role: model.text(), // DEALER | CUSTOMER
  buyer_name: model.text(),
  buyer_email: model.text(),
  buyer_phone: model.text(),
  postal_code: model.text(),
  items: model.json(),
  subtotal_paise: model.number().default(0),
  gst_amount_paise: model.number().default(0),
  total_paise: model.number().default(0),
  status: model.text().default("REQUESTED"), // REQUESTED | PRICE_QUOTED | ACCEPTED | DECLINED | EXPIRED
  is_quote_only: model.boolean().default(true),
});

export default DistributorResaleQuote;
