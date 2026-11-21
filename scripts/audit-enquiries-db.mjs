import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);
const { Client } = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://medusa:7hippocampus@localhost:5432/medusa_restore_rehearsal_disposable",
});

async function main() {
  await client.connect();

  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
      AND (table_name LIKE '%enquiry%' OR table_name LIKE '%quote%' OR table_name LIKE '%distributor%')
    ORDER BY table_name;
  `);
  console.log("=== Matching Tables ===");
  console.log(tables.rows.map((r) => r.table_name));

  const enquiryCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'dms_trade_enquiry' 
    ORDER BY ordinal_position;
  `);
  console.log("\n=== dms_trade_enquiry Columns ===");
  console.table(enquiryCols.rows);

  const quoteCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'dms_trade_quote' 
    ORDER BY ordinal_position;
  `);
  console.log("\n=== dms_trade_quote Columns ===");
  console.table(quoteCols.rows);

  const sampleEnquiries = await client.query(`
    SELECT id, name, phone, email, city, division, source, status, created_at
    FROM dms_trade_enquiry
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log("\n=== Recent Enquiries Sample ===");
  console.table(sampleEnquiries.rows);

  const sampleQuotes = await client.query(`
    SELECT id, quote_number, enquiry_id, customer_name, customer_email, division, status, revision, subtotal_inr
    FROM dms_trade_quote
    ORDER BY created_at DESC
    LIMIT 10;
  `);
  console.log("\n=== Recent Quotes Sample ===");
  console.table(sampleQuotes.rows);

  const enqStatuses = await client.query(`
    SELECT status, count(*) 
    FROM dms_trade_enquiry 
    GROUP BY status;
  `);
  console.log("\n=== Enquiry Status Breakdown ===");
  console.table(enqStatuses.rows);

  const quoteStatuses = await client.query(`
    SELECT status, count(*) 
    FROM dms_trade_quote 
    GROUP BY status;
  `);
  console.log("\n=== Quote Status Breakdown ===");
  console.table(quoteStatuses.rows);

  const distProfiles = await client.query(`
    SELECT id, customer_id, business_name, role, status, territory 
    FROM account_profile 
    WHERE role = 'DISTRIBUTOR';
  `);
  console.log("\n=== Distributors ===");
  console.table(distProfiles.rows);

  const coverage = await client.query(`
    SELECT id, distributor_id, postal_code, category_slug, status 
    FROM dms_distributor_coverage;
  `);
  console.log("\n=== Distributor Coverage ===");
  console.table(coverage.rows);

  const staff = await client.query(`
    SELECT id, email, first_name, last_name, metadata 
    FROM "user" 
    LIMIT 5;
  `);
  console.log("\n=== Staff / Users ===");
  console.table(staff.rows);

  const contractors = await client.query(`
    SELECT id, customer_id, business_name, role, status, territory 
    FROM account_profile 
    WHERE role = 'CONTRACTOR' OR role = 'DEALER';
  `);
  console.log("\n=== Contractors / Dealers ===");
  console.table(contractors.rows);

  await client.end();
}

main().catch(console.error);
