import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const pg = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));
const { Client } = pg;

async function checkDisposableFingerprint() {
  const connString = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL || "postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable";
  const p2 = new Client({ connectionString: connString });
  await p2.connect();

  const tables = ["customer", "order", "product", "product_variant", "dms_trade_application", "dms_staff_user", "dms_credit_ledger", "dms_order_lifecycle"];
  const fingerprint = {};

  for (const t of tables) {
    try {
      const res = await p2.query(`SELECT count(*) as count FROM "${t}"`);
      fingerprint[t] = parseInt(res.rows[0].count, 10);
    } catch (e) {
      fingerprint[t] = `ERROR: ${e.message}`;
    }
  }

  const res1 = await p2.query("SELECT count(*) FROM dms_trade_order;");
  const res2 = await p2.query("SELECT count(*) FROM dms_product_import_job;");
  const res3 = await p2.query("SELECT count(*) FROM dms_product_import_row;");
  const res4 = await p2.query("SELECT count(*) FROM dms_staff_audit_event;");
  const res5 = await p2.query("SELECT count(*) FROM dms_financial_document;");
  console.log("DMS table counts in disposable DB:", {
    dms_trade_order: res1.rows[0].count,
    dms_product_import_job: res2.rows[0].count,
    dms_product_import_row: res3.rows[0].count,
    dms_staff_audit_event: res4.rows[0].count,
    dms_financial_document: res5.rows[0].count,
  });
  const jobs = await p2.query("SELECT * FROM dms_product_import_job ORDER BY created_at DESC LIMIT 5");
  console.log("Recent import jobs in disposable DB:", jobs.rows);
  console.log(JSON.stringify(fingerprint, null, 2));

  await p2.end();
}

checkDisposableFingerprint().catch(console.error);
