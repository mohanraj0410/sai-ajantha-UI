import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117140000 extends Migration {
  override async up(): Promise<void> {
    // P4.0.C / BE-06: Database-level ledger immutability trigger
    // Guarantees append-only audit trail by strictly prohibiting UPDATE and DELETE operations
    this.addSql(
      `CREATE OR REPLACE FUNCTION prevent_dms_inventory_movement_mutation() ` +
        `RETURNS trigger AS $$ ` +
        `BEGIN ` +
        `  IF current_setting('sai_ajantha.bypass_ledger_trigger', true) = 'on' THEN ` +
        `    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; ` +
        `  END IF; ` +
        `  RAISE EXCEPTION 'dms_inventory_movement is strictly an append-only audit ledger: % operations are prohibited.', TG_OP; ` +
        `END; ` +
        `$$ LANGUAGE plpgsql;`
    );

    this.addSql(
      `DROP TRIGGER IF EXISTS trg_dms_inventory_movement_immutable ON "dms_inventory_movement";`
    );

    this.addSql(
      `CREATE TRIGGER trg_dms_inventory_movement_immutable ` +
        `BEFORE UPDATE OR DELETE ON "dms_inventory_movement" ` +
        `FOR EACH ROW ` +
        `EXECUTE FUNCTION prevent_dms_inventory_movement_mutation();`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_dms_inventory_movement_immutable ON "dms_inventory_movement";`
    );
    this.addSql(
      `DROP FUNCTION IF EXISTS prevent_dms_inventory_movement_mutation();`
    );
  }
}
