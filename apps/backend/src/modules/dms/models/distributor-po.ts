import { model } from "@medusajs/framework/utils";

const DistributorPo = model.define("dms_distributor_po", {
  id: model.id({ prefix: "dpo" }).primaryKey(),
  po_number: model.text().unique(),
  distributor_id: model.text().index(),
  status: model.text().default("DRAFT"),
  // DRAFT | SUBMITTED | AWAITING_FINANCE_APPROVAL | APPROVED | ALLOCATED | DISPATCHED | PARTIALLY_RECEIVED | RECEIVED | RECONCILIATION_REQUIRED | CANCELLED
  payment_status: model.text().default("PAYMENT_PENDING_VERIFICATION"),
  // PAYMENT_PENDING_VERIFICATION | PAYMENT_VERIFIED | PAYMENT_FAILED | REFUNDED
  payment_proof_reference: model.text().nullable(),
  payment_verified_by: model.text().nullable(),
  payment_verified_at: model.dateTime().nullable(),
  source_location_id: model.text().default("loc_central"),
  destination_location_id: model.text().nullable(),
  items: model.json(),
  subtotal_paise: model.number().default(0),
  gst_amount_paise: model.number().default(0),
  total_paise: model.number().default(0),
  dispatch_reference: model.text().nullable(),
  dispatched_at: model.dateTime().nullable(),
  notes: model.text().nullable(),
  cancellation_reason: model.text().nullable(),
});

export default DistributorPo;
