import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const pg = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));
const { Client } = pg;

async function checkPrimaryFingerprint() {
  const connString = process.env.PRIMARY_DATABASE_URL || "postgres://medusa:medusa@localhost:5432/medusa";
  const p1 = new Client({ connectionString: connString });
  await p1.connect();

  const tables = ["customer", "order", "product", "product_variant", "dms_trade_application", "dms_staff_user", "dms_credit_ledger", "dms_order_lifecycle"];
  const fingerprint = {};

  for (const t of tables) {
    try {
      const res = await p1.query(`SELECT count(*) as count FROM "${t}"`);
      fingerprint[t] = parseInt(res.rows[0].count, 10);
    } catch (e) {
      fingerprint[t] = `ERROR: ${e.message}`;
    }
  }

  // Check specific rows in customer
  const custRes = await p1.query(`SELECT id, email, created_at FROM customer ORDER BY id LIMIT 3`);
  fingerprint.sampleCustomers = custRes.rows;

  // Check orders
  const orderRes = await p1.query(`SELECT id, status, currency_code, created_at FROM "order" ORDER BY id`);
  fingerprint.orders = orderRes.rows;

  console.log("=== PRIMARY medusa DATABASE FINGERPRINT ===");
  console.log(JSON.stringify(fingerprint, null, 2));

  await p1.end();
}

checkPrimaryFingerprint().catch(console.error);
