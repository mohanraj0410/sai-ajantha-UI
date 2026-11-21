import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118150000 extends Migration {
  override async up(): Promise<void> {
    // 1. Remove unsupported non-null and default constraints for GST and Stock (P6.11.3)
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ALTER COLUMN "gst_rate" DROP NOT NULL;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ALTER COLUMN "gst_rate" DROP DEFAULT;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ALTER COLUMN "stock_qty" DROP NOT NULL;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ALTER COLUMN "stock_qty" DROP DEFAULT;`
    );

    // 2. Add review and verification columns (P6.11.4)
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "review_status" text not null default 'DRAFT';`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "reviewed_by" text null;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz null;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "review_notes" text null;`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "tax_status" text not null default 'UNVERIFIED';`
    );
    this.addSql(
      `ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "stock_status" text not null default 'UNVERIFIED';`
    );
  }

  override async down(): Promise<void> {
    // Roll-forward only per ADR-002; non-destructive down migration
    this.addSql(`SELECT 1;`);
  }
}
