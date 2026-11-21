import fs from "node:fs";

const STOREFRONT_URL = "http://127.0.0.1:3000";
const BACKEND_URL = "http://127.0.0.1:9000";
const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
const PUBLISHABLE_KEY = pubConfig.publishableKey;

async function run() {
  console.log("=== P5.2 DISTINCT DEALER & DISTRIBUTOR TRADE APPLICATIONS VERIFICATION ===\n");

  const timestamp = Date.now();

  // Test 1: Dealer Application Starts in PENDING_APPROVAL with Wholesale Locked
  console.log("[Test 1] Submitting Trade Dealer Application...");
  const dealerEmail = `dealer.applicant.${timestamp}@sai-ajanta-test.internal`;
  const dealerRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: dealerEmail,
      password: "StrongDealerPass123!",
      name: "Suresh Hardware Fabrications",
      phone: "9443322110",
      role: "DEALER",
      organization: "Suresh Architectural Hardware Ltd",
      businessCity: "Madurai",
      preferredPins: "625001, 625002, 625003",
      categories: ["Hardware", "Aluminium Sections", "Insect Screens"],
      status: "APPROVED", // Adversarial attempt to self-approve
    }),
  });

  console.log(`Dealer application status: ${dealerRes.status}`);
  const dealerData = await dealerRes.json();
  console.log("Dealer registration response:", dealerData);

  if (dealerRes.status !== 201) {
    throw new Error(`Expected 201 Created, got ${dealerRes.status}: ${JSON.stringify(dealerData)}`);
  }

  // Verify server-authoritative status: MUST BE PENDING_APPROVAL, NEVER APPROVED
  if (dealerData.user.approvalStatus !== "PENDING_APPROVAL") {
    throw new Error(`CRITICAL SECURITY FAILURE: Self-approval allowed! Status: ${dealerData.user.approvalStatus}`);
  }
  console.log("PASS: Dealer account durable status is PENDING_APPROVAL (self-approval ignored).");

  // Verify wholesale pricing is LOCKED for pending dealer
  const dealerCookie = dealerRes.headers.get("set-cookie")?.split(";")[0];
  const dealerMeRes = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: dealerCookie },
  });
  const dealerMeData = await dealerMeRes.json();
  console.log("Dealer /api/auth/me check:", dealerMeData);

  if (dealerMeData.wholesaleUnlocked !== false || dealerMeData.effectivePriceTier !== "CUSTOMER") {
    throw new Error(`CRITICAL PRICING LEAK: Pending dealer unlocked wholesale tier: ${JSON.stringify(dealerMeData)}`);
  }
  console.log("PASS: Pending dealer has wholesaleUnlocked: false and effectivePriceTier: CUSTOMER.");

  // Test 2: Distributor Application with Territory & Category Restriction
  console.log("\n[Test 2] Submitting Regional Distributor Application...");
  const distEmail = `distributor.applicant.${timestamp}@sai-ajanta-test.internal`;
  const distRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: distEmail,
      password: "StrongDistPass123!",
      name: "Trichy Glass & Fittings Corp",
      phone: "9842411223",
      role: "DISTRIBUTOR",
      organization: "Trichy Glass & Fittings Corporation",
      businessCity: "Tiruchirappalli",
      operatingLocation: "Central Warehouse, Trichy",
      proposedPins: "620001, 620002, 620018, INVALID_PIN_999", // Invalid pin must be sanitized
      // Adversarial category attempt: distributor trying to claim Sai Ajantha direct categories
      categories: ["Hardware", "Door Closer & Floor Spring", "Kitchen Basket", "Ladders"],
      status: "APPROVED",
    }),
  });

  console.log(`Distributor application status: ${distRes.status}`);
  const distData = await distRes.json();
  console.log("Distributor registration response:", distData);

  if (distRes.status !== 201) {
    throw new Error(`Expected 201 Created, got ${distRes.status}: ${JSON.stringify(distData)}`);
  }

  if (distData.user.approvalStatus !== "PENDING_APPROVAL") {
    throw new Error(`CRITICAL SECURITY FAILURE: Self-approval allowed! Status: ${distData.user.approvalStatus}`);
  }
  console.log("PASS: Distributor account durable status is PENDING_APPROVAL.");

  // Verify in PostgreSQL that categories were strictly clamped to Door Closer and Kitchen Basket
  const pgModule = await import("../apps/backend/node_modules/pg/lib/index.js");
  const Client = pgModule.default?.Client || pgModule.Client || pgModule.default;
  const pgClient = new Client({
    connectionString: "postgres://medusa:medusa@127.0.0.1:5432/medusa",
  });
  await pgClient.connect();

  const distProfileDb = await pgClient.query(
    `SELECT role, status, dynamic_attributes FROM account_profile WHERE customer_id = $1`,
    [distData.user.id]
  );
  const distAttrs = distProfileDb.rows[0].dynamic_attributes;
  console.log("Distributor profile in DB dynamic_attributes:", distAttrs);

  // Check category clamping:
  const allowedCategories = ["Door Closer & Floor Spring", "Kitchen Basket"];
  const dbCats = distAttrs.categories || [];
  const unauthorizedCats = dbCats.filter((c) => !allowedCategories.includes(c));
  if (unauthorizedCats.length > 0) {
    throw new Error(`CRITICAL: Distributor received direct sales categories: ${JSON.stringify(unauthorizedCats)}`);
  }
  console.log("PASS: Distributor categories strictly clamped to Door Closers and Kitchen Baskets.");

  // Check proposed pins sanitization:
  const dbPins = distAttrs.proposed_pins || [];
  if (dbPins.includes("INVALID_PIN_999")) {
    throw new Error("Invalid PIN was not sanitized!");
  }
  if (!dbPins.includes("620001") || !dbPins.includes("620002") || !dbPins.includes("620018")) {
    throw new Error(`Expected valid 6-digit PINs, got: ${JSON.stringify(dbPins)}`);
  }
  console.log(`PASS: Proposed PINs sanitized to valid 6-digit codes: ${JSON.stringify(dbPins)}.`);

  // Test 3: Existing Customer Upgrade Attempt Privilege Escalation Prevention
  console.log("\n[Test 3] Existing Customer Trade Upgrade Privilege Escalation Prevention...");
  const custEmail = `retail.upgrade.${timestamp}@sai-ajanta-test.internal`;
  const regCustRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: custEmail,
      password: "CustomerPass123!",
      name: "Anand Homeowner",
      phone: "9123456789",
      role: "CUSTOMER",
    }),
  });
  const regCustData = await regCustRes.json();
  const custId = regCustData.user.id;
  console.log(`Created retail customer: ${custId}`);

  // Customer now attempts to self-upgrade to DEALER via /store/sai-ajanta/profile
  // First login to get customer session/token
  const custLoginRes = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: custEmail,
      password: "CustomerPass123!",
    }),
  });
  const custCookie = custLoginRes.headers.get("set-cookie")?.split(";")[0];

  // Attempt upgrade via /store/sai-ajanta/profile directly with customer auth
  // Get medusaToken directly via Medusa login endpoint
  const medusaLogin = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      email: custEmail,
      password: "CustomerPass123!",
    }),
  });
  const medusaLoginData = await medusaLogin.json();
  const custToken = medusaLoginData.token;

  const upgradeRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": PUBLISHABLE_KEY,
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      role: "DEALER",
      business_name: "Anand Contractors",
      status: "APPROVED", // Self-approval attempt
    }),
  });

  const upgradeData = await upgradeRes.json();
  console.log("Upgrade request response:", upgradeData);

  // Verify in PostgreSQL: account role MUST REMAIN CUSTOMER, with pending_upgrade_role: DEALER
  const custProfileDb = await pgClient.query(
    `SELECT role, status, dynamic_attributes FROM account_profile WHERE customer_id = $1`,
    [custId]
  );
  const updatedProfile = custProfileDb.rows[0];
  console.log("Customer profile in DB after upgrade attempt:", updatedProfile);

  if (updatedProfile.role !== "CUSTOMER") {
    throw new Error(`CRITICAL PRIVILEGE ESCALATION: Role changed to ${updatedProfile.role} without staff approval!`);
  }
  if (updatedProfile.dynamic_attributes?.pending_upgrade_role !== "DEALER") {
    throw new Error(`Expected pending_upgrade_role to be DEALER, got: ${updatedProfile.dynamic_attributes?.pending_upgrade_role}`);
  }
  if (updatedProfile.dynamic_attributes?.pending_upgrade_status !== "PENDING_APPROVAL") {
    throw new Error(`Expected pending_upgrade_status to be PENDING_APPROVAL`);
  }
  console.log("PASS: Privilege escalation blocked. Role remains CUSTOMER with durable pending_upgrade_role = DEALER.");

  // Check /api/auth/me for this customer
  const checkCustMe = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: custCookie },
  });
  const custMeData = await checkCustMe.json();
  if (custMeData.wholesaleUnlocked !== false || custMeData.effectivePriceTier !== "CUSTOMER") {
    throw new Error("Upgrading customer should NOT have wholesale access!");
  }
  console.log("PASS: Upgrading customer pricing strictly locked to CUSTOMER.");

  await pgClient.end();

  console.log("\n=== ALL P5.2 DISTINCT TRADE APPLICATION GATES PASSED! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
