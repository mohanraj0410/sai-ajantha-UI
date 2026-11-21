import pg from '../apps/backend/node_modules/pg/lib/index.js';

async function main() {
  const client = new pg.Client('postgres://medusa:medusa@localhost:5432/medusa');
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Total tables in public schema:', res.rows.length);
  console.log(res.rows.map(r => r.table_name));

  // Search across ALL text columns in the database for healthcare/hospital/clinical terms
  const PATTERNS = ['%health%', '%hospital%', '%clinic%', '%patient%', '%medical%'];
  let totalHits = 0;
  for (const t of res.rows) {
    const tableName = t.table_name;
    try {
      const colRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND data_type IN ('text', 'character varying');
      `, [tableName]);

      if (colRes.rows.length > 0) {
        for (const col of colRes.rows) {
          const colName = col.column_name;
          const query = `SELECT count(*) FROM "${tableName}" WHERE "${colName}" ILIKE ANY($1::text[])`;
          const countRes = await client.query(query, [PATTERNS]);
          const cnt = parseInt(countRes.rows[0].count, 10);
          if (cnt > 0) {
            console.log(`[MATCH] ${tableName}.${colName}: ${cnt} rows match`);
            totalHits += cnt;
          }
        }
      }
    } catch (e) {
      // Ignore tables with issues or permissions
    }
  }
  console.log('Total text column matches in entire PostgreSQL DB:', totalHits);
  await client.end();
}

main().catch(console.error);
