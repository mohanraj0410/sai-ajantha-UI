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

  console.log("Applying Migration20261118170000 (Persistent Cart & Mixed Seller)...");

  // 1. Persistent Cart Table
  await client.query(`
    create table if not exists "dms_cart" (
      "id" text not null,
      "session_token" text null,
      "customer_id" text null,
      "postal_code" text null,
      "status" text not null default 'ACTIVE',
      "currency_code" text not null default 'INR',
      "metadata" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_cart_pkey" primary key ("id")
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "IDX_dms_cart_session_token" ON "dms_cart" ("session_token") WHERE deleted_at IS NULL;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "IDX_dms_cart_customer_id" ON "dms_cart" ("customer_id") WHERE deleted_at IS NULL;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "IDX_dms_cart_status" ON "dms_cart" ("status") WHERE deleted_at IS NULL;
  `);

  // 2. Persistent Cart Line Items
  await client.query(`
    create table if not exists "dms_cart_line" (
      "id" text not null,
      "cart_id" text not null,
      "product_id" text null,
      "variant_id" text null,
      "sku" text not null,
      "title" text not null,
      "quantity" integer not null default 1,
      "seller_route" text not null,
      "seller_id" text not null,
      "seller_name" text not null,
      "warehouse_id" text not null,
      "is_quote_only" boolean not null default false,
      "unit_price_paise" integer null,
      "total_price_paise" integer null,
      "tax_rate_percent" numeric(5,2) null,
      "custom_configuration" jsonb null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_cart_line_pkey" primary key ("id"),
      constraint "dms_cart_line_cart_fk" foreign key ("cart_id") references "dms_cart"("id") on delete cascade
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "IDX_dms_cart_line_cart_id" ON "dms_cart_line" ("cart_id") WHERE deleted_at IS NULL;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_cart_line_cart_sku" ON "dms_cart_line" ("cart_id", "sku") WHERE deleted_at IS NULL;
  `);

  // 3. Multi-Seller Checkout Intent Scaffold
  await client.query(`
    create table if not exists "dms_mixed_seller_checkout_intent" (
      "id" text not null,
      "cart_id" text not null,
      "correlation_id" text not null,
      "customer_id" text null,
      "customer_email" text not null,
      "groups" jsonb not null,
      "status" text not null default 'DRAFT',
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "dms_mixed_seller_checkout_intent_pkey" primary key ("id")
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "IDX_dms_mixed_seller_intent_cart" ON "dms_mixed_seller_checkout_intent" ("cart_id") WHERE deleted_at IS NULL;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_mixed_seller_intent_correlation" ON "dms_mixed_seller_checkout_intent" ("correlation_id") WHERE deleted_at IS NULL;
  `);

  console.log("Migration20261118170000 applied successfully to disposable database!");
  await client.end();
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
