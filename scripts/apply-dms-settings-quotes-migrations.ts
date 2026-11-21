import pg from "../apps/backend/node_modules/pg/lib/index.js";
import fs from "fs";
import path from "path";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";

async function main() {
  process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";

  const envPath = path.resolve(process.cwd(), "apps/backend/.env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const dbUrl = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DISPOSABLE_DATABASE_URL or DATABASE_URL must be defined");
  }
  assertDisposableDbTarget(dbUrl);

  const Client = pg.Client || pg.default?.Client || pg.default;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);
  console.log(`Connected to verified isolated database: ${currentDb}`);

  console.log("Applying Migration20261117180000 (dms_staff_audit_event)...");
  await client.query(`
    create table if not exists "dms_staff_audit_event" (
      "id" text not null,
      "actor_id" text not null,
      "actor_email" text null,
      "actor_role" text not null default 'staff',
      "action" text not null,
      "resource" text not null,
      "outcome" text not null default 'SUCCESS',
      "reason" text null,
      "correlation_id" text null,
      "summary" jsonb null,
      "occurred_at" timestamptz not null default now(),
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_staff_audit_event_pkey" primary key ("id")
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_actor_id" ON "dms_staff_audit_event" ("actor_id") WHERE deleted_at IS NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_action" ON "dms_staff_audit_event" ("action") WHERE deleted_at IS NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_resource" ON "dms_staff_audit_event" ("resource") WHERE deleted_at IS NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_occurred_at" ON "dms_staff_audit_event" ("occurred_at" DESC);`);

  // Append-only PostgreSQL immutability trigger (prohibits UPDATE and DELETE)
  await client.query(`
    CREATE OR REPLACE FUNCTION prevent_dms_staff_audit_event_mutation() 
    RETURNS trigger AS $$ 
    BEGIN 
      RAISE EXCEPTION 'dms_staff_audit_event is strictly append-only: % operations are prohibited.', TG_OP; 
    END; 
    $$ LANGUAGE plpgsql;
  `);
  await client.query(`DROP TRIGGER IF EXISTS trg_dms_staff_audit_event_immutable ON "dms_staff_audit_event";`);
  await client.query(`
    CREATE TRIGGER trg_dms_staff_audit_event_immutable 
    BEFORE UPDATE OR DELETE ON "dms_staff_audit_event" 
    FOR EACH ROW 
    EXECUTE FUNCTION prevent_dms_staff_audit_event_mutation();
  `);

  console.log("Applying Migration20261117190000 (dms_admin_setting, dms_trade_quote, dms_trade_promo_draft)...");
  await client.query(`
    create table if not exists "dms_admin_setting" (
      "id" text not null,
      "setting_key" text not null,
      "display_locale" text not null default 'en-IN',
      "timezone" text not null default 'Asia/Kolkata',
      "default_page_size" integer not null default 25,
      "enquiry_alert_email_enabled" boolean not null default true,
      "order_dispatch_alert_enabled" boolean not null default true,
      "low_stock_threshold" integer not null default 10,
      "version" integer not null default 1,
      "updated_by_id" text null,
      "updated_by_email" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_admin_setting_pkey" primary key ("id")
    );
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_admin_setting_key" ON "dms_admin_setting" ("setting_key") WHERE deleted_at IS NULL;`);

  await client.query(`
    create table if not exists "dms_trade_quote" (
      "id" text not null,
      "quote_number" text not null,
      "enquiry_id" text null,
      "customer_name" text not null,
      "customer_email" text not null default '',
      "organization" text not null default '',
      "division" text not null default 'General Quotation',
      "status" text not null default 'DRAFT',
      "revision" integer not null default 1,
      "valid_until" timestamptz null,
      "assigned_staff_id" text null,
      "assigned_staff_email" text null,
      "subtotal_inr" integer not null default 0,
      "items" jsonb null,
      "revisions" jsonb null,
      "customer_notes" text not null default '',
      "internal_notes" text not null default '',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_trade_quote_pkey" primary key ("id")
    );
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_quote_number" ON "dms_trade_quote" ("quote_number") WHERE deleted_at IS NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_dms_trade_quote_enquiry_id" ON "dms_trade_quote" ("enquiry_id") WHERE deleted_at IS NULL;`);

  await client.query(`
    create table if not exists "dms_trade_promo_draft" (
      "id" text not null,
      "code" text not null,
      "title" text not null,
      "target_tier" text not null default 'DEALER',
      "category_scope" text not null default 'ALL',
      "discount_percent" integer not null default 0,
      "valid_from" timestamptz null,
      "valid_until" timestamptz null,
      "status" text not null default 'DRAFT',
      "internal_notes" text not null default '',
      "created_by_id" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_trade_promo_draft_pkey" primary key ("id")
    );
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_promo_draft_code" ON "dms_trade_promo_draft" ("code") WHERE deleted_at IS NULL;`);

  console.log("Additive DMS migrations applied successfully to rehearsal disposable database!");
  await client.end();
}

main().catch(err => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
