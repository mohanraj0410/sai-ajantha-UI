import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117120000 extends Migration {
  override async up(): Promise<void> {
    // 1. Stock Reservation Table (Addendum Section 2, Task 03.5 / P3.5)
    this.addSql(
      `create table if not exists "dms_stock_reservation" (` +
        `"id" text not null, ` +
        `"order_id" text not null, ` +
        `"inventory_item_id" text not null, ` +
        `"location_id" text not null, ` +
        `"seller_id" text not null, ` +
        `"sku" text not null, ` +
        `"quantity" integer not null, ` +
        `"status" text not null default 'RESERVED', ` +
        `"expires_at" timestamptz not null, ` +
        `"confirmed_at" timestamptz null, ` +
        `"released_at" timestamptz null, ` +
        `"expired_at" timestamptz null, ` +
        `"reason" text null, ` +
        `"metadata" jsonb null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_stock_reservation_pkey" primary key ("id")` +
      `);`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_order_id" ON "dms_stock_reservation" ("order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_status" ON "dms_stock_reservation" ("status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_expires_at" ON "dms_stock_reservation" ("expires_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_item_loc" ON "dms_stock_reservation" ("inventory_item_id", "location_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_deleted_at" ON "dms_stock_reservation" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // 2. Append-Only Inventory Movement Ledger (Task 03.6 / BE-06 / P3.6)
    this.addSql(
      `create table if not exists "dms_inventory_movement" (` +
        `"id" text not null, ` +
        `"operation_key" text not null, ` +
        `"inventory_item_id" text not null, ` +
        `"location_id" text not null, ` +
        `"seller_id" text not null, ` +
        `"order_id" text null, ` +
        `"reservation_id" text null, ` +
        `"movement_type" text not null, ` +
        `"delta_physical" integer not null default 0, ` +
        `"delta_reserved" integer not null default 0, ` +
        `"actor_type" text not null default 'system', ` +
        `"actor_id" text null, ` +
        `"reason" text null, ` +
        `"metadata" jsonb null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_inventory_movement_pkey" primary key ("id")` +
      `);`
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_inventory_movement_op_key" ON "dms_inventory_movement" ("operation_key");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_inventory_movement_item_loc" ON "dms_inventory_movement" ("inventory_item_id", "location_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_inventory_movement_order_id" ON "dms_inventory_movement" ("order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_inventory_movement_created_at" ON "dms_inventory_movement" ("created_at");`
    );
  }

  override async down(): Promise<void> {
    // Non-destructive: Preserve audit history and reservation records
    // Drop indexes safely if down migration is ever rehearsed in disposable environment
    this.addSql(`DROP TABLE IF EXISTS "dms_inventory_movement" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "dms_stock_reservation" CASCADE;`);
  }
}
