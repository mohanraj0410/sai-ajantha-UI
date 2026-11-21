import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261112100124 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "account_profile" drop constraint if exists "account_profile_customer_id_unique";`);
    this.addSql(`create table if not exists "account_profile" ("id" text not null, "customer_id" text not null, "role" text check ("role" in ('CUSTOMER', 'DEALER', 'DISTRIBUTOR')) not null default 'CUSTOMER', "status" text check ("status" in ('ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED')) not null default 'ACTIVE', "parent_distributor_id" text null, "stock_location_id" text null, "business_name" text null, "gst_number" text null, "territory" text null, "dynamic_attributes" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "account_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_account_profile_customer_id_unique" ON "account_profile" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_profile_customer_id" ON "account_profile" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_profile_role" ON "account_profile" ("role") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_profile_parent_distributor_id" ON "account_profile" ("parent_distributor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_account_profile_deleted_at" ON "account_profile" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "account_profile" cascade;`);
  }

}
