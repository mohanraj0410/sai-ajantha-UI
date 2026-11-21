import { model } from "@medusajs/framework/utils";

const DistributorReceipt = model.define("dms_distributor_receipt", {
  id: model.id({ prefix: "drcpt" }).primaryKey(),
  receipt_number: model.text().unique(),
  po_id: model.text().index(),
  distributor_id: model.text().index(),
  status: model.text().default("DRAFT"), // DRAFT | SUBMITTED | VERIFIED | DISCREPANCY_FLAGGED
  lines: model.json(),
  inspection_notes: model.text().nullable(),
  inspection_evidence_urls: model.json().nullable(),
  verified_by: model.text().nullable(),
  verified_at: model.dateTime().nullable(),
});

export default DistributorReceipt;
