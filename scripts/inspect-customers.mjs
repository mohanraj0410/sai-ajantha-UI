import pg from "../apps/backend/node_modules/pg/lib/index.js";

async function run() {
  const client = new pg.Client({
    connectionString: "postgres://medusa:medusa@localhost:5432/medusa",
  });
  await client.connect();

  const res = await client.query("SELECT id, email, first_name, last_name, has_account FROM customer ORDER BY created_at DESC LIMIT 5");
  console.log("Recent customers:", res.rows);

  const authRes = await client.query("SELECT * FROM auth_identity LIMIT 3");
  console.log("Auth identities:", authRes.rows);

  await client.end();
}

run().catch(console.error);
