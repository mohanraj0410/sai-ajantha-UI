import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "fulfillment_type" text not null default 'DELIVERY';`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "is_direct_sai_ajanta" boolean not null default true;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "return_status" text not null default 'NONE';`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "damaged_qty" integer not null default 0;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "damage_claim_status" text not null default 'NONE';`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "damage_notes" text null;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "shipment_failure_reason" text null;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "delivery_attempts" integer not null default 1;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "subtotal_paise" bigint null;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "gst_amount_paise" bigint null;`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" add column if not exists "total_paise" bigint null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "total_paise";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "gst_amount_paise";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "subtotal_paise";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "fulfillment_type";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "is_direct_sai_ajanta";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "return_status";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "damaged_qty";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "damage_claim_status";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "damage_notes";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "shipment_failure_reason";`
    );
    this.addSql(
      `alter table if exists "dms_trade_order" drop column if exists "delivery_attempts";`
    );
  }
}
