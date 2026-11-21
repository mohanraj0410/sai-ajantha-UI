import { model } from "@medusajs/framework/utils";

const TradeEnquiry = model.define("dms_trade_enquiry", {
  id: model.id().primaryKey(),
  name: model.text(),
  role: model.text().default("Retail / Individual"),
  organization: model.text().default(""),
  phone: model.text(),
  email: model.text().default(""),
  city: model.text().default(""),
  division: model.text().default("General Enquiry"),
  notes: model.text().default(""),
  source: model.text().default("website"),
  status: model.text().default("NEW"),
  postal_code: model.text().default(""),
  items: model.json().nullable(),
  attachments: model.json().nullable(),
  assigned_seller_id: model.text().nullable(),
  assigned_seller_name: model.text().nullable(),
  assigned_seller_type: model.text().nullable(),
  assigned_staff_id: model.text().nullable(),
  assigned_staff_email: model.text().nullable(),
  follow_up_date: model.dateTime().nullable(),
  closure_reason: model.text().nullable(),
  lead_type: model.text().default("PRODUCT_QUOTE"),
  contractor_id: model.text().nullable(),
  contractor_name: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default TradeEnquiry;
