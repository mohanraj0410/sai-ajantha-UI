import { model } from "@medusajs/framework/utils";

export enum ReservationStatus {
  RESERVED = "RESERVED",
  CONFIRMED = "CONFIRMED",
  RELEASED = "RELEASED",
  EXPIRED = "EXPIRED",
}

const StockReservation = model.define("dms_stock_reservation", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  inventory_item_id: model.text(),
  location_id: model.text(),
  seller_id: model.text(),
  sku: model.text(),
  quantity: model.number(),
  status: model.text().default("RESERVED"), // RESERVED, CONFIRMED, RELEASED, EXPIRED
  expires_at: model.dateTime(),
  confirmed_at: model.dateTime().nullable(),
  released_at: model.dateTime().nullable(),
  expired_at: model.dateTime().nullable(),
  reason: model.text().nullable(),
  metadata: model.json().nullable(),
});

export default StockReservation;
