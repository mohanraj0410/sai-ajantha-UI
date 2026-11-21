const path = require("path");
const { Client } = require(path.resolve("apps/backend/node_modules/pg"));
const client = new Client({
  connectionString:
    "postgres://medusa:7hippocampus@localhost:5432/medusa_restore_rehearsal_disposable",
});

async function run() {
  await client.connect();
  const dist = await client.query(
    "SELECT id, customer_id, business_name, role, status, territory FROM account_profile WHERE role = 'DISTRIBUTOR'"
  );
  console.log("Distributors:", dist.rows);
  const cov = await client.query(
    "SELECT id, distributor_id, postal_code, category_slug, status FROM dms_distributor_coverage LIMIT 20"
  );
  console.log("Coverage:", cov.rows);
  const staff = await client.query("SELECT id, email, first_name, last_name FROM \"user\" LIMIT 10");
  console.log("Staff users:", staff.rows);
  await client.end();
}

run().catch(console.error);
