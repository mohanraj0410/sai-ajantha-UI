import { model } from "@medusajs/framework/utils";

const ProductImportJob = model.define("dms_product_import_job", {
  id: model.id({ prefix: "pimp" }).primaryKey(),
  intent_id: model.text().unique(),
  file_name: model.text(),
  file_hash: model.text(),
  status: model.text().default("STAGED"),
  total_rows: model.number().default(0),
  candidate_rows: model.number().default(0),
  excluded_samples: model.number().default(0),
  invalid_rows: model.number().default(0),
  staged_rows: model.number().default(0),
  published_rows: model.number().default(0),
  uploaded_by: model.text().nullable(),
  error_message: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default ProductImportJob;
