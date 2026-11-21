import pg from '../apps/backend/node_modules/pg/lib/index.js';

const ADMIN_EMAIL = 'admin@sai-ajanta.com';
const ADMIN_PASSWORD = 'Admin1234!';
const BASE_URL = 'http://localhost:9000';

async function main() {
  console.log('=== TASK 01: COMPREHENSIVE ADMIN API AUDIT ===\n');

  // 1. Check DB connections and tables
  console.log('--- 1. DATABASE AUDIT ---');
  const dbs = ['medusa', 'medusa_restore_rehearsal_disposable'];
  for (const dbName of dbs) {
    try {
      const client = new pg.Client(`postgres://medusa:medusa@localhost:5432/${dbName}`);
      await client.connect();
      const res = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
      console.log(`DB [${dbName}]: Connected! Public tables count: ${res.rows[0].count}`);
      
      const dmsTables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND (table_name LIKE '%dms%' OR table_name LIKE '%trade%' OR table_name LIKE '%setting%' OR table_name LIKE '%quote%' OR table_name LIKE '%distributor%' OR table_name LIKE '%promo%')
        ORDER BY table_name;
      `);
      console.log(`DB [${dbName}] relevant tables (${dmsTables.rows.length}):`, dmsTables.rows.map(r => r.table_name).join(', '));
      await client.end();
    } catch (e) {
      console.log(`DB [${dbName}]: Connection error:`, e.message);
    }
  }

  // 2. Authenticate admin user
  console.log('\n--- 2. AUTHENTICATION TEST ---');
  let token = null;
  try {
    const authRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const authData = await authRes.json();
    console.log(`Auth HTTP Status: ${authRes.status}`);
    if (authRes.ok && authData.token) {
      token = authData.token;
      console.log('Admin Token successfully obtained!');
    } else {
      console.error('Failed to obtain admin token:', authData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Auth request exception:', err);
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. Test list of GET endpoints
  console.log('\n--- 3. GET ENDPOINTS AUDIT ---');
  const getEndpoints = [
    { path: '/admin/sai-ajanta/me', name: 'Staff Profile (Me)', page: 'All / Global' },
    { path: '/admin/sai-ajanta/portal', name: 'Portal Summary (Users, Orders, Products, Reports)', page: 'Dashboard / Products / Orders / Partners' },
    { path: '/admin/sai-ajanta/overview', name: 'Overview (Categories, Locations)', page: 'Categories / Overview' },
    { path: '/admin/sai-ajanta/analytics', name: 'Analytics KPIs & Charts', page: 'Dashboard / Reports' },
    { path: '/admin/sai-ajanta/analytics?fy=FY2025-26', name: 'Analytics with FY Filter', page: 'Reports' },
    { path: '/admin/sai-ajanta/products', name: 'Products List', page: 'Products' },
    { path: '/admin/sai-ajanta/orders', name: 'Orders List', page: 'Orders' },
    { path: '/admin/sai-ajanta/customers', name: 'Customers List', page: 'Customers / Partners' },
    { path: '/admin/sai-ajanta/settings', name: 'Admin Settings', page: 'Settings' },
    { path: '/admin/sai-ajanta/quotes', name: 'Trade Quotes', page: 'Quotes' },
    { path: '/admin/sai-ajanta/promotions', name: 'Promotions Drafts', page: 'Pricing & Promotions' },
    { path: '/admin/sai-ajanta/inventory/ledger', name: 'Inventory Ledger & Reservations', page: 'Inventory' },
    { path: '/admin/sai-ajanta/seller-coverage', name: 'Seller Coverage Matrix', page: 'Seller Coverage' },
    { path: '/admin/sai-ajanta/audit-log', name: 'Staff Audit Log', page: 'Settings / Audit Log' },
    { path: '/admin/sai-ajanta/staff', name: 'Staff Directory', page: 'Settings / Staff' },
    { path: '/admin/sai-ajanta/distributors/coverage', name: 'Distributor Coverage', page: 'Partners / Distributors' },
    { path: '/admin/sai-ajanta/distributors/purchase-orders', name: 'Distributor Purchase Orders', page: 'Partners / Distributors' },
    { path: '/admin/sai-ajanta/distributors/financial-separation', name: 'Financial Separation Summary', page: 'Partners / Distributors' },
  ];

  const auditResults = [];

  for (const ep of getEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, { headers });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}
      const isJson = data !== null;
      const status = res.status;
      let summary = '';
      if (res.ok) {
        if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          summary = `Keys: [${keys.join(', ')}]`;
          if (Array.isArray(data.products)) summary += ` (${data.products.length} products)`;
          if (Array.isArray(data.orders)) summary += ` (${data.orders.length} orders)`;
          if (Array.isArray(data.users)) summary += ` (${data.users.length} users)`;
          if (Array.isArray(data.staff)) summary += ` (${data.staff.length} staff)`;
          if (Array.isArray(data.events)) summary += ` (${data.events.length} events)`;
          if (Array.isArray(data.quotes)) summary += ` (${data.quotes.length} quotes)`;
          if (data.settings) summary += ` (settings ver ${data.settings.version})`;
        }
      } else {
        summary = `Error: ${text.slice(0, 150)}`;
      }
      console.log(`[GET ${status}] ${ep.path} -> ${summary}`);
      auditResults.push({
        method: 'GET',
        path: ep.path,
        name: ep.name,
        page: ep.page,
        status,
        ok: res.ok,
        summary,
        raw: data
      });
    } catch (err) {
      console.log(`[GET FAIL] ${ep.path} -> Network/Fetch Error: ${err.message}`);
      auditResults.push({
        method: 'GET',
        path: ep.path,
        name: ep.name,
        page: ep.page,
        status: 0,
        ok: false,
        summary: `Network/Fetch error: ${err.message}`,
        raw: null
      });
    }
  }

  // 4. Test Single-resource GETs where applicable (e.g. products/:id, orders/:id, customers/:id)
  console.log('\n--- 4. SINGLE RECORD GET AUDIT ---');
  // Find a product ID and order ID from portal
  const portalRes = auditResults.find(r => r.path === '/admin/sai-ajanta/portal');
  if (portalRes && portalRes.raw) {
    const products = portalRes.raw.products || [];
    const orders = portalRes.raw.orders || [];
    const users = portalRes.raw.users || [];

    if (products.length > 0) {
      const prod = products[0];
      const prodId = prod.id || prod.medusa_id;
      const pRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${prodId}`, { headers });
      console.log(`[GET ${pRes.status}] /admin/sai-ajanta/products/${prodId} (Target: Product Detail)`);
    }

    if (orders.length > 0) {
      const ord = orders[0];
      const oRes = await fetch(`${BASE_URL}/admin/sai-ajanta/orders/${ord.id}`, { headers });
      console.log(`[GET ${oRes.status}] /admin/sai-ajanta/orders/${ord.id} (Target: Order Detail)`);
    }

    if (users.length > 0) {
      const usr = users[0];
      const uRes = await fetch(`${BASE_URL}/admin/sai-ajanta/customers/${usr.id}`, { headers });
      console.log(`[GET ${uRes.status}] /admin/sai-ajanta/customers/${usr.id} (Target: Customer/Partner Detail)`);
    }
  }

  console.log('\n--- AUDIT COMPLETE ---');
}

main().catch(console.error);
