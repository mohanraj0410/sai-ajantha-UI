import { model } from "@medusajs/framework/utils";

export enum InventoryMovementType {
  RESERVE_HOLD = "RESERVE_HOLD",
  CONFIRM_SALE = "CONFIRM_SALE",
  RELEASE_HOLD = "RELEASE_HOLD",
  EXPIRE_HOLD = "EXPIRE_HOLD",
  COMPENSATION_RELEASE = "COMPENSATION_RELEASE",
  INVENTORY_ADJUSTMENT = "INVENTORY_ADJUSTMENT",
}

const InventoryMovement = model.define("dms_inventory_movement", {
  id: model.id().primaryKey(),
  operation_key: model.text().unique(),
  inventory_item_id: model.text(),
  location_id: model.text(),
  seller_id: model.text(),
  order_id: model.text().nullable(),
  reservation_id: model.text().nullable(),
  movement_type: model.text(),
  delta_physical: model.number().default(0),
  delta_reserved: model.number().default(0),
  actor_type: model.text().default("system"), // system, staff, webhook, reaper
  actor_id: model.text().nullable(),
  reason: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default InventoryMovement;
