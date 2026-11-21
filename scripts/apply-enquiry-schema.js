const path = require("path");
const { Client } = require(path.resolve("apps/backend/node_modules/pg"));
const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://medusa:7hippocampus@localhost:5432/medusa_restore_rehearsal_disposable",
});

async function run() {
  await client.connect();
  console.log("Connected to DB:", client.database);

  await client.query(`
    ALTER TABLE "dms_trade_enquiry"
      ADD COLUMN IF NOT EXISTS "postal_code" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "assigned_seller_id" text,
      ADD COLUMN IF NOT EXISTS "assigned_seller_name" text,
      ADD COLUMN IF NOT EXISTS "assigned_seller_type" text,
      ADD COLUMN IF NOT EXISTS "assigned_staff_id" text,
      ADD COLUMN IF NOT EXISTS "assigned_staff_email" text,
      ADD COLUMN IF NOT EXISTS "follow_up_date" timestamptz,
      ADD COLUMN IF NOT EXISTS "closure_reason" text,
      ADD COLUMN IF NOT EXISTS "lead_type" text NOT NULL DEFAULT 'PRODUCT_QUOTE',
      ADD COLUMN IF NOT EXISTS "contractor_id" text,
      ADD COLUMN IF NOT EXISTS "contractor_name" text,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

    ALTER TABLE "dms_trade_quote"
      ADD COLUMN IF NOT EXISTS "customer_phone" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "postal_code" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "seller_id" text,
      ADD COLUMN IF NOT EXISTS "seller_name" text,
      ADD COLUMN IF NOT EXISTS "seller_type" text,
      ADD COLUMN IF NOT EXISTS "tax_inr" numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_inr" numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "converted_order_id" text,
      ADD COLUMN IF NOT EXISTS "is_service_quote" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "contractor_id" text,
      ADD COLUMN IF NOT EXISTS "contractor_name" text,
      ADD COLUMN IF NOT EXISTS "customer_response" text,
      ADD COLUMN IF NOT EXISTS "customer_response_notes" text,
      ADD COLUMN IF NOT EXISTS "customer_response_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

    CREATE TABLE IF NOT EXISTS "dms_enquiry_activity" (
      "id" text NOT NULL,
      "enquiry_id" text NOT NULL,
      "action" text NOT NULL,
      "from_status" text,
      "to_status" text,
      "actor_id" text,
      "actor_email" text,
      "notes" text,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "dms_enquiry_activity_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_dms_enquiry_activity_enquiry_id" ON "dms_enquiry_activity" ("enquiry_id");
    CREATE INDEX IF NOT EXISTS "IDX_dms_trade_quote_enquiry_id" ON "dms_trade_quote" ("enquiry_id");
  `);

  console.log("Schema migration applied successfully.");

  // Check columns now
  const enquiryCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dms_trade_enquiry' 
    ORDER BY ordinal_position;
  `);
  console.log("Enquiry columns count:", enquiryCols.rows.length);

  await client.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
