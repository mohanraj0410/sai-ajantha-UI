import { model } from "@medusajs/framework/utils";

const DistributorCoverage = model.define("dms_distributor_coverage", {
  id: model.id({ prefix: "dcov" }).primaryKey(),
  distributor_id: model.text().index(),
  postal_code: model.text().index(),
  category_name: model.text(),
  category_slug: model.text().index(),
  canonical_route: model.text().default("DISTRIBUTOR_RESALE"),
  status: model.text().default("ACTIVE"), // ACTIVE | SUSPENDED | REVOKED
  assigned_by: model.text(),
  notes: model.text().nullable(),
});

export default DistributorCoverage;
