import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);

const dotenv = require(path.resolve(process.cwd(), "apps/backend/node_modules/dotenv"));
dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
const pg = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));
const { Client } = pg;

async function main() {
  const p2Url = process.env.DATABASE_URL;
  const client = new Client({ connectionString: p2Url });
  await client.connect();

  const total = await client.query("SELECT count(*) FROM product");
  console.log("Total products:", total.rows[0].count);

  const testProd = await client.query(`
    SELECT id, title, handle, status, metadata 
    FROM product 
    WHERE handle LIKE '%test%' 
       OR handle LIKE 'sa-test%' 
       OR title ILIKE '%test%' 
       OR title ILIKE '%phase 10%'
       OR metadata::text LIKE '%test%'
  `);
  console.log("Found matching test products count:", testProd.rows.length);
  for (const r of testProd.rows) {
    console.log(`- ID: ${r.id} | Handle: ${r.handle} | Status: ${r.status} | Title: ${r.title} | Meta: ${JSON.stringify(r.metadata)}`);
  }

  // Also let's check all products that do NOT have a legacy_id or source_sheet
  const nonImported = await client.query(`
    SELECT id, title, handle, status, metadata 
    FROM product 
    WHERE metadata->>'source_sheet' IS NULL
  `);
  console.log("\nProducts without source_sheet count:", nonImported.rows.length);
  for (const r of nonImported.rows) {
    console.log(`- ID: ${r.id} | Handle: ${r.handle} | Status: ${r.status} | Title: ${r.title}`);
  }

  await client.end();
}

main().catch(console.error);
