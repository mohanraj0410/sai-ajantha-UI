import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "dms_product_import_job" (` +
        `"id" text not null, ` +
        `"intent_id" text not null, ` +
        `"file_name" text not null, ` +
        `"file_hash" text not null, ` +
        `"status" text not null default 'STAGED', ` +
        `"total_rows" integer not null default 0, ` +
        `"candidate_rows" integer not null default 0, ` +
        `"excluded_samples" integer not null default 0, ` +
        `"invalid_rows" integer not null default 0, ` +
        `"staged_rows" integer not null default 0, ` +
        `"published_rows" integer not null default 0, ` +
        `"uploaded_by" text null, ` +
        `"error_message" text null, ` +
        `"metadata" jsonb null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_product_import_job_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_product_import_job_intent_id" ON "dms_product_import_job" ("intent_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "dms_product_import_row" (` +
        `"id" text not null, ` +
        `"job_id" text not null, ` +
        `"source_row_number" integer not null, ` +
        `"sku" text not null, ` +
        `"product_name" text not null, ` +
        `"category" text not null, ` +
        `"subcategory" text null, ` +
        `"brand" text not null default 'Sai Ajantha', ` +
        `"billing_unit" text not null default '1 unit', ` +
        `"customer_price_inr" real null, ` +
        `"dealer_price_inr" real null, ` +
        `"distributor_price_inr" real null, ` +
        `"gst_rate" real not null default 18, ` +
        `"stock_qty" integer not null default 0, ` +
        `"is_manufactured" boolean not null default false, ` +
        `"route" text not null default 'SAI_AJANTHA_DIRECT', ` +
        `"is_quote_only" boolean not null default false, ` +
        `"is_sample_row" boolean not null default false, ` +
        `"severity" text not null default 'VALID', ` +
        `"errors" jsonb null, ` +
        `"warnings" jsonb null, ` +
        `"status" text not null default 'STAGED', ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_product_import_row_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_product_import_row_job_id" ON "dms_product_import_row" ("job_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_product_import_row_sku" ON "dms_product_import_row" ("sku") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_product_import_row_sku";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_product_import_row_job_id";`);
    this.addSql(`DROP TABLE IF EXISTS "dms_product_import_row";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_product_import_job_intent_id";`);
    this.addSql(`DROP TABLE IF EXISTS "dms_product_import_job";`);
  }
}
