import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261112123638 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "dms_trade_order" drop constraint if exists "dms_trade_order_order_number_unique";`);
    this.addSql(`create table if not exists "dms_trade_enquiry" ("id" text not null, "name" text not null, "role" text not null default 'Retail / Individual', "organization" text not null default '', "phone" text not null, "email" text not null default '', "city" text not null default '', "division" text not null default 'General Enquiry', "notes" text not null default '', "source" text not null default 'website', "status" text not null default 'NEW', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dms_trade_enquiry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dms_trade_enquiry_deleted_at" ON "dms_trade_enquiry" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dms_trade_order" ("id" text not null, "order_number" text not null, "customer_id" text not null, "role_at_order" text not null, "price_tier_applied" text not null, "status" text not null, "payment_status" text not null, "payment_method" text not null, "razorpay_order_id" text null, "razorpay_payment_id" text null, "customer_name" text not null, "customer_email" text not null, "customer_phone" text not null, "organization" text not null default '', "gstin" text null, "shipping_address" text not null, "subtotal_inr" real not null, "gst_amount_inr" real not null, "total_inr" real not null, "has_quote_items" boolean not null default false, "shipping_carrier" text null, "tracking_reference" text null, "notes" text null, "cancellation_reason" text null, "refund_status" text not null default 'NONE', "items" jsonb not null, "events" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dms_trade_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_trade_order_order_number_unique" ON "dms_trade_order" ("order_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dms_trade_order_deleted_at" ON "dms_trade_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dms_trade_payment" ("id" text not null, "order_id" text not null, "provider" text not null default 'RAZORPAY', "provider_order_id" text not null, "provider_payment_id" text null, "signature_verified" boolean not null default false, "amount_paise" integer not null, "currency" text not null default 'INR', "status" text not null default 'CREATED', "failure_reason" text null, "raw_event_json" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dms_trade_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dms_trade_payment_deleted_at" ON "dms_trade_payment" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dms_trade_enquiry" cascade;`);

    this.addSql(`drop table if exists "dms_trade_order" cascade;`);

    this.addSql(`drop table if exists "dms_trade_payment" cascade;`);
  }

}
