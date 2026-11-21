import { model } from "@medusajs/framework/utils";

const AdminSetting = model.define("dms_admin_setting", {
  id: model.id({ prefix: "set" }).primaryKey(),
  setting_key: model.text().unique(),
  display_locale: model.text().default("en-IN"),
  timezone: model.text().default("Asia/Kolkata"),
  default_page_size: model.number().default(25),
  enquiry_alert_email_enabled: model.boolean().default(true),
  order_dispatch_alert_enabled: model.boolean().default(true),
  low_stock_threshold: model.number().default(10),
  version: model.number().default(1),
  updated_by_id: model.text().nullable(),
  updated_by_email: model.text().nullable(),
});

export default AdminSetting;
