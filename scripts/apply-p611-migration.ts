import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";

async function main() {
  process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
  const dbUrl = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL || "postgres://medusa:medusa@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
  assertDisposableDbTarget(dbUrl);

  const Client = pg.Client || pg.default?.Client || pg.default;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);
  console.log(`Connected to verified isolated database: ${currentDb}`);

  await client.query('ALTER TABLE "dms_product_import_row" ALTER COLUMN "gst_rate" DROP NOT NULL;');
  await client.query('ALTER TABLE "dms_product_import_row" ALTER COLUMN "gst_rate" DROP DEFAULT;');
  await client.query('ALTER TABLE "dms_product_import_row" ALTER COLUMN "stock_qty" DROP NOT NULL;');
  await client.query('ALTER TABLE "dms_product_import_row" ALTER COLUMN "stock_qty" DROP DEFAULT;');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "review_status" text not null default \'DRAFT\';');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "reviewed_by" text null;');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz null;');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "review_notes" text null;');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "tax_status" text not null default \'UNVERIFIED\';');
  await client.query('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "stock_status" text not null default \'UNVERIFIED\';');

  console.log("Migration20261118150000 applied successfully!");
  await client.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
