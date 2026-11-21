const pg = require('../apps/backend/node_modules/pg');
const pool = new pg.Pool({
  connectionString: 'postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable'
});

async function run() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%inventory%' OR table_name LIKE '%stock%' OR table_name LIKE '%dms_%')
    ORDER BY table_name;
  `);
  console.log('Tables:', res.rows.map(r => r.table_name));

  // Check columns of inventory_level if exists
  if (res.rows.some(r => r.table_name === 'inventory_level')) {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_level'
    `);
    console.log('inventory_level columns:', cols.rows);
  }

  // Check columns of dms_distributor_inventory
  if (res.rows.some(r => r.table_name === 'dms_distributor_inventory')) {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dms_distributor_inventory'
    `);
    console.log('dms_distributor_inventory columns:', cols.rows);
  }

  // Check columns of dms_inventory_movement
  if (res.rows.some(r => r.table_name === 'dms_inventory_movement')) {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'dms_inventory_movement'
    `);
    console.log('dms_inventory_movement columns:', cols.rows);
  }

  await pool.end();
}

run().catch(console.error);
