import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "dms_admin_setting" (` +
        `"id" text not null, ` +
        `"setting_key" text not null, ` +
        `"display_locale" text not null default 'en-IN', ` +
        `"timezone" text not null default 'Asia/Kolkata', ` +
        `"default_page_size" integer not null default 25, ` +
        `"enquiry_alert_email_enabled" boolean not null default true, ` +
        `"order_dispatch_alert_enabled" boolean not null default true, ` +
        `"low_stock_threshold" integer not null default 10, ` +
        `"version" integer not null default 1, ` +
        `"updated_by_id" text null, ` +
        `"updated_by_email" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_admin_setting_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_admin_setting_key" ON "dms_admin_setting" ("setting_key") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "dms_trade_quote" (` +
        `"id" text not null, ` +
        `"quote_number" text not null, ` +
        `"enquiry_id" text null, ` +
        `"customer_name" text not null, ` +
        `"customer_email" text not null default '', ` +
        `"organization" text not null default '', ` +
        `"division" text not null default 'General Quotation', ` +
        `"status" text not null default 'DRAFT', ` +
        `"revision" integer not null default 1, ` +
        `"valid_until" timestamptz null, ` +
        `"assigned_staff_id" text null, ` +
        `"assigned_staff_email" text null, ` +
        `"subtotal_inr" integer not null default 0, ` +
        `"items" jsonb null, ` +
        `"revisions" jsonb null, ` +
        `"customer_notes" text not null default '', ` +
        `"internal_notes" text not null default '', ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_trade_quote_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_quote_number" ON "dms_trade_quote" ("quote_number") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_quote_enquiry_id" ON "dms_trade_quote" ("enquiry_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "dms_trade_promo_draft" (` +
        `"id" text not null, ` +
        `"code" text not null, ` +
        `"title" text not null, ` +
        `"target_tier" text not null default 'DEALER', ` +
        `"category_scope" text not null default 'ALL', ` +
        `"discount_percent" integer not null default 0, ` +
        `"valid_from" timestamptz null, ` +
        `"valid_until" timestamptz null, ` +
        `"status" text not null default 'DRAFT', ` +
        `"internal_notes" text not null default '', ` +
        `"created_by_id" text null, ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_trade_promo_draft_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_promo_draft_code" ON "dms_trade_promo_draft" ("code") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    // Operational non-destructive down: drop lookup indexes without destroying persisted drafts
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_trade_promo_draft_code";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_trade_quote_enquiry_id";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_trade_quote_number";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dms_admin_setting_key";`);
  }
}
