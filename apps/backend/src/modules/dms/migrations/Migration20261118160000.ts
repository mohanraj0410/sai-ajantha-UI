import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118160000 extends Migration {
  override async up(): Promise<void> {
    // 1. Distributor Territory & Category Coverage Table
    this.addSql(
      `create table if not exists "dms_distributor_coverage" (` +
        `"id" text not null, ` +
        `"distributor_id" text not null, ` +
        `"postal_code" text not null, ` +
        `"category_name" text not null, ` +
        `"category_slug" text not null, ` +
        `"canonical_route" text not null default 'DISTRIBUTOR_RESALE', ` +
        `"status" text not null default 'ACTIVE', ` +
        `"assigned_by" text not null, ` +
        `"notes" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_distributor_coverage_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_distributor_coverage_active_pin_cat" ON "dms_distributor_coverage" ("postal_code", "category_slug") WHERE status = 'ACTIVE' AND deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_distributor_coverage_distributor_id" ON "dms_distributor_coverage" ("distributor_id") WHERE deleted_at IS NULL;`
    );

    // 2. Distributor Supplier Purchase Order (PO) Table
    this.addSql(
      `create table if not exists "dms_distributor_po" (` +
        `"id" text not null, ` +
        `"po_number" text not null, ` +
        `"distributor_id" text not null, ` +
        `"status" text not null default 'DRAFT', ` +
        `"payment_status" text not null default 'PAYMENT_PENDING_VERIFICATION', ` +
        `"payment_proof_reference" text null, ` +
        `"payment_verified_by" text null, ` +
        `"payment_verified_at" timestamptz null, ` +
        `"source_location_id" text not null default 'loc_central', ` +
        `"destination_location_id" text null, ` +
        `"items" jsonb not null, ` +
        `"subtotal_paise" integer not null default 0, ` +
        `"gst_amount_paise" integer not null default 0, ` +
        `"total_paise" integer not null default 0, ` +
        `"dispatch_reference" text null, ` +
        `"dispatched_at" timestamptz null, ` +
        `"notes" text null, ` +
        `"cancellation_reason" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_distributor_po_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_distributor_po_number" ON "dms_distributor_po" ("po_number") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_distributor_po_distributor_id" ON "dms_distributor_po" ("distributor_id") WHERE deleted_at IS NULL;`
    );

    // 3. Distributor Warehouse Receipt Table
    this.addSql(
      `create table if not exists "dms_distributor_receipt" (` +
        `"id" text not null, ` +
        `"receipt_number" text not null, ` +
        `"po_id" text not null, ` +
        `"distributor_id" text not null, ` +
        `"status" text not null default 'DRAFT', ` +
        `"lines" jsonb not null, ` +
        `"inspection_notes" text null, ` +
        `"inspection_evidence_urls" jsonb null, ` +
        `"verified_by" text null, ` +
        `"verified_at" timestamptz null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_distributor_receipt_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_distributor_receipt_number" ON "dms_distributor_receipt" ("receipt_number") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_distributor_receipt_po_id" ON "dms_distributor_receipt" ("po_id") WHERE deleted_at IS NULL;`
    );

    // 4. Distributor-Owned Inventory Table (Tenant & Location Scoped)
    this.addSql(
      `create table if not exists "dms_distributor_inventory" (` +
        `"id" text not null, ` +
        `"distributor_id" text not null, ` +
        `"sku" text not null, ` +
        `"variant_id" text null, ` +
        `"title" text not null, ` +
        `"location_id" text not null, ` +
        `"stocked_qty" integer not null default 0, ` +
        `"reserved_qty" integer not null default 0, ` +
        `"damaged_qty" integer not null default 0, ` +
        `"in_transit_qty" integer not null default 0, ` +
        `"unit_cost_paise" integer null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_distributor_inventory_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_distributor_inventory_tenant_sku" ON "dms_distributor_inventory" ("distributor_id", "sku", "location_id") WHERE deleted_at IS NULL;`
    );

    // 5. Distributor Resale Quote Table (Scoped to Distributor)
    this.addSql(
      `create table if not exists "dms_distributor_resale_quote" (` +
        `"id" text not null, ` +
        `"quote_number" text not null, ` +
        `"distributor_id" text not null, ` +
        `"buyer_id" text not null, ` +
        `"buyer_role" text not null, ` +
        `"buyer_name" text not null, ` +
        `"buyer_email" text not null, ` +
        `"buyer_phone" text not null, ` +
        `"postal_code" text not null, ` +
        `"items" jsonb not null, ` +
        `"subtotal_paise" integer not null default 0, ` +
        `"gst_amount_paise" integer not null default 0, ` +
        `"total_paise" integer not null default 0, ` +
        `"status" text not null default 'REQUESTED', ` +
        `"is_quote_only" boolean not null default true, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_distributor_resale_quote_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_distributor_resale_quote_number" ON "dms_distributor_resale_quote" ("quote_number") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_distributor_resale_quote_dist_id" ON "dms_distributor_resale_quote" ("distributor_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_distributor_resale_quote_buyer_id" ON "dms_distributor_resale_quote" ("buyer_id") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    // Non-destructive down migration (roll-forward only per ADR-002)
    this.addSql(`SELECT 1;`);
  }
}
