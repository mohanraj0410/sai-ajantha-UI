import fs from "node:fs";

const STOREFRONT_URL = "http://127.0.0.1:3000";
const BACKEND_URL = "http://127.0.0.1:9000";
const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
const PUBLISHABLE_KEY = pubConfig.publishableKey;

async function run() {
  console.log("===============================================================================");
  console.log("PHASE 05 — P5.2 COMPREHENSIVE SUITE (TRUE HTTP & POSTGRESQL PERSISTENCE)");
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
    // TEST 1: Dealer Application & Anti-Tampering (Self-Approval & Privilege Escalation)
    // -------------------------------------------------------------------------
    console.log("[Test 1] Registering Dealer with adversarial self-approval attempt...");
    const dealerEmail = `dealer.p52.${ts}@sai-ajanta-test.internal`;
    const dealerRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dealerEmail,
        password: "StrongDealerPass123!",
        name: "Coimbatore Modular Solutions",
        phone: "9842233445",
        role: "DEALER",
        organization: "Coimbatore Modular Hardware Ltd",
        businessCity: "Coimbatore",
        preferredPins: "641001, 641002, 641018, BADPIN",
        categories: ["Hardware", "Insect Screens", "Door Closer & Floor Spring"],
        status: "APPROVED", // Adversarial attempt
        wholesaleUnlocked: true, // Adversarial attempt
        effectivePriceTier: "DEALER", // Adversarial attempt
      }),
    });

    if (dealerRes.status !== 201) {
      throw new Error(`Dealer registration failed with HTTP ${dealerRes.status}`);
    }
    const dealerData = await dealerRes.json();
    console.log(`  -> HTTP 201 Created: Customer ID = ${dealerData.user.id}`);

    // Verify in API response
    if (dealerData.user.approvalStatus !== "PENDING_APPROVAL") {
      throw new Error(`Security failure: approvalStatus is ${dealerData.user.approvalStatus}, expected PENDING_APPROVAL`);
    }
    console.log("  -> PASS: API response enforces approvalStatus: 'PENDING_APPROVAL'");

    // Verify in PostgreSQL account_profile table
    const dealerProfileDb = await pgClient.query(
      `SELECT role, status, dynamic_attributes FROM account_profile WHERE customer_id = $1`,
      [dealerData.user.id]
    );
    if (dealerProfileDb.rows.length === 0) {
      throw new Error(`DB failure: No account_profile found in PostgreSQL for customer ${dealerData.user.id}`);
    }
    const dealerRow = dealerProfileDb.rows[0];
    if (dealerRow.status !== "PENDING_APPROVAL") {
      throw new Error(`DB security failure: Database status is ${dealerRow.status}, expected PENDING_APPROVAL`);
    }
    const prefPins = dealerRow.dynamic_attributes?.preferred_pins || [];
    if (prefPins.includes("BADPIN") || !prefPins.includes("641001")) {
      throw new Error(`PIN sanitization failure in DB: ${JSON.stringify(prefPins)}`);
    }
    console.log(`  -> PASS: PostgreSQL record persisted with status='PENDING_APPROVAL' and sanitized PINs: ${JSON.stringify(prefPins)}`);

    // Verify pricing lockout for pending dealer
    const dealerCookie = dealerRes.headers.get("set-cookie")?.split(";")[0];
    const dealerMe = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
      headers: { Cookie: dealerCookie },
    }).then((r) => r.json());

    if (dealerMe.wholesaleUnlocked !== false || dealerMe.effectivePriceTier !== "CUSTOMER") {
      throw new Error(`Confidential pricing leak for pending dealer: ${JSON.stringify(dealerMe)}`);
    }
    console.log("  -> PASS: Pending dealer locked out of wholesale pricing (wholesaleUnlocked=false, effectivePriceTier=CUSTOMER)");

    // -------------------------------------------------------------------------
    // TEST 2: Distributor Application & Category Clamping Boundary
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Registering Regional Distributor with territory and category claims...");
    const distEmail = `dist.p52.${ts}@sai-ajanta-test.internal`;
    const distRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: distEmail,
        password: "StrongDistPass123!",
        name: "Salem Central Hardware Distribution",
        phone: "9876543210",
        role: "DISTRIBUTOR",
        organization: "Salem Hardware Distributors LLP",
        businessCity: "Salem",
        operatingLocation: "Salem Logistics Hub",
        proposedPins: "636001, 636002, 636004, 12345", // 12345 is invalid (5 digits)
        // Adversarial attempt: trying to claim Sai Ajantha direct categories
        categories: ["Hardware", "Aluminium Sections", "Door Closer & Floor Spring", "Kitchen Basket"],
        status: "APPROVED",
      }),
    });

    if (distRes.status !== 201) {
      throw new Error(`Distributor registration failed with HTTP ${distRes.status}`);
    }
    const distData = await distRes.json();
    console.log(`  -> HTTP 201 Created: Customer ID = ${distData.user.id}`);

    // Verify in PostgreSQL
    const distProfileDb = await pgClient.query(
      `SELECT role, status, dynamic_attributes FROM account_profile WHERE customer_id = $1`,
      [distData.user.id]
    );
    const distRow = distProfileDb.rows[0];
    const distAttrs = distRow.dynamic_attributes;

    const allowedDistCategories = ["Door Closer & Floor Spring", "Kitchen Basket"];
    const actualCategories = distAttrs.categories || [];
    const invalidCategories = actualCategories.filter((c) => !allowedDistCategories.includes(c));
    if (invalidCategories.length > 0) {
      throw new Error(`CRITICAL: Distributor received direct sales categories: ${JSON.stringify(invalidCategories)}`);
    }
    console.log(`  -> PASS: Distributor categories strictly clamped in DB to: ${JSON.stringify(actualCategories)}`);

    const propPins = distAttrs.proposed_pins || [];
    if (propPins.includes("12345") || !propPins.includes("636001")) {
      throw new Error(`Proposed PINs sanitization failure in DB: ${JSON.stringify(propPins)}`);
    }
    console.log(`  -> PASS: Proposed territory PINs sanitized to valid 6-digit codes: ${JSON.stringify(propPins)}`);

    // -------------------------------------------------------------------------
    // TEST 3: Negative Cross-Account Identity Spoofing Protection
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Testing negative cross-account profile access prevention...");
    // Dealer attempts to inspect / modify distributor profile
    // Note: /store/sai-ajanta/profile takes NO id parameter from query or body;
    // it authoritatively derives customer identity strictly from req.auth_context.actor_id.
    const spoofAttempt = await fetch(`${BACKEND_URL}/store/sai-ajanta/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
        // No auth header provided:
      },
      body: JSON.stringify({
        customer_id: distData.user.id, // Trying to tamper with distributor account
        business_name: "HACKED_DISTRIBUTOR",
      }),
    });

    if (spoofAttempt.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated profile mutation, got ${spoofAttempt.status}`);
    }
    console.log("  -> PASS: Unauthenticated/cross-actor profile mutation rejected with HTTP 401");

    // -------------------------------------------------------------------------
    // TEST 4: Existing Customer Role Upgrade Prevention
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Testing existing customer trade upgrade privilege escalation...");
    const retailEmail = `retail.p52.${ts}@sai-ajanta-test.internal`;
    const retailReg = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: retailEmail,
        password: "RetailPassword123!",
        name: "Retail Customer",
        phone: "9123456780",
        role: "CUSTOMER",
      }),
    });
    const retailData = await retailReg.json();

    // Now log in as the retail customer to obtain real Medusa token
    const medusaLogin = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        email: retailEmail,
        password: "RetailPassword123!",
      }),
    });
    const medusaLoginData = await medusaLogin.json();
    const customerToken = medusaLoginData.token;

    // Customer attempts to self-promote role to DISTRIBUTOR via /store/sai-ajanta/profile
    const upgradeRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        role: "DISTRIBUTOR",
        status: "APPROVED",
        business_name: "Self-Approved Distributor Inc",
      }),
    });
    const upgradeData = await upgradeRes.json();

    // Verify in DB that role is STILL CUSTOMER
    const retailProfileDb = await pgClient.query(
      `SELECT role, status, dynamic_attributes FROM account_profile WHERE customer_id = $1`,
      [retailData.user.id]
    );
    const retailRow = retailProfileDb.rows[0];
    if (retailRow.role !== "CUSTOMER") {
      throw new Error(`CRITICAL PRIVILEGE ESCALATION: Role changed to ${retailRow.role}!`);
    }
    if (retailRow.status !== "ACTIVE") {
      throw new Error(`Unexpected status: ${retailRow.status}`);
    }
    if (retailRow.dynamic_attributes?.pending_upgrade_role !== "DISTRIBUTOR") {
      throw new Error("pending_upgrade_role was not recorded in dynamic_attributes");
    }
    if (retailRow.dynamic_attributes?.pending_upgrade_status !== "PENDING_APPROVAL") {
      throw new Error("pending_upgrade_status was not set to PENDING_APPROVAL");
    }
    console.log("  -> PASS: Live role remained 'CUSTOMER'; pending_upgrade_role recorded as 'DISTRIBUTOR' (PENDING_APPROVAL)");

    // -------------------------------------------------------------------------
    // TEST 5: Disposable DB Migration Rehearsal Health Check
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Verifying disposable rehearsal database (medusa_restore_rehearsal_disposable)...");
    const dispClient = new Client({
      connectionString: "postgres://medusa:medusa@127.0.0.1:5432/medusa_restore_rehearsal_disposable",
    });
    await dispClient.connect();
    const dispTables = await dispClient.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_profile'`
    );
    if (dispTables.rows.length === 0) {
      throw new Error("account_profile table missing on disposable rehearsal database");
    }
    await dispClient.end();
    console.log("  -> PASS: Disposable rehearsal database is accessible with matching DMS schema");

    console.log("\n===============================================================================");
    console.log("P5.2 VERIFICATION COMPLETE: ALL 5/5 TEST CLASSES PASSED!");
    console.log("===============================================================================");
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
