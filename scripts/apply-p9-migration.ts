import pg from "../apps/backend/node_modules/pg/lib/index.js";
import fs from "fs";
import path from "path";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";

const { Client } = pg;

async function applyP9Migration() {
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

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await assertDisposableDbConnection(client);
    console.log("Applying Phase 09 migration to disposable DB...");

    await client.query("BEGIN;");

    // 1. Columns on dms_trade_order
    await client.query(`
      ALTER TABLE "dms_trade_order"
      ADD COLUMN IF NOT EXISTS "fulfilment_status" text NOT NULL DEFAULT 'UNALLOCATED',
      ADD COLUMN IF NOT EXISTS "place_of_supply_state_code" text DEFAULT '33',
      ADD COLUMN IF NOT EXISTS "tax_split_json" jsonb,
      ADD COLUMN IF NOT EXISTS "bank_verified_by" text,
      ADD COLUMN IF NOT EXISTS "bank_verified_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "bank_reference" text,
      ADD COLUMN IF NOT EXISTS "bank_proof_status" text NOT NULL DEFAULT 'NONE';
    `);

    // 2. Command log
    await client.query(`
      CREATE TABLE IF NOT EXISTS "dms_order_command_log" (
        "id" text NOT NULL,
        "order_id" text NOT NULL,
        "command" text NOT NULL,
        "previous_status" text NOT NULL,
        "new_status" text NOT NULL,
        "actor_role" text NOT NULL,
        "actor_id" text NOT NULL,
        "notes" text,
        "payload_snapshot" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "dms_order_command_log_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_dms_order_command_log_order_id" ON "dms_order_command_log" ("order_id");
    `);

    // 3. Returns ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS "dms_order_return" (
        "id" text NOT NULL,
        "order_id" text NOT NULL,
        "line_id" text NOT NULL,
        "sku" text NOT NULL,
        "quantity_requested" integer NOT NULL,
        "reason" text NOT NULL,
        "customer_notes" text,
        "status" text NOT NULL DEFAULT 'REQUESTED',
        "refund_status" text NOT NULL DEFAULT 'NONE',
        "inspected_qty_accepted" integer NOT NULL DEFAULT 0,
        "inspected_qty_scrapped" integer NOT NULL DEFAULT 0,
        "restocked_to_inventory" boolean NOT NULL DEFAULT false,
        "refund_amount_paise" integer DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "dms_order_return_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_dms_order_return_order_id" ON "dms_order_return" ("order_id");
    `);

    // 4. Financial documents
    await client.query(`
      CREATE TABLE IF NOT EXISTS "dms_financial_document" (
        "id" text NOT NULL,
        "doc_number" text NOT NULL UNIQUE,
        "doc_type" text NOT NULL,
        "order_id" text NOT NULL,
        "seller_id" text NOT NULL,
        "buyer_email" text NOT NULL,
        "total_paise" integer NOT NULL,
        "tax_paise" integer NOT NULL,
        "document_payload" jsonb NOT NULL,
        "disclaimer" text NOT NULL DEFAULT 'Draft / Not a Tax Invoice',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "dms_financial_document_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_dms_financial_document_order_id" ON "dms_financial_document" ("order_id");
    `);

    await client.query("COMMIT;");
    console.log("Phase 09 migration applied cleanly.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyP9Migration().catch(console.error);
