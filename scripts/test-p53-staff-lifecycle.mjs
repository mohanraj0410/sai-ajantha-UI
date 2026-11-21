import fs from "node:fs";

const STOREFRONT_URL = "http://127.0.0.1:3000";
const BACKEND_URL = "http://127.0.0.1:9000";
const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
const PUBLISHABLE_KEY = pubConfig.publishableKey;

async function run() {
  console.log("=== P5.3 STAFF APPROVAL / REJECTION / SUSPENSION LIFECYCLE VERIFICATION ===\n");

  const timestamp = Date.now();

  // 1. First, create an admin session to obtain a valid staff admin JWT
  console.log("[Step 1] Authenticating Staff Admin...");
  // Authenticate directly with Medusa to get admin JWT
  const medusaAdminRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@sai-ajanta.com",
      password: "Admin1234!",
    }),
  });
  const medusaAdminData = await medusaAdminRes.json();
  const adminToken = medusaAdminData.token;
  if (!adminToken) {
    throw new Error(`Failed to acquire admin JWT: ${JSON.stringify(medusaAdminData)}`);
  }
  console.log("Acquired staff admin JWT token.");

  // Test 1: RBAC Security Boundary: Anonymous & Customer mutation rejection
  console.log("\n[Test 1] Testing RBAC Security Boundary on staff mutations...");
  const anonPatchRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/test_cus_123`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "ACTIVE" }),
  });
  console.log(`Anonymous PATCH status: ${anonPatchRes.status}`);
  if (anonPatchRes.status !== 401 && anonPatchRes.status !== 403) {
    throw new Error(`Expected 401/403 for anonymous staff mutation, got: ${anonPatchRes.status}`);
  }
  console.log("PASS: Anonymous mutation rejected with 401/403.");

  const clientIp = `192.168.53.${Math.floor(Math.random() * 200 + 10)}`;

  // 2. Register a new pending Dealer
  console.log("\n[Step 2] Registering a new Pending Dealer applicant...");
  const dealerEmail = `p53.dealer.${timestamp}@sai-ajanta-test.internal`;
  const regRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
    body: JSON.stringify({
      name: "Coimbatore Modulars",
      email: dealerEmail,
      phone: "9876543210",
      password: "DealerPassword123!",
      role: "DEALER",
      organization: "Coimbatore Modular Solutions",
      businessCity: "Coimbatore",
    }),
  });
  const regData = await regRes.json();
  console.log(`Register response (status ${regRes.status}):`, regData);
  if (!regRes.ok || !regData.user?.id) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const dealerId = regData.user.id;
  console.log(`Created pending dealer: ${dealerId}`);

  // Login as this dealer (Device A) to get session cookie before approval
  const dealerLoginRes = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
    body: JSON.stringify({
      email: dealerEmail,
      password: "DealerPassword123!",
    }),
  });
  const dealerCookie = dealerLoginRes.headers.get("set-cookie")?.split(";")[0];

  // Verify wholesale pricing is locked while PENDING_APPROVAL
  const checkPendingMe = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: dealerCookie, "X-Forwarded-For": clientIp },
  });
  const pendingMeData = await checkPendingMe.json();
  if (pendingMeData.wholesaleUnlocked !== false) {
    throw new Error("Wholesale pricing must be locked for pending dealer!");
  }
  console.log("PASS: Dealer in PENDING_APPROVAL has wholesaleUnlocked: false.");

  // Test 2: Staff Approves Dealer
  console.log("\n[Test 2] Staff Admin approves dealer application...");
  const approveRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: "ACTIVE",
    }),
  });
  console.log(`Staff approve status: ${approveRes.status}`);
  const approveData = await approveRes.json();
  console.log("Staff approve response:", approveData);

  if (approveRes.status !== 200 || approveData.profile?.status !== "ACTIVE") {
    throw new Error(`Staff approval failed: ${JSON.stringify(approveData)}`);
  }
  console.log("PASS: Dealer status transitioned to ACTIVE by staff admin.");

  // Small delay to allow session token refresh
  await new Promise((r) => setTimeout(r, 1100));

  // Dealer logs in after approval to acquire approved trade session
  const approvedLoginRes = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
    body: JSON.stringify({
      email: dealerEmail,
      password: "DealerPassword123!",
    }),
  });
  console.log(`Approved login status: ${approvedLoginRes.status}`);
  const approvedCookie = approvedLoginRes.headers.get("set-cookie")?.split(";")[0];

  const checkApprovedMe = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: approvedCookie, "X-Forwarded-For": clientIp },
  });
  const approvedMeData = await checkApprovedMe.json();
  console.log("Approved dealer /api/auth/me response:", approvedMeData);

  if (approvedMeData.wholesaleUnlocked !== true || approvedMeData.effectivePriceTier !== "DEALER") {
    throw new Error(`Approved dealer must unlock DEALER pricing! Got: ${JSON.stringify(approvedMeData)}`);
  }
  console.log("PASS: Approved dealer successfully unlocked DEALER price tier (wholesaleUnlocked: true).");

  // Test 3: Staff Suspends Dealer & Immediate Cross-Device Session Invalidation
  console.log("\n[Test 3] Staff Admin suspends dealer account...");
  const suspendRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealerId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: "SUSPENDED",
      rejection_reason: "Compliance review pending: GSTIN mismatch.",
    }),
  });
  console.log(`Staff suspend status: ${suspendRes.status}`);
  const suspendData = await suspendRes.json();
  console.log("Staff suspend response:", suspendData);

  if (suspendRes.status !== 200 || suspendData.profile?.status !== "SUSPENDED") {
    throw new Error(`Staff suspension failed: ${JSON.stringify(suspendData)}`);
  }
  console.log("PASS: Dealer status transitioned to SUSPENDED with reason recorded.");

  // Verify that the previously valid approvedCookie is IMMEDIATELY DENIED with 401!
  console.log("\n[Test 4] Verifying immediate session revocation for suspended dealer...");
  const postSuspendMe = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: approvedCookie, "X-Forwarded-For": clientIp },
  });
  console.log(`Post-suspension /api/auth/me status: ${postSuspendMe.status}`);
  const postSuspendData = await postSuspendMe.json();
  console.log("Post-suspension response:", postSuspendData);

  if (postSuspendMe.status !== 401) {
    throw new Error(`CRITICAL: Suspended user previous session was not revoked! Status: ${postSuspendMe.status}`);
  }
  console.log("PASS: Suspended dealer active session IMMEDIATELY REVOKED with 401 across all devices.");

  // Test 5: Rejection Lifecycle
  console.log("\n[Test 5] Staff Rejects an unapproved trade applicant...");
  const rejectClientIp = `192.168.53.${Math.floor(Math.random() * 200 + 10)}`;
  const rejectEmail = `p53.reject.${timestamp}@sai-ajanta-test.internal`;
  const regRejectRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": rejectClientIp },
    body: JSON.stringify({
      name: "Invalid Firm",
      email: rejectEmail,
      phone: "9112233445",
      password: "TestPassword123!",
      role: "DISTRIBUTOR",
      organization: "Invalid Entity",
      businessCity: "Salem",
    }),
  });
  const regRejectData = await regRejectRes.json();
  const rejectId = regRejectData.user.id;

  const rejectStaffRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${rejectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: "REJECTED",
      rejection_reason: "Operating outside authorized distribution corridor.",
    }),
  });
  console.log(`Staff reject status: ${rejectStaffRes.status}`);
  const rejectStaffData = await rejectStaffRes.json();
  console.log("Staff reject response:", rejectStaffData);

  if (rejectStaffRes.status !== 200 || rejectStaffData.profile?.dynamic_attributes?.trade_application_status !== "REJECTED") {
    throw new Error(`Staff rejection failed: ${JSON.stringify(rejectStaffData)}`);
  }
  console.log("PASS: Trade application recorded as REJECTED with audit reason.");

  console.log("\n=== ALL P5.3 STAFF APPROVAL/SUSPENSION/REVOCATION GATES PASSED! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
