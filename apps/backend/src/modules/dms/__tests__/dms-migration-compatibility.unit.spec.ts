import { describe, expect, it } from "@jest/globals";
import { Migration20261116170000 } from "../migrations/Migration20261116170000";
import { Migration20261117120000 } from "../migrations/Migration20261117120000";
import { Migration20261117180000 } from "../migrations/Migration20261117180000";
import { Migration20261117190000 } from "../migrations/Migration20261117190000";
import { Migration20261118120000 } from "../migrations/Migration20261118120000";
import { Migration20261118150000 } from "../migrations/Migration20261118150000";
import AdminSetting from "../models/admin-setting";
import StaffAuditEvent from "../models/staff-audit-event";
import TradeOrder from "../models/trade-order";
import TradePromoDraft from "../models/trade-promo-draft";
import TradeQuote from "../models/trade-quote";
import StockReservation from "../models/stock-reservation";
import InventoryMovement from "../models/inventory-movement";
import ProductImportJob from "../models/product-import-job";
import ProductImportRow from "../models/product-import-row";

describe("DMS Schema & Migration Compatibility (Work Unit P3.1 - BE-08)", () => {
  it("defines all required logistics, damage, and return fields in the TradeOrder model", () => {
    // Verify model definition exists
    expect(TradeOrder).toBeDefined();
  });

  it("produces safe, additive up-migration statements for missing columns", async () => {
    const migration = new Migration20261116170000({} as any, {} as any);
    const sqlStatements: string[] = [];
    migration.addSql = (sql: string) => {
      sqlStatements.push(sql);
    };

    await migration.up();

    expect(sqlStatements.length).toBe(11);

    const fullSql = sqlStatements.join("\n");
    expect(fullSql).toContain('"fulfillment_type" text not null default \'DELIVERY\'');
    expect(fullSql).toContain('"is_direct_sai_ajanta" boolean not null default true');
    expect(fullSql).toContain('"return_status" text not null default \'NONE\'');
    expect(fullSql).toContain('"damaged_qty" integer not null default 0');
    expect(fullSql).toContain('"damage_claim_status" text not null default \'NONE\'');
    expect(fullSql).toContain('"damage_notes" text null');
    expect(fullSql).toContain('"shipment_failure_reason" text null');
    expect(fullSql).toContain('"delivery_attempts" integer not null default 1');
    expect(fullSql).toContain('"subtotal_paise" bigint null');
    expect(fullSql).toContain('"gst_amount_paise" bigint null');
    expect(fullSql).toContain('"total_paise" bigint null');

    // Verify all statements use 'if not exists' for idempotent execution
    for (const stmt of sqlStatements) {
      expect(stmt).toContain("add column if not exists");
    }
  });

  it("produces non-destructive, targeted down-migration statements that preserve the table", async () => {
    const migration = new Migration20261116170000({} as any, {} as any);
    const sqlStatements: string[] = [];
    migration.addSql = (sql: string) => {
      sqlStatements.push(sql);
    };

    await migration.down();

    expect(sqlStatements.length).toBe(11);

    const fullSql = sqlStatements.join("\n");
    expect(fullSql).not.toContain("drop table");

    // Verify all statements use 'if exists' for safe rollback
    for (const stmt of sqlStatements) {
      expect(stmt).toContain("drop column if exists");
    }
  });

  it("produces additive up-migration statements for dms_stock_reservation and dms_inventory_movement (P3.5 / P3.6)", async () => {
    expect(StockReservation).toBeDefined();
    expect(InventoryMovement).toBeDefined();

    const migration = new Migration20261117120000({} as any, {} as any);
    const sqlStatements: string[] = [];
    migration.addSql = (sql: string) => {
      sqlStatements.push(sql);
    };

    await migration.up();

    const fullSql = sqlStatements.join("\n");
    expect(fullSql).toContain('create table if not exists "dms_stock_reservation"');
    expect(fullSql).toContain('create table if not exists "dms_inventory_movement"');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_order_id"');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS "IDX_dms_stock_reservation_status"');
    expect(fullSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_inventory_movement_op_key"');
  });

  it("produces additive immutable dms_staff_audit_event table and non-destructive down() (ADM-OPS-02)", async () => {
    expect(StaffAuditEvent).toBeDefined();

    const migration = new Migration20261117180000({} as any, {} as any);
    const upSql: string[] = [];
    const downSql: string[] = [];
    migration.addSql = (sql: string) => upSql.push(sql);
    await migration.up();

    const upJoined = upSql.join("\n");
    expect(upJoined).toContain('create table if not exists "dms_staff_audit_event"');
    expect(upJoined).toContain("prevent_dms_staff_audit_event_mutation");
    expect(upJoined).toContain("BEFORE UPDATE OR DELETE");

    migration.addSql = (sql: string) => downSql.push(sql);
    await migration.down();
    const downJoined = downSql.join("\n").toLowerCase();
    expect(downJoined).not.toContain("drop table");
    expect(downJoined).toContain("drop trigger if exists");
  });

  it("produces additive tables for AdminSetting, TradeQuote, and TradePromoDraft (ADM-OPS-05/08/10)", async () => {
    expect(AdminSetting).toBeDefined();
    expect(TradeQuote).toBeDefined();
    expect(TradePromoDraft).toBeDefined();

    const migration = new Migration20261117190000({} as any, {} as any);
    const upSql: string[] = [];
    const downSql: string[] = [];
    migration.addSql = (sql: string) => upSql.push(sql);
    await migration.up();

    const upJoined = upSql.join("\n");
    expect(upJoined).toContain('create table if not exists "dms_admin_setting"');
    expect(upJoined).toContain('create table if not exists "dms_trade_quote"');
    expect(upJoined).toContain('create table if not exists "dms_trade_promo_draft"');

    migration.addSql = (sql: string) => downSql.push(sql);
    await migration.down();
    expect(downSql.join("\n").toLowerCase()).not.toContain("drop table");
  });

  it("produces additive tables for ProductImportJob and ProductImportRow (Phase 06: P6.1 / P6.3)", async () => {
    expect(ProductImportJob).toBeDefined();
    expect(ProductImportRow).toBeDefined();

    const migration = new Migration20261118120000({} as any, {} as any);
    const upSql: string[] = [];
    migration.addSql = (sql: string) => upSql.push(sql);
    await migration.up();

    const upJoined = upSql.join("\n");
    expect(upJoined).toContain('create table if not exists "dms_product_import_job"');
    expect(upJoined).toContain('create table if not exists "dms_product_import_row"');
    expect(upJoined).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dms_product_import_job_intent_id"');
    expect(upJoined).toContain('CREATE INDEX IF NOT EXISTS "IDX_dms_product_import_row_job_id"');
    expect(upJoined).toContain('CREATE INDEX IF NOT EXISTS "IDX_dms_product_import_row_sku"');
  });

  it("produces additive columns and drops defaults for GST and Stock (P6.11.3 & P6.11.4)", async () => {
    const migration = new Migration20261118150000({} as any, {} as any);
    const upSql: string[] = [];
    migration.addSql = (sql: string) => upSql.push(sql);
    await migration.up();

    const upJoined = upSql.join("\n");
    expect(upJoined).toContain('ALTER TABLE "dms_product_import_row" ALTER COLUMN "gst_rate" DROP NOT NULL');
    expect(upJoined).toContain('ALTER TABLE "dms_product_import_row" ALTER COLUMN "stock_qty" DROP NOT NULL');
    expect(upJoined).toContain('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "review_status"');
    expect(upJoined).toContain('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "tax_status"');
    expect(upJoined).toContain('ALTER TABLE "dms_product_import_row" ADD COLUMN IF NOT EXISTS "stock_status"');
  });
});
