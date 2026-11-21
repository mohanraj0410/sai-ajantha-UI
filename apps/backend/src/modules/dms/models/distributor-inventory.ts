import { model } from "@medusajs/framework/utils";

const DistributorInventory = model.define("dms_distributor_inventory", {
  id: model.id({ prefix: "dinv" }).primaryKey(),
  distributor_id: model.text().index(),
  sku: model.text().index(),
  variant_id: model.text().nullable(),
  title: model.text(),
  location_id: model.text(),
  stocked_qty: model.number().default(0),
  reserved_qty: model.number().default(0),
  damaged_qty: model.number().default(0),
  in_transit_qty: model.number().default(0),
  unit_cost_paise: model.number().nullable(),
});

export default DistributorInventory;
