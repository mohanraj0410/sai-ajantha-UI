import { model } from "@medusajs/framework/utils";

const TradeQuote = model.define("dms_trade_quote", {
  id: model.id({ prefix: "qt" }).primaryKey(),
  quote_number: model.text().unique(),
  enquiry_id: model.text().index().nullable(),
  customer_name: model.text(),
  customer_email: model.text().default(""),
  customer_phone: model.text().default(""),
  postal_code: model.text().default(""),
  organization: model.text().default(""),
  division: model.text().default("General Quotation"),
  status: model.text().default("DRAFT"), // DRAFT | REVIEWED | SHARED_NONPAYABLE | ACCEPTED | REJECTED | REVISION_REQUESTED | CONVERTED_TO_ORDER | EXPIRED | ARCHIVED
  revision: model.number().default(1),
  valid_until: model.dateTime().nullable(),
  assigned_staff_id: model.text().nullable(),
  assigned_staff_email: model.text().nullable(),
  seller_id: model.text().nullable(),
  seller_name: model.text().nullable(),
  seller_type: model.text().nullable(),
  subtotal_inr: model.number().default(0),
  tax_inr: model.number().default(0),
  total_inr: model.number().default(0),
  items: model.json().nullable(),
  revisions: model.json().nullable(),
  customer_notes: model.text().default(""),
  internal_notes: model.text().default(""),
  customer_response: model.text().nullable(),
  customer_response_notes: model.text().nullable(),
  customer_response_at: model.dateTime().nullable(),
  converted_order_id: model.text().nullable(),
  is_service_quote: model.boolean().default(false),
  contractor_id: model.text().nullable(),
  contractor_name: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default TradeQuote;
