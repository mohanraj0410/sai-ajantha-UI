import { Migration } from "@mikro-orm/migrations";

export class Migration20261118180000 extends Migration {
  async up(): Promise<void> {
    // 1. Additive columns to dms_trade_order for Phase 09 canonical states & verified tax
    this.addSql(`
      ALTER TABLE "dms_trade_order"
      ADD COLUMN IF NOT EXISTS "fulfilment_status" text NOT NULL DEFAULT 'UNALLOCATED',
      ADD COLUMN IF NOT EXISTS "place_of_supply_state_code" text DEFAULT '33',
      ADD COLUMN IF NOT EXISTS "tax_split_json" jsonb,
      ADD COLUMN IF NOT EXISTS "bank_verified_by" text,
      ADD COLUMN IF NOT EXISTS "bank_verified_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "bank_reference" text,
      ADD COLUMN IF NOT EXISTS "bank_proof_status" text NOT NULL DEFAULT 'NONE';
    `);

    // 2. Command audit trail table: dms_order_command_log
    this.addSql(`
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

    // 3. Structured returns ledger: dms_order_return
    this.addSql(`
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

    // 4. Server-backed document engine: dms_financial_document
    this.addSql(`
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
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "dms_financial_document";`);
    this.addSql(`DROP TABLE IF EXISTS "dms_order_return";`);
    this.addSql(`DROP TABLE IF EXISTS "dms_order_command_log";`);
  }
}
export default Migration20261118180000;
