import pg from '../apps/backend/node_modules/pg/lib/index.js';

const pool = new pg.Pool({
  connectionString: 'postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable',
});

async function main() {
  const ids = [
    'prod_01M7Q2J8MG67ZP3KC423SB7VC2',
    'prod_01M7Q2K8HBWYWSRPSK66N5KZ5G'
  ];

  for (const id of ids) {
    const variants = await pool.query('SELECT id FROM product_variant WHERE product_id = $1', [id]);
    const varIds = variants.rows.map(v => v.id);
    if (varIds.length > 0) {
      await pool.query('DELETE FROM product_variant_price_set WHERE variant_id = ANY($1)', [varIds]);
      await pool.query('DELETE FROM product_variant WHERE id = ANY($1)', [varIds]);
    }
    await pool.query('DELETE FROM product_category_product WHERE product_id = $1', [id]);
    await pool.query('DELETE FROM product WHERE id = $1', [id]);
    console.log(`Cleaned up test product ${id}`);
  }

  const count = await pool.query('SELECT count(*) FROM product WHERE deleted_at IS NULL');
  console.log('Total live products now:', count.rows[0].count);

  await pool.end();
}

main().catch(console.error);
