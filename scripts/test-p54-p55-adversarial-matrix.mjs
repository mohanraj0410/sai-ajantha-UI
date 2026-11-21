import fs from "node:fs";

const STOREFRONT_URL = "http://127.0.0.1:3000";
const BACKEND_URL = "http://127.0.0.1:9000";
const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
const PUBLISHABLE_KEY = pubConfig.publishableKey;

async function run() {
  console.log("===============================================================================");
  console.log("PHASE 05 — P5.4 & P5.5 ADVERSARIAL MATRIX & TENANT ISOLATION SUITE");
  console.log("===============================================================================\n");

  const ts = Date.now();
  const pgModule = await import("../apps/backend/node_modules/pg/lib/index.js");
  const Client = pgModule.default?.Client || pgModule.Client || pgModule.default;
  const pgClient = new Client({
    connectionString: "postgres://medusa:medusa@127.0.0.1:5432/medusa",
  });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // Setup Fixtures: Customer A, Customer B, Admin JWT
    // -------------------------------------------------------------------------
    console.log("[Setup] Creating Customer A and Customer B fixtures...");
    const emailA = `customer.a.${ts}@sai-ajanta-test.internal`;
    const emailB = `customer.b.${ts}@sai-ajanta-test.internal`;

    const regA = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1" },
      body: JSON.stringify({
        email: emailA,
        password: "CustomerAPassword123!",
        name: "Customer Alpha",
        phone: "9111111111",
        role: "CUSTOMER",
      }),
    });
    const dataA = await regA.json();
    const tokenA = (await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PUBLISHABLE_KEY },
      body: JSON.stringify({ email: emailA, password: "CustomerAPassword123!" }),
    }).then((r) => r.json())).token;

    const regB = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.2" },
      body: JSON.stringify({
        email: emailB,
        password: "CustomerBPassword123!",
        name: "Customer Beta",
        phone: "9222222222",
        role: "CUSTOMER",
      }),
    });
    const dataB = await regB.json();
    const tokenB = (await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PUBLISHABLE_KEY },
      body: JSON.stringify({ email: emailB, password: "CustomerBPassword123!" }),
    }).then((r) => r.json())).token;

    const adminToken = (await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
    }).then((r) => r.json())).token;

    console.log(`  -> Customer A: ${dataA.user.id} (${emailA})`);
    console.log(`  -> Customer B: ${dataB.user.id} (${emailB})`);
    console.log(`  -> Staff Admin Authenticated`);

    // Create a real Trade Order for Customer A directly in DMS
    console.log("\n[Setup] Placing an authoritative order for Customer A...");
    const orderNumber = `ORD-TEST-${ts}`;
    const insertOrder = await pgClient.query(
      `INSERT INTO dms_trade_order (
        id, customer_id, order_number, role_at_order, price_tier_applied, status, payment_status, payment_method,
        customer_name, customer_email, customer_phone, shipping_address, subtotal_inr, gst_amount_inr, total_inr,
        items, events, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'CUSTOMER', 'CUSTOMER', 'BOQ_QUOTE_REQUESTED', 'PENDING_OFFLINE_SETTLEMENT', 'Proforma Invoice / Trade PO',
        'Customer Alpha', $4, '9111111111', '12 Salai Road, Trichy', 13050.85, 2349.15, 15400,
        '[{"name": "Heavy Duty Pivot Hinge", "sku": "SA-H-PVT-01", "quantity": 10, "unit_price_inr": 1540}]',
        '[]', NOW(), NOW()
      ) RETURNING id`,
      [`order_p55_a_${ts}`, dataA.user.id, orderNumber, emailA]
    );
    const orderAId = insertOrder.rows[0].id;
    console.log(`  -> Created Customer A Order: ${orderAId} (${orderNumber})`);

    // -------------------------------------------------------------------------
    // ATTACK 1: Cross-Tenant Order Data Access (Customer B attempts to read Customer A's order)
    // -------------------------------------------------------------------------
    console.log("\n[Attack 1] Customer B attempts to read Customer A's order via /store/sai-ajanta/orders/:id...");
    const attack1 = await fetch(`${BACKEND_URL}/store/sai-ajanta/orders/${orderAId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
    });
    console.log(`  -> Status code: ${attack1.status}`);
    if (attack1.status !== 403) {
      throw new Error(`CRITICAL SECURITY LEAK: Customer B accessed Customer A's order! Status: ${attack1.status}`);
    }
    console.log("  -> PASS: Cross-tenant order read BLOCKED with HTTP 403 Forbidden");

    // -------------------------------------------------------------------------
    // ATTACK 2: Cross-Tenant Order Mutation (Customer B attempts to cancel Customer A's order)
    // -------------------------------------------------------------------------
    console.log("\n[Attack 2] Customer B attempts to cancel Customer A's order via PATCH...");
    const attack2 = await fetch(`${BACKEND_URL}/store/sai-ajanta/orders/${orderAId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenB}`,
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: "CANCEL", reason: "Malicious cancellation" }),
    });
    console.log(`  -> Status code: ${attack2.status}`);
    if (attack2.status !== 403) {
      throw new Error(`CRITICAL SECURITY LEAK: Customer B cancelled Customer A's order! Status: ${attack2.status}`);
    }
    console.log("  -> PASS: Cross-tenant order mutation BLOCKED with HTTP 403 Forbidden");

    // Verify order in DB is still untouched
    const checkDbOrder = await pgClient.query(`SELECT status FROM dms_trade_order WHERE id = $1`, [orderAId]);
    if (checkDbOrder.rows[0].status !== "BOQ_QUOTE_REQUESTED") {
      throw new Error("Order status was altered in DB!");
    }
    console.log("  -> PASS: Customer A order status remains BOQ_QUOTE_REQUESTED in DB");

    // -------------------------------------------------------------------------
    // ATTACK 3: Customer attempts to call Admin Protected Routes
    // -------------------------------------------------------------------------
    console.log("\n[Attack 3] Customer A attempts to access admin staff endpoints with Customer token...");
    const attack3 = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dataB.user.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    console.log(`  -> Status code: ${attack3.status}`);
    if (attack3.status !== 401 && attack3.status !== 403) {
      throw new Error(`CRITICAL RBAC LEAK: Customer accessed staff admin API! Status: ${attack3.status}`);
    }
    console.log("  -> PASS: Customer token rejected from staff admin route with HTTP 401/403");

    // -------------------------------------------------------------------------
    // TEST 4: P5.4 Dealer-Distributor Linking Workflow (Staff Authorization Required)
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] P5.4 Dealer-Distributor Linking Workflow...");
    // 4a. Create an active Distributor
    await new Promise((r) => setTimeout(r, 600));
    const distEmail = `dist.link.${ts}@sai-ajanta-test.internal`;
    const regDist = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.10" },
      body: JSON.stringify({
        email: distEmail,
        password: "DistPassword123!",
        name: "Madurai Glass Distributors",
        phone: "9876543219",
        role: "DISTRIBUTOR",
        organization: "Madurai Glass & Fittings",
        businessCity: "Madurai",
        proposedPins: "625001, 625002",
      }),
    });
    const regDistData = await regDist.json();
    if (!regDist.ok || !regDistData.user?.id) {
      throw new Error(`Distributor registration failed (${regDist.status}): ${JSON.stringify(regDistData)}`);
    }
    const distCustId = regDistData.user.id;

    // Staff approves distributor
    await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${distCustId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const distProfileId = (await pgClient.query(
      `SELECT id FROM account_profile WHERE customer_id = $1`,
      [distCustId]
    )).rows[0].id;
    console.log(`  -> Created & Approved Distributor Profile: ${distProfileId}`);

    // 4b. Create a Dealer
    const dealerEmail = `dealer.link.${ts}@sai-ajanta-test.internal`;
    const regDealer = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.20" },
      body: JSON.stringify({
        email: dealerEmail,
        password: "DealerPassword123!",
        name: "Annamalai Fabrications",
        phone: "9842400111",
        role: "DEALER",
        organization: "Annamalai Architectural Doors",
        businessCity: "Madurai",
      }),
    });
    const regDealerData = await regDealer.json();
    if (!regDealer.ok || !regDealerData.user?.id) {
      throw new Error(`Dealer registration failed (${regDealer.status}): ${JSON.stringify(regDealerData)}`);
    }
    const dealerCustId = regDealerData.user.id;

    // Staff links Dealer to Distributor and approves
    const linkRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealerCustId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: "ACTIVE",
        parent_distributor_id: distProfileId,
      }),
    });
    console.log(`  -> Staff Dealer Link Status: ${linkRes.status}`);
    if (linkRes.status !== 200) {
      throw new Error(`Failed to link dealer to distributor: ${linkRes.status}`);
    }

    // Verify link in PostgreSQL
    const checkLinkDb = await pgClient.query(
      `SELECT parent_distributor_id, status FROM account_profile WHERE customer_id = $1`,
      [dealerCustId]
    );
    if (checkLinkDb.rows[0].parent_distributor_id !== distProfileId) {
      throw new Error(`DB verification failed: parent_distributor_id is ${checkLinkDb.rows[0].parent_distributor_id}, expected ${distProfileId}`);
    }
    console.log(`  -> PASS: Dealer ${dealerCustId} successfully linked to Parent Distributor ${distProfileId} in DB`);

    // 4c. Verify Self-Linking Prevention
    console.log("\n[Test 4c] Verifying Self-Linking Prevention...");
    const selfLinkRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealerCustId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ parent_distributor_id: dealerCustId }),
    });
    if (selfLinkRes.status !== 400) {
      throw new Error(`Self-linking should be rejected with HTTP 400, got ${selfLinkRes.status}`);
    }
    console.log("  -> PASS: Self-linking rejected with HTTP 400 (SELF_LINK_FORBIDDEN)");

    // -------------------------------------------------------------------------
    // TEST 5: Territory Routing Boundary Simulation
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Testing Seller Coverage Territory Routing Boundaries...");
    // 5a. Direct categories always route to Sai Ajantha Direct Warehouse
    const directSim = await fetch(`${BACKEND_URL}/admin/sai-ajanta/seller-coverage?category=Hardware&pin=620001`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (directSim.simulation?.outcome !== "DIRECT_WAREHOUSE_MATCH") {
      throw new Error(`Expected DIRECT_WAREHOUSE_MATCH for Hardware, got ${directSim.simulation?.outcome}`);
    }
    console.log(`  -> PASS: Direct Hardware category routes to Central Warehouse (outcome: ${directSim.simulation.outcome})`);

    // 5b. Floor Springs category route blocked (enquiry only)
    const floorSpringSim = await fetch(`${BACKEND_URL}/admin/sai-ajanta/seller-coverage?category=Door+Closer+%26+Floor+Spring&pin=620001`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (floorSpringSim.simulation?.outcome !== "ENQUIRY_ONLY_BLOCKED") {
      throw new Error(`Expected ENQUIRY_ONLY_BLOCKED for Floor Spring, got ${floorSpringSim.simulation?.outcome}`);
    }
    console.log(`  -> PASS: Floor Springs category strictly enquiry-only blocked (outcome: ${floorSpringSim.simulation.outcome})`);

    // 5c. Distributor resale with unmatched PIN fails closed to manual enquiry
    const unmatchedPinSim = await fetch(`${BACKEND_URL}/admin/sai-ajanta/seller-coverage?category=Kitchen+Basket&pin=999999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    if (unmatchedPinSim.simulation?.outcome !== "UNMATCHED_GAP_MANUAL_ENQUIRY") {
      throw new Error(`Expected UNMATCHED_GAP_MANUAL_ENQUIRY for unserved PIN, got ${unmatchedPinSim.simulation?.outcome}`);
    }
    console.log(`  -> PASS: Unserved PIN 999999 fails closed to manual enquiry (outcome: ${unmatchedPinSim.simulation.outcome})`);

    console.log("\n===============================================================================");
    console.log("ALL ADVERSARIAL MATRIX & TENANT ISOLATION TESTS PASSED (5/5 GATES)!");
    console.log("===============================================================================");
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error("\nSUITE FAILED:", err);
  process.exit(1);
});
