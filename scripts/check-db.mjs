import pg from '../apps/backend/node_modules/pg/lib/index.js';

async function main() {
  const client = new pg.Client('postgres://medusa:medusa@localhost:5432/medusa');
  await client.connect();
  const res = await client.query("SELECT count(*) FROM product WHERE title ILIKE '%health%' OR description ILIKE '%health%' OR title ILIKE '%hospital%' OR description ILIKE '%hospital%' OR title ILIKE '%clinic%' OR description ILIKE '%clinic%';");
  console.log('PostgreSQL products with healthcare text:', res.rows[0].count);
  const catRes = await client.query("SELECT count(*) FROM product_category WHERE name ILIKE '%health%' OR description ILIKE '%health%' OR name ILIKE '%hospital%';");
  console.log('PostgreSQL categories with healthcare text:', catRes.rows[0].count);
  await client.end();
}

main().catch(err => {
  console.error('DB query error:', err.message);
  process.exit(1);
});
