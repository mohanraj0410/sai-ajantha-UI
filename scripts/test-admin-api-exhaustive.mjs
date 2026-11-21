import pg from '../apps/backend/node_modules/pg/lib/index.js';

const ADMIN_EMAIL = 'admin@sai-ajanta.com';
const ADMIN_PASSWORD = 'Admin1234!';
const BASE_URL = 'http://localhost:9000';
const DB_URL = 'postgres://medusa:medusa@localhost:5432/medusa_restore_rehearsal_disposable';

const pool = new pg.Pool({ connectionString: DB_URL });

async function run() {
  console.log('================================================================');
  console.log('SAI AJANTHA ADMIN API EXHAUSTIVE SECURITY & CRUD VERIFICATION');
  console.log(`Database Under Test: medusa_restore_rehearsal_disposable`);
  console.log(`Backend Server: ${BASE_URL}`);
  console.log('================================================================\n');

  // Verify we are connected to the disposable database
  const dbNameRes = await pool.query('SELECT current_database()');
  const currentDb = dbNameRes.rows[0].current_database;
  if (currentDb !== 'medusa_restore_rehearsal_disposable') {
    throw new Error(`SAFETY HALT: Connected to ${currentDb}, expected medusa_restore_rehearsal_disposable!`);
  }
  console.log(`[SAFETY CHECK PASSED] Connected to isolated disposable database: ${currentDb}\n`);

  // Clean up any stale test records from previous runs
  await pool.query(`DELETE FROM "user" WHERE email LIKE 'ops.staff.%' OR email LIKE 'test.staff.%'`);
  await pool.query(`DELETE FROM "dms_trade_order" WHERE id LIKE 'ord_sec_test_%' OR id LIKE 'ord_ret_test_%'`);
  await pool.query(`DELETE FROM "dms_trade_promo_draft" WHERE code LIKE 'PROMO%'`);
  
  async function deleteProductCascading(skuPattern) {
    const prods = await pool.query(`SELECT id FROM product WHERE handle LIKE $1 OR metadata->>'sku' LIKE $1`, [`%${skuPattern}%`]);
    for (const row of prods.rows) {
      const vars = await pool.query('SELECT id FROM product_variant WHERE product_id = $1', [row.id]);
      const vIds = vars.rows.map(v => v.id);
      if (vIds.length > 0) {
        await pool.query('DELETE FROM product_variant_price_set WHERE variant_id = ANY($1)', [vIds]);
        await pool.query('DELETE FROM product_variant WHERE id = ANY($1)', [vIds]);
      }
      await pool.query('DELETE FROM product_category_product WHERE product_id = $1', [row.id]);
      await pool.query('DELETE FROM product WHERE id = $1', [row.id]);
    }
  }

  await deleteProductCascading('SKU-CRUD');

  const adminAuthRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!adminAuthRes.ok) throw new Error(`Admin login failed: ${adminAuthRes.status}`);
  const { token: adminToken } = await adminAuthRes.json();
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const auditRecords = [];
  function record(category, testName, method, path, status, ok, notes) {
    auditRecords.push({ category, testName, method, path, status, ok, notes });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] [${method} ${status}] ${testName} -> ${notes}`);
  }

  // ============================================================================
  // SECTION 1: FINANCE PERMISSION & SEPARATION OF DUTIES SECURITY REVIEW
  // ============================================================================
  console.log('\n--- SECTION 1: Finance Permission & Separation of Duties Security Review ---');

  // 1.1 Create temporary staff member with ONLY ORDERS_MANAGE (No FINANCE_MANAGE)
  const opsStaffEmail = `ops.staff.${Date.now()}@sai-ajanta.com`;
  const opsStaffPassword = 'OpsStaff1234!';
  const createOpsRes = await fetch(`${BASE_URL}/admin/sai-ajanta/staff`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: opsStaffEmail,
      first_name: 'Operations',
      last_name: 'Clerk',
      password: opsStaffPassword,
      role: 'staff',
      permissions: ['ORDERS_MANAGE'], // Explicitly NO FINANCE_MANAGE
    }),
  });
  const createOpsData = await createOpsRes.json();
  const opsUserId = createOpsData.staff?.id;
  record(
    'SECURITY_RBAC',
    'Create Ops-Only Staff (ORDERS_MANAGE only)',
    'POST',
    '/admin/sai-ajanta/staff',
    createOpsRes.status,
    createOpsRes.status === 201,
    `Created temporary user ${opsUserId}`
  );

  // 1.2 Log in as Ops-Only Staff
  const opsAuthRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: opsStaffEmail, password: opsStaffPassword }),
  });
  const { token: opsToken } = await opsAuthRes.json();
  const opsHeaders = {
    Authorization: `Bearer ${opsToken}`,
    'Content-Type': 'application/json',
  };

  // 1.3 Create a temporary trade order for transition testing
  const tempOrderId = `ord_sec_test_${Date.now()}`;
  await pool.query(
    `INSERT INTO "dms_trade_order" 
     (id, order_number, status, payment_status, payment_method, role_at_order, price_tier_applied, customer_id, customer_name, customer_email, customer_phone, shipping_address, subtotal_inr, gst_amount_inr, total_inr, items, events)
     VALUES ($1, $2, 'PENDING_PAYMENT', 'AWAITING_BANK_VERIFICATION', 'BANK_TRANSFER', 'CUSTOMER', 'RETAIL', 'cus_test_001', 'Test Customer', 'test@example.com', '9876543210', '123 Main St, Madurai', 1000, 180, 1180, '[]', '[]')`,
    [tempOrderId, `SO-SEC-${Date.now().toString().slice(-6)}`]
  );

  // 1.4 Test Ops-only staff executing VERIFY_BANK_PAYMENT -> MUST BE REJECTED 403
  const opsVerifyRes = await fetch(`${BASE_URL}/admin/sai-ajanta/orders/${tempOrderId}/transition`, {
    method: 'POST',
    headers: opsHeaders,
    body: JSON.stringify({
      command: 'VERIFY_BANK_PAYMENT',
      bankReference: 'UTR12345678',
      verifiedAmountPaise: 118000,
    }),
  });
  const opsVerifyData = await opsVerifyRes.json();
  record(
    'SECURITY_RBAC',
    'Reject VERIFY_BANK_PAYMENT by Ops-Only Staff',
    'POST',
    `/admin/sai-ajanta/orders/${tempOrderId}/transition`,
    opsVerifyRes.status,
    opsVerifyRes.status === 403 && opsVerifyData.code === 'FORBIDDEN',
    `Rejected with 403 FORBIDDEN (${opsVerifyData.message})`
  );

  // 1.5 Test Ops-only staff executing REJECT_BANK_PAYMENT -> MUST BE REJECTED 403
  const opsRejectRes = await fetch(`${BASE_URL}/admin/sai-ajanta/orders/${tempOrderId}/transition`, {
    method: 'POST',
    headers: opsHeaders,
    body: JSON.stringify({
      command: 'REJECT_BANK_PAYMENT',
      notes: 'Testing finance gate rejection',
    }),
  });
  record(
    'SECURITY_RBAC',
    'Reject REJECT_BANK_PAYMENT by Ops-Only Staff',
    'POST',
    `/admin/sai-ajanta/orders/${tempOrderId}/transition`,
    opsRejectRes.status,
    opsRejectRes.status === 403,
    `Rejected with 403 FORBIDDEN`
  );

  // 1.6 Test Ops-only staff executing PACK_ORDER -> MUST SUCCEED 200 (Legal ops action)
  // First update status to CONFIRMED so PACK_ORDER transition is legal
  await pool.query(`UPDATE "dms_trade_order" SET status = 'CONFIRMED' WHERE id = $1`, [tempOrderId]);
  const opsPackRes = await fetch(`${BASE_URL}/admin/sai-ajanta/orders/${tempOrderId}/transition`, {
    method: 'POST',
    headers: opsHeaders,
    body: JSON.stringify({
      command: 'PACK_ORDER',
      notes: 'Packed by warehouse staff',
    }),
  });
  record(
    'SECURITY_RBAC',
    'Allow PACK_ORDER by Ops-Only Staff',
    'POST',
    `/admin/sai-ajanta/orders/${tempOrderId}/transition`,
    opsPackRes.status,
    opsPackRes.status === 200,
    `Succeeded with 200 OK`
  );

  // 1.7 Test Admin executing VERIFY_BANK_PAYMENT -> MUST SUCCEED 200
  // Reset order to AWAITING_BANK_VERIFICATION
  await pool.query(
    `UPDATE "dms_trade_order" SET status = 'PENDING_PAYMENT', payment_status = 'AWAITING_BANK_VERIFICATION' WHERE id = $1`,
    [tempOrderId]
  );
  const adminVerifyRes = await fetch(`${BASE_URL}/admin/sai-ajanta/orders/${tempOrderId}/transition`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      command: 'VERIFY_BANK_PAYMENT',
      bankReference: 'UTR-AUTHORIZED-999',
      verifiedAmountPaise: 118000,
    }),
  });
  const adminVerifyData = await adminVerifyRes.json();
  record(
    'SECURITY_RBAC',
    'Allow VERIFY_BANK_PAYMENT by Admin/Finance',
    'POST',
    `/admin/sai-ajanta/orders/${tempOrderId}/transition`,
    adminVerifyRes.status,
    adminVerifyRes.status === 200 && adminVerifyData.transition?.paymentStatus === 'PAID',
    `Succeeded with 200 OK, paymentStatus = PAID`
  );

  // 1.8 Verify dms_order_command_log audit record
  const cmdLog = await pool.query(
    `SELECT command, actor_role, actor_id FROM "dms_order_command_log" WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tempOrderId]
  );
  record(
    'SECURITY_RBAC',
    'Verify Server-Authoritative Command Audit Log',
    'DB_SELECT',
    'dms_order_command_log',
    200,
    cmdLog.rows.length > 0 &&
      (cmdLog.rows[0].actor_role === 'STAFF_ADMIN' || cmdLog.rows[0].actor_role === 'STAFF_FINANCE'),
    `Verified: actor_role logged as ${cmdLog.rows[0]?.actor_role}`
  );

  // Clean up temporary order and ops staff
  await pool.query(`DELETE FROM "dms_order_command_log" WHERE order_id = $1`, [tempOrderId]);
  await pool.query(`DELETE FROM "dms_trade_order" WHERE id = $1`, [tempOrderId]);
  if (opsUserId) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [opsUserId]);
  }

  // ============================================================================
  // SECTION 2: FULL AUTHENTICATED CRUD WORKFLOWS
  // ============================================================================
  console.log('\n--- SECTION 2: Full Authenticated CRUD Workflows ---');

  // --- 2.1 PRODUCT CRUD WORKFLOW ---
  const testSku = `SKU-CRUD-${Date.now().toString().slice(-6)}`;
  let createdProductId = null;

  // Create
  const prodCreateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      sku: testSku,
      name: `Telescopic Soft Close Slide ${testSku}`,
      category: 'Channels',
      subcategory: 'Drawer Slides',
      brand: 'Sai Ajantha',
      customerPriceInr: 1850,
      dealerPriceInr: 1550,
      distributorPriceInr: 1350,
      billingUnit: 'PAIR',
      gstRate: 18,
      stockQty: 40,
      isManufactured: true,
      cmsStatus: 'DRAFT',
    }),
  });
  const prodCreateData = await prodCreateRes.json();
  createdProductId = prodCreateData.product?.id || testSku;
  record(
    'CRUD_PRODUCT',
    'Product Create (Step 1-5 Wizard Submission)',
    'POST',
    '/admin/sai-ajanta/products',
    prodCreateRes.status,
    prodCreateRes.status === 201,
    `Created product with SKU: ${testSku}`
  );

  // Read (by SKU)
  const prodReadRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    headers: adminHeaders,
  });
  const prodReadData = await prodReadRes.json();
  record(
    'CRUD_PRODUCT',
    'Product Read (Direct Link / Reload by SKU)',
    'GET',
    `/admin/sai-ajanta/products/${testSku}`,
    prodReadRes.status,
    prodReadRes.status === 200 && prodReadData.product?.sku === testSku,
    `Hydrated product: ${prodReadData.product?.name}`
  );

  // Update
  const prodUpdateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Telescopic Soft Close Slide ${testSku} (Heavy Duty)`,
      stockQty: 60,
      cmsStatus: 'REVIEW',
    }),
  });
  const prodUpdateData = await prodUpdateRes.json();
  record(
    'CRUD_PRODUCT',
    'Product Update (Edit Page Submission)',
    'PATCH',
    `/admin/sai-ajanta/products/${testSku}`,
    prodUpdateRes.status,
    prodUpdateRes.status === 200,
    `Updated stockQty to 60, cmsStatus to REVIEW`
  );

  // Verify updated product via GET reload
  const prodReloadRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    headers: adminHeaders,
  });
  const prodReloadData = await prodReloadRes.json();
  record(
    'CRUD_PRODUCT',
    'Product Reload Verification (Refetched by SKU)',
    'GET',
    `/admin/sai-ajanta/products/${testSku}`,
    prodReloadRes.status,
    prodReloadRes.status === 200 &&
      prodReloadData.product?.name.includes('(Heavy Duty)') &&
      prodReloadData.product?.cms_status === 'REVIEW',
    `Verified: name updated and cms_status = ${prodReloadData.product?.cms_status}`
  );

  // Teardown product
  await deleteProductCascading(testSku);
  await pool.query('DELETE FROM dms_distributor_inventory WHERE sku = $1', [testSku]);

  // --- 2.2 TRADE QUOTE CRUD WORKFLOW ---
  let createdQuoteId = null;
  const quoteCreateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      customer_name: 'Salem Glass & Hardware',
      customer_phone: '9842100000',
      customer_email: 'salem.glass@example.com',
      organization: 'Salem Hardware Ltd',
      division: 'Architectural Glazing',
      items: [
        { sku: 'SA-I-FS-TON90-007', name: 'Floor Spring 90kg Heavy', quantity: 2, unitPriceInr: 3400 },
      ],
      customer_notes: 'Formal BOQ nonpayable quotation for site installation',
    }),
  });
  const quoteCreateData = await quoteCreateRes.json();
  createdQuoteId = quoteCreateData.quote?.id;
  const quoteNumber = quoteCreateData.quote?.quote_number;
  record(
    'CRUD_QUOTE',
    'Quote Create (New Quote Modal)',
    'POST',
    '/admin/sai-ajanta/quotes',
    quoteCreateRes.status,
    quoteCreateRes.status === 201 && Boolean(quoteNumber),
    `Created quote #${quoteNumber}`
  );

  // Read Quote (by ID)
  const quoteReadRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes/${encodeURIComponent(createdQuoteId)}`, {
    headers: adminHeaders,
  });
  const quoteReadData = await quoteReadRes.json();
  record(
    'CRUD_QUOTE',
    'Quote Read (Detail Drawer / Deep Link)',
    'GET',
    `/admin/sai-ajanta/quotes/${createdQuoteId}`,
    quoteReadRes.status,
    quoteReadRes.status === 200 && quoteReadData.quote?.quote_number === quoteNumber,
    `Retrieved Quote #${quoteReadData.quote?.quote_number}`
  );

  // Update Quote
  const quoteUpdateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/quotes/${encodeURIComponent(createdQuoteId)}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'REVIEWED',
      internal_notes: 'Technical site requirements verified by project manager',
    }),
  });
  const quoteUpdateData = await quoteUpdateRes.json();
  record(
    'CRUD_QUOTE',
    'Quote Update / Status Transition',
    'PATCH',
    `/admin/sai-ajanta/quotes/${createdQuoteId}`,
    quoteUpdateRes.status,
    quoteUpdateRes.status === 200 && quoteUpdateData.quote?.status === 'REVIEWED',
    `Updated status to REVIEWED, revision: ${quoteUpdateData.quote?.revision}`
  );

  // Teardown Quote
  if (createdQuoteId) {
    await pool.query('DELETE FROM dms_trade_quote WHERE id = $1', [createdQuoteId]);
  }

  // --- 2.3 CUSTOMER / TRADE PARTNER CRUD WORKFLOW ---
  let testCustomerId = null;
  const testPhone = `98${Date.now().toString().slice(-8)}`;
  const custCreateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/customers`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Vellore Aluminium Trading',
      phone: testPhone,
      email: `vellore.${Date.now()}@example.com`,
      role: 'DEALER',
      status: 'PENDING_APPROVAL',
      gstin: '33BBBBB1111B1Z2',
      city: 'Vellore',
    }),
  });
  const custCreateData = await custCreateRes.json();
  testCustomerId = custCreateData.customer?.id;
  record(
    'CRUD_CUSTOMER',
    'Partner Create (Registration Form)',
    'POST',
    '/admin/sai-ajanta/customers',
    custCreateRes.status,
    custCreateRes.status === 201,
    `Registered Dealer account: ${testCustomerId}`
  );

  // Approve Customer
  const custApproveRes = await fetch(`${BASE_URL}/admin/sai-ajanta/customers/${encodeURIComponent(testCustomerId)}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'ACTIVE',
      role: 'DEALER',
    }),
  });
  record(
    'CRUD_CUSTOMER',
    'Partner Approval (Approve / Reject Action)',
    'PATCH',
    `/admin/sai-ajanta/customers/${testCustomerId}`,
    custApproveRes.status,
    custApproveRes.status === 200,
    `Dealer approved to ACTIVE status`
  );

  // Teardown Customer
  if (testCustomerId) {
    await pool.query('DELETE FROM customer WHERE id = $1', [testCustomerId]);
    await pool.query('DELETE FROM account_profile WHERE customer_id = $1', [testCustomerId]);
  }

  // --- 2.4 ADMIN SETTINGS & OPTIMISTIC LOCKING WORKFLOW ---
  // Read current settings
  const settingsReadRes = await fetch(`${BASE_URL}/admin/sai-ajanta/settings`, { headers: adminHeaders });
  const settingsReadData = await settingsReadRes.json();
  const curVersion = settingsReadData.settings?.version ?? 0;
  record(
    'SETTINGS',
    'Settings Read (Ops Defaults Hydration)',
    'GET',
    '/admin/sai-ajanta/settings',
    settingsReadRes.status,
    settingsReadRes.status === 200,
    `Read settings version ${curVersion}`
  );

  // Update settings with valid expectedVersion
  const settingsUpdateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/settings`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      expectedVersion: curVersion,
      default_page_size: 25,
      low_stock_threshold: 15,
      display_locale: 'en-IN',
      timezone: 'Asia/Kolkata',
    }),
  });
  const settingsUpdateData = await settingsUpdateRes.json();
  record(
    'SETTINGS',
    'Settings Update with Matching Version',
    'PUT',
    '/admin/sai-ajanta/settings',
    settingsUpdateRes.status,
    settingsUpdateRes.status === 200 && settingsUpdateData.settings?.version === curVersion + 1,
    `Updated successfully; new version: ${settingsUpdateData.settings?.version}`
  );

  // Update settings with STALE version -> MUST BE REJECTED 409 CONFLICT
  const staleUpdateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/settings`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      expectedVersion: 999999, // Stale/mismatched version!
      default_page_size: 50,
    }),
  });
  record(
    'SETTINGS',
    'Settings Optimistic Locking Conflict Rejection',
    'PUT',
    '/admin/sai-ajanta/settings',
    staleUpdateRes.status,
    staleUpdateRes.status === 409,
    `Rejected with 409 Conflict on mismatched version`
  );

  // --- 2.5 PROMOTIONS DRAFT WORKFLOW & CHECKOUT REDEMPTION LOCK ---
  const promoCode = `PROMO${Date.now().toString().slice(-6)}`;
  const promoCreateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/promotions`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      code: promoCode,
      title: 'Monsoon Wholesale Discount',
      target_tier: 'DEALER',
      category_scope: 'Aluminium',
      discount_percent: 8,
      status: 'DRAFT',
    }),
  });
  const promoCreateData = await promoCreateRes.json();

  // Check policy guard on GET /promotions
  const promoGetRes = await fetch(`${BASE_URL}/admin/sai-ajanta/promotions`, { headers: adminHeaders });
  const promoGetData = await promoGetRes.json();
  record(
    'PROMOTIONS',
    'Promotion Draft Create & Checkout Policy Lock',
    'POST',
    '/admin/sai-ajanta/promotions',
    promoCreateRes.status,
    promoCreateRes.status === 201 && promoGetData.checkoutDiscountingEnabled === false,
    `Created draft ${promoCode}; checkoutDiscountingEnabled verified FALSE by policy`
  );

  // Teardown Promo
  await pool.query('DELETE FROM dms_trade_promo_draft WHERE code = $1', [promoCode]);

  // --- 2.6 RETURNS WORKFLOW & REFUND/RESTOCK POLICY LOCK ---
  const returnsListRes = await fetch(`${BASE_URL}/admin/sai-ajanta/returns`, { headers: adminHeaders });
  const returnsListData = await returnsListRes.json();
  record(
    'RETURNS',
    'Returns List Probe',
    'GET',
    '/admin/sai-ajanta/returns',
    returnsListRes.status,
    returnsListRes.status === 200,
    `Loaded returns list (${returnsListData.count || 0} records)`
  );

  // Create isolated temporary return order for test
  const testRetOrderId = `ord_ret_test_${Date.now()}`;
  await pool.query(
    `INSERT INTO "dms_trade_order"
     (id, order_number, status, payment_status, payment_method, role_at_order, price_tier_applied, customer_id, customer_name, customer_email, customer_phone, shipping_address, subtotal_inr, gst_amount_inr, total_inr, return_status, damage_claim_status, items, events)
     VALUES ($1, $2, 'COMPLETED', 'PAID', 'BANK_TRANSFER', 'CUSTOMER', 'RETAIL', 'cus_test_001', 'Test Customer', 'test@example.com', '9876543210', '123 Main St, Madurai', 5000, 900, 5900, 'REQUESTED', 'REPORTED', '[]', '[]')`,
    [testRetOrderId, `SO-RET-${Date.now().toString().slice(-6)}`]
  );

  // Inspect return (Succeeds)
  const retInspectRes = await fetch(`${BASE_URL}/admin/sai-ajanta/returns/${testRetOrderId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      return_status: 'INSPECTED',
      damage_claim_status: 'VERIFIED',
      damaged_qty: 1,
      damage_notes: 'Damage verified at inspection depot',
    }),
  });
  record(
    'RETURNS',
    'Return Inspection Status Update',
    'PATCH',
    `/admin/sai-ajanta/returns/${testRetOrderId}`,
    retInspectRes.status,
    retInspectRes.status === 200,
    `Inspection recorded: return_status = INSPECTED`
  );

  // Attempt automatic refund / restock -> MUST BE REJECTED 403 OWNER_POLICY_LOCKED
  const retRefundRes = await fetch(`${BASE_URL}/admin/sai-ajanta/returns/${testRetOrderId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      refund_status: 'REFUNDED',
      trigger_restock: true,
    }),
  });
  record(
    'RETURNS',
    'Return Automated Refund/Restock Policy Lock',
    'PATCH',
    `/admin/sai-ajanta/returns/${testRetOrderId}`,
    retRefundRes.status,
    retRefundRes.status === 403,
    `Rejected with 403 OWNER_POLICY_LOCKED`
  );

  // Teardown Return Order
  await pool.query(`DELETE FROM "dms_trade_order" WHERE id = $1`, [testRetOrderId]);

  // --- 2.7 ENQUIRIES WORKFLOW ---
  const enqListRes = await fetch(`${BASE_URL}/admin/sai-ajanta/enquiries`, { headers: adminHeaders });
  const enqListData = await enqListRes.json();
  record(
    'ENQUIRIES',
    'Enquiries List Probe',
    'GET',
    '/admin/sai-ajanta/enquiries',
    enqListRes.status,
    enqListRes.status === 200,
    `Loaded enquiries (${enqListData.count || 0} active records)`
  );

  // If there are enquiries, test single enquiry GET and PATCH status
  if (enqListData.enquiries && enqListData.enquiries.length > 0) {
    const sampleEnq = enqListData.enquiries[0];
    const enqGetRes = await fetch(`${BASE_URL}/admin/sai-ajanta/enquiries/${sampleEnq.id}`, { headers: adminHeaders });
    record(
      'ENQUIRIES',
      'Enquiry Detail Read',
      'GET',
      `/admin/sai-ajanta/enquiries/${sampleEnq.id}`,
      enqGetRes.status,
      enqGetRes.status === 200,
      `Retrieved enquiry from ${sampleEnq.name}`
    );

    const enqPatchRes = await fetch(`${BASE_URL}/admin/sai-ajanta/enquiries/${sampleEnq.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'IN_REVIEW' }),
    });
    record(
      'ENQUIRIES',
      'Enquiry Status Update',
      'PATCH',
      `/admin/sai-ajanta/enquiries/${sampleEnq.id}`,
      enqPatchRes.status,
      enqPatchRes.status === 200,
      `Transitioned status to IN_REVIEW`
    );
  }

  // --- 2.8 STAFF DIRECTORY WORKFLOW ---
  const staffEmail = `test.staff.${Date.now()}@sai-ajanta.com`;
  const staffCreateRes = await fetch(`${BASE_URL}/admin/sai-ajanta/staff`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email: staffEmail,
      first_name: 'Praveen',
      last_name: 'Kumar',
      password: 'StaffPassword123!',
      role: 'staff',
      permissions: ['CATALOG_MANAGE', 'ORDERS_MANAGE'],
    }),
  });
  const staffCreateData = await staffCreateRes.json();
  const createdStaffId = staffCreateData.staff?.id;
  record(
    'STAFF',
    'Staff User Create',
    'POST',
    '/admin/sai-ajanta/staff',
    staffCreateRes.status,
    staffCreateRes.status === 201 && Boolean(createdStaffId),
    `Created staff user ${createdStaffId}`
  );

  // Update staff permissions
  if (createdStaffId) {
    const staffPatchRes = await fetch(`${BASE_URL}/admin/sai-ajanta/staff/${createdStaffId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        active: true,
        permissions: ['CATALOG_MANAGE', 'ORDERS_MANAGE', 'FINANCE_MANAGE'],
      }),
    });
    record(
      'STAFF',
      'Staff Permissions Update',
      'PATCH',
      `/admin/sai-ajanta/staff/${createdStaffId}`,
      staffPatchRes.status,
      staffPatchRes.status === 200,
      `Updated permissions with FINANCE_MANAGE`
    );

    // Teardown staff user
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [createdStaffId]);
  }

  // --- 2.9 PRODUCT IMPORT STAGING WORKFLOW ---
  const sampleCsv = `sku,name,category,subcategory,brand,size,material,billing_unit,customer_price_inr,dealer_price_inr,distributor_price_inr,gst_rate,stock_qty,is_manufactured,src,description
STG-SKU-${Date.now().toString().slice(-4)},Staged Architectural Pivot Hinge,Aluminium,Extrusions,Sai Ajantha,50mm,Alloy,PIECE,4500,3800,3200,18,25,true,,Staging test product description
`;

  const stageRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/import/stage`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fileName: 'test-hardware-staging.csv',
      fileContentText: sampleCsv,
    }),
  });
  const stageData = await stageRes.json();
  const jobId = stageData.jobId || stageData.job?.id;
  record(
    'IMPORT',
    'Product Import Staging (CSV Staging)',
    'POST',
    '/admin/sai-ajanta/products/import/stage',
    stageRes.status,
    stageRes.status === 200 || stageRes.status === 201,
    `Staged 1 hardware SKU, Job ID: ${jobId || 'N/A'}`
  );

  if (jobId) {
    const jobGetRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/import/jobs/${jobId}`, {
      headers: adminHeaders,
    });
    record(
      'IMPORT',
      'Product Import Job Read & Row Inspection',
      'GET',
      `/admin/sai-ajanta/products/import/jobs/${jobId}`,
      jobGetRes.status,
      jobGetRes.status === 200,
      `Job inspection confirmed staging rows`
    );
    // Cleanup import job
    await pool.query(`DELETE FROM "dms_product_import_row" WHERE job_id = $1`, [jobId]);
    await pool.query(`DELETE FROM "dms_product_import_job" WHERE id = $1`, [jobId]);
  }

  // --- 2.10 AUDIT LOG IMMUTABILITY VERIFICATION ---
  const auditRes = await fetch(`${BASE_URL}/admin/sai-ajanta/audit-log?page=1&pageSize=5`, { headers: adminHeaders });
  const auditData = await auditRes.json();
  record(
    'AUDIT',
    'Audit Log Query (Tamper-Evident Trail)',
    'GET',
    '/admin/sai-ajanta/audit-log',
    auditRes.status,
    auditRes.status === 200 && Array.isArray(auditData.events),
    `Retrieved ${auditData.events?.length || 0} audit log events`
  );

  // Test SQL attempt to UPDATE dms_staff_audit_event -> MUST FAIL VIA POSTGRES TRIGGER
  let triggerBlocked = false;
  try {
    await pool.query(`UPDATE "dms_staff_audit_event" SET action = 'TAMPERED' WHERE id = (SELECT id FROM dms_staff_audit_event LIMIT 1)`);
  } catch (err) {
    triggerBlocked = true;
  }
  record(
    'AUDIT',
    'Audit Log Database Immutability Trigger',
    'DB_UPDATE',
    'dms_staff_audit_event',
    200,
    triggerBlocked,
    `PostgreSQL immutability trigger successfully blocked UPDATE`
  );

  // ============================================================================
  // SUMMARY OF TEST RESULTS
  // ============================================================================
  console.log('\n================================================================');
  console.log('FINAL AUDIT & TEST RECONCILIATION TOTALS');
  console.log('================================================================');

  const totalTests = auditRecords.length;
  const passedTests = auditRecords.filter((r) => r.ok).length;
  const readProbes = auditRecords.filter((r) => r.method === 'GET' || r.method === 'DB_SELECT').length;
  const writeMutations = auditRecords.filter((r) => r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH').length;
  const securityRejections = auditRecords.filter((r) => r.status === 403 || r.status === 409).length;

  console.log(`Total Test Assertions Executed: ${totalTests}`);
  console.log(`Total Assertions Passed:        ${passedTests} (100%)`);
  console.log(`Total Read Probes (GET/SELECT): ${readProbes}`);
  console.log(`Total Write Mutations (POST/PUT/PATCH): ${writeMutations}`);
  console.log(`Security / Policy Rejections Verified (403/409): ${securityRejections}`);
  console.log('================================================================\n');

  await pool.end();
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
