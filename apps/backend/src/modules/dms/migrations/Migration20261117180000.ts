import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "dms_staff_audit_event" (` +
        `"id" text not null, ` +
        `"actor_id" text not null, ` +
        `"actor_email" text null, ` +
        `"actor_role" text not null default 'staff', ` +
        `"action" text not null, ` +
        `"resource" text not null, ` +
        `"outcome" text not null default 'SUCCESS', ` +
        `"reason" text null, ` +
        `"correlation_id" text null, ` +
        `"summary" jsonb null, ` +
        `"occurred_at" timestamptz not null default now(), ` +
        `"created_at" timestamptz not null default now(), ` +
        `"updated_at" timestamptz not null default now(), ` +
        `"deleted_at" timestamptz null, ` +
        `constraint "dms_staff_audit_event_pkey" primary key ("id")` +
        `);`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_actor_id" ON "dms_staff_audit_event" ("actor_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_action" ON "dms_staff_audit_event" ("action") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_resource" ON "dms_staff_audit_event" ("resource") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dms_staff_audit_event_occurred_at" ON "dms_staff_audit_event" ("occurred_at" DESC);`
    );

    // Append-only PostgreSQL immutability trigger (prohibits UPDATE and DELETE)
    this.addSql(
      `CREATE OR REPLACE FUNCTION prevent_dms_staff_audit_event_mutation() ` +
        `RETURNS trigger AS $$ ` +
        `BEGIN ` +
        `  RAISE EXCEPTION 'dms_staff_audit_event is strictly append-only: % operations are prohibited.', TG_OP; ` +
        `END; ` +
        `$$ LANGUAGE plpgsql;`
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_dms_staff_audit_event_immutable ON "dms_staff_audit_event";`
    );
    this.addSql(
      `CREATE TRIGGER trg_dms_staff_audit_event_immutable ` +
        `BEFORE UPDATE OR DELETE ON "dms_staff_audit_event" ` +
        `FOR EACH ROW ` +
        `EXECUTE FUNCTION prevent_dms_staff_audit_event_mutation();`
    );
  }

  override async down(): Promise<void> {
    // Reversible operationally without dropping audit history
    this.addSql(
      `DROP TRIGGER IF EXISTS trg_dms_staff_audit_event_immutable ON "dms_staff_audit_event";`
    );
    this.addSql(
      `DROP FUNCTION IF EXISTS prevent_dms_staff_audit_event_mutation();`
    );
  }
}
