import pg from '../apps/backend/node_modules/pg/lib/index.js';

const ADMIN_EMAIL = 'admin@sai-ajanta.com';
const ADMIN_PASSWORD = 'Admin1234!';
const BASE_URL = 'http://localhost:9000';

async function main() {
  console.log('=== TASK 02 & 07: AUDITING & TESTING ALL ADMIN MUTATIONS & DYNAMIC APIS ===\n');

  // Authenticate
  const authRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!authRes.ok) {
    console.error('Failed to log in as admin:', authRes.status);
    process.exit(1);
  }
  const { token } = await authRes.json();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const results = [];

  // --- 1. Product Create & Update ---
  console.log('--- 1. Testing Product Mutations ---');
  const testSku = `TEST-SKU-${Date.now().toString().slice(-6)}`;
  try {
    const createProdRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: testSku,
        name: `Automated Test Bracket ${testSku}`,
        category: 'Aluminium',
        subcategory: 'Channels',
        brand: 'Sai Ajantha',
        customerPriceInr: 1250,
        dealerPriceInr: 1100,
        distributorPriceInr: 950,
        billingUnit: 'PIECE',
        gstRate: 18,
        stockQty: 50,
        isManufactured: true,
        cmsStatus: 'DRAFT',
      }),
    });
    const createProdData = await createProdRes.json();
    console.log(`[POST ${createProdRes.status}] /admin/sai-ajanta/products (Create) ->`, createProdData.success ? 'SUCCESS' : createProdData);
    results.push({ name: 'createProduct', status: createProdRes.status, ok: createProdRes.ok });

    if (createProdRes.ok && createProdData.product) {
      const prodId = createProdData.product.id || testSku;
      // Test GET /products/:id
      const getProdRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, { headers });
      const getProdData = await getProdRes.json();
      console.log(`[GET ${getProdRes.status}] /admin/sai-ajanta/products/${testSku} ->`, getProdData.product ? `Found: ${getProdData.product.name}` : getProdData);
      results.push({ name: 'getProductDetailBySku', status: getProdRes.status, ok: getProdRes.ok });

      // Test PATCH /products/:id (Update name and stock)
      const patchProdRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: `Automated Test Bracket ${testSku} (Updated)`,
          stockQty: 75,
          cmsStatus: 'REVIEW',
        }),
      });
      const patchProdData = await patchProdRes.json();
      console.log(`[PATCH ${patchProdRes.status}] /admin/sai-ajanta/products/${testSku} ->`, patchProdData.ok ? 'SUCCESS' : patchProdData);
      results.push({ name: 'updateProduct', status: patchProdRes.status, ok: patchProdRes.ok });
    }
  } catch (err) {
    console.error('Product mutation error:', err);
    results.push({ name: 'createProduct', status: 0, ok: false, error: err.message });
  }

  // --- 2. Customer / Partner Create & Update ---
  console.log('\n--- 2. Testing Customer & Partner Mutations ---');
  const testPhone = `98${Date.now().toString().slice(-8)}`;
  const testEmail = `partner_${Date.now().toString().slice(-6)}@example.com`;
  let createdCustomerId = null;
  try {
    const createCustRes = await fetch(`${BASE_URL}/admin/sai-ajanta/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Partner Hardware',
        phone: testPhone,
        email: testEmail,
        role: 'DEALER',
        status: 'PENDING_APPROVAL',
        gstin: '33AAAAA0000A1Z5',
        city: 'Madurai',
      }),
    });
    const createCustData = await createCustRes.json();
    console.log(`[POST ${createCustRes.status}] /admin/sai-ajanta/customers (Create Dealer) ->`, createCustData.customer ? 'SUCCESS' : createCustData);
    results.push({ name: 'createCustomerAccount', status: createCustRes.status, ok: createCustRes.ok });

    createdCustomerId = createCustData.customer?.id;
    if (createdCustomerId) {
      // Test Approve Dealer
      const updateCustRes = await fetch(`${BASE_URL}/admin/sai-ajanta/customers/${encodeURIComponent(createdCustomerId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'ACTIVE',
          role: 'DEALER',
        }),
      });
      const updateCustData = await updateCustRes.json();
      console.log(`[PATCH ${updateCustRes.status}] /admin/sai-ajanta/customers/${createdCustomerId} (Approve) ->`, updateCustData.profile ? 'SUCCESS' : updateCustData);
      results.push({ name: 'updateCustomerProfile', status: updateCustRes.status, ok: updateCustRes.ok });
    }
  } catch (err) {
    console.error('Customer mutation error:', err);
    results.push({ name: 'customerMutations', status: 0, ok: false, error: err.message });
  }

  // --- 3. Enquiries GET & Status Update ---
  console.log('\n--- 3. Testing Enquiries APIs ---');
  try {
    const listEnqRes = await fetch(`${BASE_URL}/admin/sai-ajanta/enquiries`, { headers });
    const listEnqData = await listEnqRes.json();
    console.log(`[GET ${listEnqRes.status}] /admin/sai-ajanta/enquiries ->`, `Count: ${listEnqData.count || 0}`);
    results.push({ name: 'listEnquiries', status: listEnqRes.status, ok: listEnqRes.ok });

    if (listEnqData.enquiries && listEnqData.enquiries.length > 0) {
      const enq = listEnqData.enquiries[0];
      const patchEnqRes = await fetch(`${BASE_URL}/admin/sai-ajanta/enquiries/${encodeURIComponent(enq.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'IN_REVIEW' }),
      });
      const patchEnqData = await patchEnqRes.json();
      console.log(`[PATCH ${patchEnqRes.status}] /admin/sai-ajanta/enquiries/${enq.id} (IN_REVIEW) ->`, patchEnqData.ok ? 'SUCCESS' : patchEnqData);
      results.push({ name: 'updateEnquiryStatus', status: patchEnqRes.status, ok: patchEnqRes.ok });
    }
  } catch (err) {
    console.error('Enquiry mutation error:', err);
    results.push({ name: 'enquiriesApis', status: 0, ok: false, error: err.message });
  }

  // --- 4. Trade Quotes Create & Update ---
  console.log('\n--- 4. Testing Trade Quote Mutations ---');
  try {
    const createQuoteRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer_name: 'Trichy Glass & Aluminium',
        customer_email: 'trichy.glass@example.com',
        organization: 'Trichy Glass Works',
        division: 'Floor Spring BOQ',
        items: [
          { sku: 'SA-I-FS-TON90-007', name: 'Floor Spring 90kg Heavy', quantity: 4, unitPriceInr: 3400 },
        ],
        customer_notes: 'Formal BOQ nonpayable quotation for site work',
      }),
    });
    const createQuoteData = await createQuoteRes.json();
    console.log(`[POST ${createQuoteRes.status}] /admin/sai-ajanta/quotes (Create) ->`, createQuoteData.quote ? `Quote #${createQuoteData.quote.quote_number}` : createQuoteData);
    results.push({ name: 'createTradeQuote', status: createQuoteRes.status, ok: createQuoteRes.ok });

    if (createQuoteData.quote) {
      const qId = createQuoteData.quote.id;
      // Test GET /quotes/:id
      const getQuoteRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes/${encodeURIComponent(qId)}`, { headers });
      const getQuoteData = await getQuoteRes.json();
      console.log(`[GET ${getQuoteRes.status}] /admin/sai-ajanta/quotes/${qId} ->`, getQuoteData.quote ? 'SUCCESS' : getQuoteData);
      results.push({ name: 'getQuoteDetail', status: getQuoteRes.status, ok: getQuoteRes.ok });

      // Test PATCH /quotes/:id (Status REVIEWED)
      const patchQuoteRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes/${encodeURIComponent(qId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'REVIEWED',
          internal_notes: 'Reviewed by engineering lead',
        }),
      });
      const patchQuoteData = await patchQuoteRes.json();
      console.log(`[PATCH ${patchQuoteRes.status}] /admin/sai-ajanta/quotes/${qId} (Review) ->`, patchQuoteData.quote ? 'SUCCESS' : patchQuoteData);
      results.push({ name: 'updateTradeQuote', status: patchQuoteRes.status, ok: patchQuoteRes.ok });
    }
  } catch (err) {
    console.error('Quote mutation error:', err);
    results.push({ name: 'quotesApis', status: 0, ok: false, error: err.message });
  }

  // --- 5. Admin Settings Update ---
  console.log('\n--- 5. Testing Admin Settings PUT ---');
  try {
    const putSettingsRes = await fetch(`${BASE_URL}/admin/sai-ajanta/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        default_page_size: 25,
        display_locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        low_stock_threshold: 15,
      }),
    });
    const putSettingsData = await putSettingsRes.json();
    console.log(`[PUT ${putSettingsRes.status}] /admin/sai-ajanta/settings ->`, putSettingsData.settings ? `Version ${putSettingsData.settings.version}` : putSettingsData);
    results.push({ name: 'updateAdminSettings', status: putSettingsRes.status, ok: putSettingsRes.ok });
  } catch (err) {
    console.error('Settings PUT error:', err);
    results.push({ name: 'updateAdminSettings', status: 0, ok: false, error: err.message });
  }

  // --- 6. Pricing & Promotions Create Draft ---
  console.log('\n--- 6. Testing Promotion Draft Mutation ---');
  const promoCode = `PROMO${Date.now().toString().slice(-6)}`;
  try {
    const createPromoRes = await fetch(`${BASE_URL}/admin/sai-ajanta/promotions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: promoCode,
        title: 'Spring Season Trade Discount',
        target_tier: 'DEALER',
        category_scope: 'Aluminium',
        discount_percent: 10,
        status: 'DRAFT',
      }),
    });
    const createPromoData = await createPromoRes.json();
    console.log(`[POST ${createPromoRes.status}] /admin/sai-ajanta/promotions (Create) ->`, createPromoData.promotion ? `Code: ${createPromoData.promotion.code}` : createPromoData);
    results.push({ name: 'createPromotionDraft', status: createPromoRes.status, ok: createPromoRes.ok });
  } catch (err) {
    console.error('Promotion mutation error:', err);
    results.push({ name: 'promotionsApis', status: 0, ok: false, error: err.message });
  }

  // --- 7. Returns GET Endpoint ---
  console.log('\n--- 7. Testing Returns GET Endpoint ---');
  try {
    const listReturnsRes = await fetch(`${BASE_URL}/admin/sai-ajanta/returns`, { headers });
    const listReturnsData = await listReturnsRes.json();
    console.log(`[GET ${listReturnsRes.status}] /admin/sai-ajanta/returns ->`, `Count: ${listReturnsData.count || 0}`);
    results.push({ name: 'listReturns', status: listReturnsRes.status, ok: listReturnsRes.ok });
  } catch (err) {
    console.error('Returns GET error:', err);
    results.push({ name: 'returnsApis', status: 0, ok: false, error: err.message });
  }

  // --- 8. Staff User Creation & Update ---
  console.log('\n--- 8. Testing Staff Directory Mutations ---');
  const staffEmail = `test.staff.${Date.now().toString().slice(-4)}@sai-ajanta.com`;
  try {
    const createStaffRes = await fetch(`${BASE_URL}/admin/sai-ajanta/staff`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: staffEmail,
        first_name: 'Saravanan',
        last_name: 'Murugan',
        password: 'StaffPassword123!',
        permissions: ['CATALOG_MANAGE', 'ORDERS_MANAGE'],
      }),
    });
    const createStaffData = await createStaffRes.json();
    console.log(`[POST ${createStaffRes.status}] /admin/sai-ajanta/staff (Create) ->`, createStaffData.staff ? `Created ID ${createStaffData.staff.id}` : createStaffData);
    results.push({ name: 'createStaffUser', status: createStaffRes.status, ok: createStaffRes.ok });

    if (createStaffData.staff?.id) {
      const staffId = createStaffData.staff.id;
      const updateStaffRes = await fetch(`${BASE_URL}/admin/sai-ajanta/staff/${encodeURIComponent(staffId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          active: true,
          permissions: ['CATALOG_MANAGE', 'ORDERS_MANAGE', 'ENQUIRIES_MANAGE'],
        }),
      });
      const updateStaffData = await updateStaffRes.json();
      console.log(`[PATCH ${updateStaffRes.status}] /admin/sai-ajanta/staff/${staffId} (Update) ->`, updateStaffData.staff ? 'SUCCESS' : updateStaffData);
      results.push({ name: 'updateStaffUser', status: updateStaffRes.status, ok: updateStaffRes.ok });
    }
  } catch (err) {
    console.error('Staff mutation error:', err);
    results.push({ name: 'staffApis', status: 0, ok: false, error: err.message });
  }

  // --- 9. Clean up test product from DB so rehearsal DB stays pristine ---
  console.log('\n--- 9. Cleaning up test records ---');
  try {
    const pool = new pg.Pool({ connectionString: 'postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable' });
    await pool.query('DELETE FROM product WHERE handle LIKE $1 OR id IN (SELECT id FROM product WHERE metadata->>\'sku\' LIKE $1)', [`%${testSku}%`]);
    if (createdCustomerId) {
      await pool.query('DELETE FROM customer WHERE id = $1', [createdCustomerId]);
      await pool.query('DELETE FROM account_profile WHERE customer_id = $1', [createdCustomerId]);
    }
    await pool.query('DELETE FROM dms_trade_promo_draft WHERE code = $1', [promoCode]);
    await pool.end();
    console.log('Cleanup completed cleanly.');
  } catch (cleanErr) {
    console.warn('Cleanup warning:', cleanErr.message);
  }

  console.log('\n=== MUTATION AUDIT RESULTS ===');
  const allPassed = results.every(r => r.ok);
  results.forEach(r => console.log(`  ${r.ok ? '✓ PASS' : '✗ FAIL'} [HTTP ${r.status}] ${r.name}`));
  console.log(`\nOverall Result: ${allPassed ? 'ALL MUTATION & DYNAMIC TESTS PASSED' : 'SOME TESTS FAILED'}`);

  if (!allPassed) process.exit(1);
}

main().catch(console.error);
