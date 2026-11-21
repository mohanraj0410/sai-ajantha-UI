import { model } from "@medusajs/framework/utils";

const ProductImportRow = model.define("dms_product_import_row", {
  id: model.id({ prefix: "prow" }).primaryKey(),
  job_id: model.text().index(),
  source_row_number: model.number(),
  sku: model.text(),
  product_name: model.text(),
  category: model.text(),
  subcategory: model.text().nullable(),
  brand: model.text().default("Sai Ajantha"),
  billing_unit: model.text().default("1 unit"),
  customer_price_inr: model.number().nullable(),
  dealer_price_inr: model.number().nullable(),
  distributor_price_inr: model.number().nullable(),
  gst_rate: model.number().default(18),
  stock_qty: model.number().default(0),
  is_manufactured: model.boolean().default(false),
  route: model.text().default("SAI_AJANTHA_DIRECT"),
  is_quote_only: model.boolean().default(false),
  is_sample_row: model.boolean().default(false),
  severity: model.text().default("VALID"),
  errors: model.json().nullable(),
  warnings: model.json().nullable(),
  status: model.text().default("STAGED"),
});

export default ProductImportRow;
