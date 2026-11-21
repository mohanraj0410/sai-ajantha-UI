import { Migration } from "@mikro-orm/migrations";

export class Migration20261120120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
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
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "dms_enquiry_activity";`);
  }
}
export default Migration20261120120000;
