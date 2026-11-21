import fs from "node:fs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";

dotenv.config({ path: "apps/backend/.env", quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await client.connect();
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");
  const database = (await client.query("SELECT current_database() AS name")).rows[0].name;
  const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'dms_%' OR table_name IN ('customer','product','product_category','account_profile','user','stock_location','inventory_level')) ORDER BY table_name")).rows.map(r => r.table_name);
  const result = { capturedAt: new Date().toISOString(), database, tables: {} };
  for (const table of tables) {
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table])).rows.map(r => r.column_name);
    const scope = columns.includes('deleted_at') ? 'WHERE deleted_at IS NULL' : '';
    const quote = s => '"' + s.replaceAll('"', '""') + '"';
    const total = Number((await client.query(`SELECT count(*) FROM ${quote(table)} ${scope}`)).rows[0].count);
    const entry = { total, statuses: {} };
    if (columns.includes('deleted_at')) entry.deleted = Number((await client.query(`SELECT count(*) FROM ${quote(table)} WHERE deleted_at IS NOT NULL`)).rows[0].count);
    for (const field of ['status','role','payment_status','return_status','damage_claim_status','routing_status']) {
      if (columns.includes(field)) entry.statuses[field] = (await client.query(`SELECT ${quote(field)} AS value, count(*)::int AS count FROM ${quote(table)} ${scope} GROUP BY ${quote(field)} ORDER BY 1`)).rows;
    }
    result.tables[table] = entry;
  }
  result.accounts = (await client.query(`SELECT COALESCE(p.role,'CUSTOMER') AS role,
    CASE WHEN p.dynamic_attributes->>'rejection_status'='REJECTED' OR p.dynamic_attributes->>'trade_application_status'='REJECTED' THEN 'REJECTED'
      WHEN p.status IN ('PENDING_APPROVAL','SUSPENDED','REJECTED') THEN p.status ELSE 'APPROVED' END AS status,
    count(*)::int AS count FROM customer c LEFT JOIN account_profile p ON p.customer_id=c.id AND p.deleted_at IS NULL
    WHERE c.deleted_at IS NULL GROUP BY 1,2 ORDER BY 1,2`)).rows;
  result.orphanProfiles = (await client.query(`SELECT p.role,count(*)::int AS count FROM account_profile p LEFT JOIN customer c ON c.id=p.customer_id AND c.deleted_at IS NULL WHERE p.deleted_at IS NULL AND c.id IS NULL GROUP BY p.role ORDER BY p.role`)).rows;
  result.productStages = (await client.query(`SELECT metadata->>'cms_status' AS cms_status,status,count(*)::int AS count FROM product WHERE deleted_at IS NULL GROUP BY 1,2 ORDER BY 1,2`)).rows;
  result.staffStates = (await client.query(`SELECT metadata->>'role' AS role,COALESCE(metadata->>'active','true') AS active,count(*)::int AS count FROM "user" WHERE deleted_at IS NULL GROUP BY 1,2 ORDER BY 1,2`)).rows;
  result.indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('account_profile','customer','product','dms_trade_order','dms_trade_enquiry','dms_trade_quote','dms_staff_audit_event') ORDER BY tablename,indexname`)).rows;
  fs.writeFileSync('docs/admin-tab-count-db-evidence.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  await client.query('ROLLBACK');
} finally { await client.end(); }

