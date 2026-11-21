import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116180000 extends Migration {
  override async up(): Promise<void> {
    // 1. Durable Idempotency Table (SF-19 / Task 03.3)
    this.addSql(
      `create table if not exists "dms_idempotency_key" ("id" text not null, "idempotency_key" text not null, "actor_or_scope" text not null default 'system', "operation" text not null, "fingerprint" text not null, "status" text not null default 'IN_PROGRESS', "response_status" integer null, "response_body" jsonb null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dms_idempotency_key_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_idempotency_key_composite" ON "dms_idempotency_key" ("actor_or_scope", "operation", "idempotency_key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_idempotency_key_expires_at" ON "dms_idempotency_key" ("expires_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_idempotency_key_deleted_at" ON "dms_idempotency_key" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // 2. Webhook Inbox Table (SF-19 / BE-04 / Task 03.3 & P3.3.1)
    this.addSql(
      `create table if not exists "dms_webhook_inbox" ("id" text not null, "provider" text not null default 'RAZORPAY', "provider_event_id" text not null, "event_type" text null, "provider_order_id" text null, "provider_payment_id" text null, "payload_hash" text not null, "status" text not null default 'RECEIVED', "retry_count" integer not null default 0, "last_attempt_at" timestamptz not null default now(), "processed_at" timestamptz null, "error_message" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dms_webhook_inbox_pkey" primary key ("id"));`
    );
    this.addSql(
      `alter table if exists "dms_webhook_inbox" add column if not exists "retry_count" integer not null default 0;`
    );
    this.addSql(
      `alter table if exists "dms_webhook_inbox" add column if not exists "last_attempt_at" timestamptz not null default now();`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_webhook_inbox_provider_event" ON "dms_webhook_inbox" ("provider", "provider_event_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_webhook_inbox_order_id" ON "dms_webhook_inbox" ("provider_order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_webhook_inbox_created_at" ON "dms_webhook_inbox" ("created_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_webhook_inbox_deleted_at" ON "dms_webhook_inbox" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // 3. Trade Order Missing Indexes (BE-09)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_razorpay_order_id" ON "dms_trade_order" ("razorpay_order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_customer_id" ON "dms_trade_order" ("customer_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_status" ON "dms_trade_order" ("status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_payment_status" ON "dms_trade_order" ("payment_status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_created_at" ON "dms_trade_order" ("created_at");`
    );

    // 4. Trade Payment Missing Indexes & Foreign Key Constraint (BE-09)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_payment_provider_order_id" ON "dms_trade_payment" ("provider_order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_payment_provider_payment_id" ON "dms_trade_payment" ("provider_payment_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_trade_payment_order_id" ON "dms_trade_payment" ("order_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_payment_provider_payment_id_unique" ON "dms_trade_payment" ("provider_payment_id") WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;`
    );
    this.addSql(
      `alter table if exists "dms_trade_payment" drop constraint if exists "fk_dms_trade_payment_order_id";`
    );
    this.addSql(
      `alter table if exists "dms_trade_payment" add constraint "fk_dms_trade_payment_order_id" foreign key ("order_id") references "dms_trade_order"("id") on delete cascade;`
    );

    // 5. Backfill historical orders with exact paise where missing
    this.addSql(
      `UPDATE "dms_trade_order" SET "subtotal_paise" = ROUND("subtotal_inr" * 100)::bigint, "gst_amount_paise" = ROUND("gst_amount_inr" * 100)::bigint, "total_paise" = ROUND("total_inr" * 100)::bigint WHERE "total_paise" IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "dms_trade_payment" drop constraint if exists "fk_dms_trade_payment_order_id";`
    );
    this.addSql(
      `drop index if exists "IDX_dms_trade_payment_provider_payment_id_unique";`
    );
    this.addSql(`drop index if exists "IDX_dms_trade_payment_order_id";`);
    this.addSql(
      `drop index if exists "IDX_dms_trade_payment_provider_payment_id";`
    );
    this.addSql(
      `drop index if exists "IDX_dms_trade_payment_provider_order_id";`
    );
    this.addSql(`drop index if exists "IDX_dms_trade_order_created_at";`);
    this.addSql(`drop index if exists "IDX_dms_trade_order_payment_status";`);
    this.addSql(`drop index if exists "IDX_dms_trade_order_status";`);
    this.addSql(`drop index if exists "IDX_dms_trade_order_customer_id";`);
    this.addSql(`drop index if exists "IDX_dms_trade_order_razorpay_order_id";`);
    this.addSql(`drop table if exists "dms_webhook_inbox" cascade;`);
    this.addSql(`drop table if exists "dms_idempotency_key" cascade;`);
  }
}
