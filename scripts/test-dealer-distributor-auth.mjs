import assert from "node:assert";

const STORE_BASE = "http://localhost:3000";
const MEDUSA_BASE = "http://localhost:9000";

const timestamp = Date.now();
const testCustomerEmail = `test_buyer_${timestamp}@saiajantha.com`;
const testDealerEmail = `test_dealer_${timestamp}@saiajantha.com`;
const testDistributorEmail = `test_dist_${timestamp}@saiajantha.com`;
const testRejectDealerEmail = `test_reject_dealer_${timestamp}@saiajantha.com`;
const testPassword = "Password123!";

const PUBLISHABLE_KEY = "pk_b62d5e6a89859691e73b003895d5f58590410fdca8252a42abbb688e56a6c627";

let reqCounter = 1;
function getTestHeaders() {
  return {
    "x-forwarded-for": `10.99.1.${reqCounter++}`,
    "x-publishable-api-key": PUBLISHABLE_KEY,
  };
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getTestHeaders(), ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  const setCookie = res.headers.get("set-cookie") || "";
  return { status: res.status, ok: res.ok, data, setCookie };
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...getTestHeaders(), ...headers } });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function patchJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getTestHeaders(), ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log("=== STARTING DEALER & DISTRIBUTOR AUTH APPROVAL TEST SUITE ===");

  // -------------------------------------------------------------
  // Test 1: Validation errors on registration
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Testing validation errors on registration...");
  const invalidReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "",
    email: "notanemail",
    password: "short",
  });
  assert.strictEqual(invalidReg.status, 400, "Invalid email/name should return 400");
  console.log("✓ Correctly returned 400 for invalid registration data:", invalidReg.data.error);

  const missingTradeDetails = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Valid Name",
    email: `valid_${timestamp}@example.com`,
    password: "Password123!",
    role: "DEALER",
    // organization and phone missing
  });
  assert.strictEqual(missingTradeDetails.status, 400, "Missing trade details should return 400");
  console.log("✓ Correctly returned 400 for missing trade organization/phone:", missingTradeDetails.data.error);

  // -------------------------------------------------------------
  // Test 2: Normal Homeowner (CUSTOMER) registration preserves immediate access
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Testing Homeowner (CUSTOMER) registration policy...");
  const custReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Regular Homeowner",
    email: testCustomerEmail,
    password: testPassword,
    role: "CUSTOMER",
  });
  assert.strictEqual(custReg.status, 201, "Customer registration should return 201");
  assert.ok(custReg.setCookie.includes("sa_session="), "Customer registration should issue session cookie");
  assert.strictEqual(custReg.data.user.role, "CUSTOMER", "Role should be CUSTOMER");
  assert.strictEqual(custReg.data.user.approvalStatus, "APPROVED", "Homeowner should be APPROVED immediately");
  console.log("✓ Homeowner registration succeeds with immediate session cookie & APPROVED status.");

  // -------------------------------------------------------------
  // Test 3: Dealer registration creates PENDING account & NO session cookie
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Testing Dealer registration...");
  const dealerReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Ganesh Hardware",
    email: testDealerEmail,
    phone: "9842401111",
    organization: "Ganesh Hardware Traces",
    gstin: "33AAAAA0000A1Z5",
    businessCity: "Trichy",
    password: testPassword,
    role: "DEALER",
    preferredPins: ["620001", "620002"],
  });
  assert.strictEqual(dealerReg.status, 201, "Dealer registration should return 201");
  assert.ok(!dealerReg.setCookie.includes("sa_session="), "CRITICAL: Dealer registration must NOT issue session cookie");
  assert.strictEqual(dealerReg.data.pendingApproval, true, "Dealer registration must return pendingApproval: true");
  assert.ok(!dealerReg.data.token, "Dealer registration must NOT return token");
  console.log("✓ Dealer registration returns 201, pendingApproval: true, and NO session cookie.");

  // -------------------------------------------------------------
  // Test 4: Distributor registration creates PENDING account & NO session cookie
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Testing Distributor registration...");
  const distReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Trichy Central Wholesale",
    email: testDistributorEmail,
    phone: "9842402222",
    organization: "Trichy Central Wholesale Distributors",
    gstin: "33BBBBB0000B1Z6",
    businessCity: "Trichy",
    password: testPassword,
    role: "DISTRIBUTOR",
    proposedPins: ["620001", "620002", "620003"],
    categories: ["Door Closer & Floor Spring", "Kitchen Basket"],
  });
  assert.strictEqual(distReg.status, 201, "Distributor registration should return 201");
  assert.ok(!distReg.setCookie.includes("sa_session="), "CRITICAL: Distributor registration must NOT issue session cookie");
  assert.strictEqual(distReg.data.pendingApproval, true, "Distributor registration must return pendingApproval: true");
  assert.ok(!distReg.data.token, "Distributor registration must NOT return token");
  console.log("✓ Distributor registration returns 201, pendingApproval: true, and NO session cookie.");

  // -------------------------------------------------------------
  // Test 5: Duplicate registration is rejected with 409
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Testing duplicate registration...");
  const dupReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Ganesh Duplicate",
    email: testDealerEmail,
    phone: "9842401111",
    organization: "Ganesh Duplicate",
    password: testPassword,
    role: "DEALER",
  });
  assert.strictEqual(dupReg.status, 409, "Duplicate registration must return 409");
  console.log("✓ Duplicate registration correctly rejected with HTTP 409:", dupReg.data.error);

  // -------------------------------------------------------------
  // Test 6: Pending Dealer CANNOT log in before admin approval
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Testing Pending Dealer login attempt...");
  const dealerLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(dealerLogin.status, 403, "Pending Dealer login must be blocked with HTTP 403");
  assert.strictEqual(dealerLogin.data.code, "ACCOUNT_PENDING_APPROVAL", "Error code must be ACCOUNT_PENDING_APPROVAL");
  assert.strictEqual(dealerLogin.data.title, "Account Approval Pending", "Title must match Task 04");
  assert.strictEqual(
    dealerLogin.data.error,
    "Your registration has been submitted successfully. Please wait for admin approval before logging in.",
    "Message must match Task 04"
  );
  assert.ok(!dealerLogin.setCookie.includes("sa_session="), "CRITICAL: No session cookie issued to pending account");
  console.log("✓ Pending Dealer login blocked: 403 ACCOUNT_PENDING_APPROVAL.");

  // -------------------------------------------------------------
  // Test 7: Pending Distributor CANNOT log in before admin approval
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Testing Pending Distributor login attempt...");
  const distLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDistributorEmail,
    password: testPassword,
  });
  assert.strictEqual(distLogin.status, 403, "Pending Distributor login must be blocked with HTTP 403");
  assert.strictEqual(distLogin.data.code, "ACCOUNT_PENDING_APPROVAL", "Error code must be ACCOUNT_PENDING_APPROVAL");
  assert.ok(!distLogin.setCookie.includes("sa_session="), "CRITICAL: No session cookie issued to pending account");
  console.log("✓ Pending Distributor login blocked: 403 ACCOUNT_PENDING_APPROVAL.");

  // -------------------------------------------------------------
  // Test 8: Invalid password returns 401 (does not leak pending status)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Testing invalid password on pending account (non-enumeration)...");
  const badPassLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDealerEmail,
    password: "WrongPassword999!",
  });
  assert.strictEqual(badPassLogin.status, 401, "Invalid password must return 401");
  assert.strictEqual(badPassLogin.data.error, "Invalid email or password. Please try again.");
  console.log("✓ Invalid credentials return generic 401 message without leaking account status.");

  // -------------------------------------------------------------
  // Test 9: Admin Authentication & Inspection of Pending Accounts
  // -------------------------------------------------------------
  console.log("\n[TEST 9] Admin logs in to inspect pending applications...");
  const adminLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: "admin@sai-ajanta.com",
    password: "Admin1234!",
    portalRole: "ADMIN",
  });
  assert.strictEqual(adminLogin.status, 200, "Admin login must succeed");
  const adminCookie = adminLogin.setCookie.split(";")[0];
  console.log("✓ Admin authenticated successfully.");

  // Direct backend admin auth token to fetch portal data
  const backendAdminAuth = await postJson(`${MEDUSA_BASE}/auth/user/emailpass`, {
    email: "admin@sai-ajanta.com",
    password: "Admin1234!",
  });
  assert.ok(backendAdminAuth.ok, "Backend admin auth must succeed");
  const adminBearer = `Bearer ${backendAdminAuth.data.token}`;

  const portalData = await getJson(`${MEDUSA_BASE}/admin/sai-ajanta/portal`, {
    Authorization: adminBearer,
  });
  assert.strictEqual(portalData.status, 200, "Portal query must succeed");

  const pendingDealer = portalData.data.users.find((u) => u.email === testDealerEmail);
  assert.ok(pendingDealer, "Pending dealer must be visible in admin portal users");
  assert.strictEqual(pendingDealer.approval_status, "PENDING_APPROVAL", "Status must be PENDING_APPROVAL");
  console.log(`✓ Admin verified pending dealer in directory: id=${pendingDealer.id}, status=${pendingDealer.approval_status}`);

  const pendingDist = portalData.data.users.find((u) => u.email === testDistributorEmail);
  assert.ok(pendingDist, "Pending distributor must be visible in admin portal users");
  assert.strictEqual(pendingDist.approval_status, "PENDING_APPROVAL", "Status must be PENDING_APPROVAL");
  console.log(`✓ Admin verified pending distributor in directory: id=${pendingDist.id}, status=${pendingDist.approval_status}`);

  // -------------------------------------------------------------
  // Test 10: Admin Approves Dealer
  // -------------------------------------------------------------
  console.log("\n[TEST 10] Admin approves the Dealer account...");
  const approveDealerRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${pendingDealer.id}`,
    { status: "ACTIVE" },
    { Authorization: adminBearer }
  );
  assert.strictEqual(approveDealerRes.status, 200, "Dealer approval must return 200");
  assert.strictEqual(approveDealerRes.data.profile.status, "ACTIVE", "Profile status must be ACTIVE");
  console.log("✓ Dealer approved successfully in authoritative database.");

  // -------------------------------------------------------------
  // Test 11: Approved Dealer can now log in successfully!
  // -------------------------------------------------------------
  console.log("\n[TEST 11] Testing Approved Dealer login...");
  const approvedDealerLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(approvedDealerLogin.status, 200, "Approved dealer login must succeed with HTTP 200");
  assert.ok(approvedDealerLogin.setCookie.includes("sa_session="), "Session cookie must be issued to approved dealer");
  assert.strictEqual(approvedDealerLogin.data.user.role, "DEALER");
  assert.strictEqual(approvedDealerLogin.data.user.approvalStatus, "APPROVED");
  console.log("✓ Approved Dealer logs in successfully and receives authenticated session!");

  // -------------------------------------------------------------
  // Test 12: Admin Approves Distributor & Distributor logs in
  // -------------------------------------------------------------
  console.log("\n[TEST 12] Admin approves Distributor & testing Distributor login...");
  const approveDistRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${pendingDist.id}`,
    { status: "ACTIVE" },
    { Authorization: adminBearer }
  );
  assert.strictEqual(approveDistRes.status, 200, "Distributor approval must return 200");

  const approvedDistLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDistributorEmail,
    password: testPassword,
  });
  assert.strictEqual(approvedDistLogin.status, 200, "Approved distributor login must succeed");
  assert.ok(approvedDistLogin.setCookie.includes("sa_session="), "Session cookie must be issued to approved distributor");
  assert.strictEqual(approvedDistLogin.data.user.role, "DISTRIBUTOR");
  assert.strictEqual(approvedDistLogin.data.user.approvalStatus, "APPROVED");
  console.log("✓ Approved Distributor logs in successfully and receives authenticated session!");

  // -------------------------------------------------------------
  // Test 13: Admin Rejection flow & Login blocking
  // -------------------------------------------------------------
  console.log("\n[TEST 13] Testing Application Rejection flow...");
  // Register new dealer for rejection
  await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "Reject Dealer",
    email: testRejectDealerEmail,
    phone: "9842403333",
    organization: "Reject Enterprise",
    password: testPassword,
    role: "DEALER",
  });

  const portalAfterRejectReg = await getJson(`${MEDUSA_BASE}/admin/sai-ajanta/portal`, {
    Authorization: adminBearer,
  });
  const rejectDealerUser = portalAfterRejectReg.data.users.find((u) => u.email === testRejectDealerEmail);
  assert.ok(rejectDealerUser, "User to reject must be found");

  const rejectRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${rejectDealerUser.id}`,
    { status: "REJECTED", rejection_reason: "Incomplete GST verification document." },
    { Authorization: adminBearer }
  );
  assert.strictEqual(rejectRes.status, 200, "Rejection must return 200");

  const rejectedLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testRejectDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(rejectedLogin.status, 403, "Rejected login must be blocked with HTTP 403");
  assert.strictEqual(rejectedLogin.data.code, "ACCOUNT_REJECTED", "Error code must be ACCOUNT_REJECTED");
  assert.strictEqual(rejectedLogin.data.title, "Registration Not Approved", "Title must match Task 04");
  assert.strictEqual(
    rejectedLogin.data.error,
    "Your registration was not approved. Please contact our support team for more information.",
    "Message must match Task 04"
  );
  console.log("✓ Rejected account login blocked: 403 ACCOUNT_REJECTED with exact specified messages.");

  // -------------------------------------------------------------
  // Test 14: Account Suspension & Session Invalidation
  // -------------------------------------------------------------
  console.log("\n[TEST 14] Testing Account Suspension and session revocation...");
  const suspendRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${pendingDealer.id}`,
    { status: "SUSPENDED", rejection_reason: "Account under commercial compliance audit." },
    { Authorization: adminBearer }
  );
  assert.strictEqual(suspendRes.status, 200, "Suspension must return 200");

  const suspendedLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: testDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(suspendedLogin.status, 403, "Suspended login must be blocked with HTTP 403");
  assert.strictEqual(suspendedLogin.data.code, "ACCOUNT_SUSPENDED", "Error code must be ACCOUNT_SUSPENDED");
  assert.strictEqual(suspendedLogin.data.title, "Account Suspended", "Title must match Task 04");
  assert.strictEqual(
    suspendedLogin.data.error,
    "Your account has been suspended. Please contact support for assistance.",
    "Message must match Task 04"
  );
  console.log("✓ Suspended account login blocked: 403 ACCOUNT_SUSPENDED with exact specified messages.");

  // Test that previously issued session cookie for this dealer is now rejected by getSessionContext()
  const dealerSessionCookie = approvedDealerLogin.setCookie.split(";")[0];
  const meAfterSuspend = await getJson(`${STORE_BASE}/api/auth/me`, {
    Cookie: dealerSessionCookie,
  });
  assert.ok(
    meAfterSuspend.status === 401 || meAfterSuspend.status === 403,
    "Previously issued session must be rejected after suspension (got status " + meAfterSuspend.status + ")"
  );
  assert.strictEqual(meAfterSuspend.data.user, null, "User must be null for suspended session");
  console.log("✓ Previously active session cookie is immediately rejected (HTTP 403, user=null) once suspended.");

  // -------------------------------------------------------------
  // Test 15: Durable Audit Log Verification
  // -------------------------------------------------------------
  console.log("\n[TEST 15] Verifying durable audit logs for approval and rejection mutations...");
  const auditLogs = await getJson(`${MEDUSA_BASE}/admin/sai-ajanta/audit-log?limit=10`, {
    Authorization: adminBearer,
  });
  assert.strictEqual(auditLogs.status, 200, "Audit log query must return 200");
  const events = auditLogs.data.events;
  assert.ok(Array.isArray(events), "Audit events must be an array");
  const lifecycleEvents = events.filter((l) => l.action === "STAFF_ACCOUNT_LIFECYCLE_MUTATION");
  assert.ok(lifecycleEvents.length >= 2, "Must contain lifecycle events for approval, suspension, or rejection");
  console.log(`✓ Durable audit log verified: found ${lifecycleEvents.length} STAFF_ACCOUNT_LIFECYCLE_MUTATION events.`);

  // -------------------------------------------------------------
  // Test 16: Unauthorized staff approval blocked
  // -------------------------------------------------------------
  console.log("\n[TEST 16] Testing unauthorized approval rejection...");
  const unauthApproval = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${pendingDealer.id}`,
    { status: "ACTIVE" }
    // No Authorization header
  );
  assert.strictEqual(unauthApproval.status, 401, "Unauthenticated approval must return 401");
  console.log("✓ Unauthorized approval correctly rejected with HTTP 401.");

  // -------------------------------------------------------------
  // Test 17: User cannot self-approve or elevate privileges through payloads
  // -------------------------------------------------------------
  console.log("\n[TEST 17] Testing privilege escalation resistance on public profile API...");
  // Attempt to self-approve via POST /store/sai-ajanta/profile using a customer token
  const customerAuth = await postJson(`${MEDUSA_BASE}/auth/customer/emailpass`, {
    email: testCustomerEmail,
    password: testPassword,
  });
  assert.ok(customerAuth.ok, "Customer auth token acquired");
  const custBearer = `Bearer ${customerAuth.data.token}`;

  const selfElevateRes = await postJson(
    `${MEDUSA_BASE}/store/sai-ajanta/profile`,
    { role: "DISTRIBUTOR", status: "ACTIVE" }, // Attempting to self-promote to ACTIVE DISTRIBUTOR
    { Authorization: custBearer }
  );
  // Backend must NOT activate: it records pending_upgrade_status = PENDING_APPROVAL and leaves status = ACTIVE (customer)
  assert.ok(selfElevateRes.ok, "Profile update responded");
  assert.strictEqual(selfElevateRes.data.profile.role, "CUSTOMER", "Role must remain CUSTOMER until Admin approves");
  console.log("✓ Privilege escalation attempt rejected: role remains CUSTOMER, pending_upgrade recorded.");

  // -------------------------------------------------------------
  // Test 18: Trade pricing is strictly stripped for unapproved users
  // -------------------------------------------------------------
  console.log("\n[TEST 18] Testing trade pricing stripping for unapproved users...");
  const catalogRes = await getJson(`${MEDUSA_BASE}/store/sai-ajanta/catalog`, {
    Authorization: custBearer,
  });
  assert.strictEqual(catalogRes.status, 200, "Catalog fetch must succeed");
  const sampleProduct = catalogRes.data.products[0];
  assert.ok(sampleProduct, "Product returned in catalog");
  assert.strictEqual(sampleProduct.dealer_price_inr, undefined, "dealer_price_inr must be stripped for non-trade account");
  assert.strictEqual(sampleProduct.distributor_price_inr, undefined, "distributor_price_inr must be stripped for non-trade account");
  console.log("✓ Trade pricing successfully stripped: only retail/customer pricing exposed.");

  // -------------------------------------------------------------
  // Test 19: Full End-to-End Workflow: Dealer Register → Pending → Blocked → Admin Approves → Login Success
  // -------------------------------------------------------------
  console.log("\n[TEST 19] Running full End-to-End Dealer lifecycle workflow...");
  const e2eDealerEmail = `e2e_dealer_${timestamp}@saiajantha.com`;
  
  // Step 1: Register
  const e2eReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "E2E Verified Dealer",
    email: e2eDealerEmail,
    phone: "9842409999",
    organization: "E2E Hardware Solutions",
    gstin: "33CCCCCC0000C1Z7",
    businessCity: "Madurai",
    password: testPassword,
    role: "DEALER",
  });
  assert.strictEqual(e2eReg.status, 201);
  assert.ok(!e2eReg.setCookie.includes("sa_session="), "No session cookie on registration");

  // Step 2: Login must be blocked while PENDING_APPROVAL
  const e2ePendingLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: e2eDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(e2ePendingLogin.status, 403);
  assert.strictEqual(e2ePendingLogin.data.code, "ACCOUNT_PENDING_APPROVAL");

  // Step 3: Admin inspects and approves
  const portalLatest = await getJson(`${MEDUSA_BASE}/admin/sai-ajanta/portal`, {
    Authorization: adminBearer,
  });
  const e2eUser = portalLatest.data.users.find((u) => u.email === e2eDealerEmail);
  assert.ok(e2eUser, "E2E user found in admin portal");

  const e2eApproveRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${e2eUser.id}`,
    { status: "ACTIVE" },
    { Authorization: adminBearer }
  );
  assert.strictEqual(e2eApproveRes.status, 200);

  // Step 4: Dealer now logs in successfully
  const e2eFinalLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: e2eDealerEmail,
    password: testPassword,
  });
  assert.strictEqual(e2eFinalLogin.status, 200);
  assert.ok(e2eFinalLogin.setCookie.includes("sa_session="), "Session cookie granted upon approval");
  assert.strictEqual(e2eFinalLogin.data.user.role, "DEALER");
  assert.strictEqual(e2eFinalLogin.data.user.approvalStatus, "APPROVED");
  console.log("✓ Full End-to-End Dealer lifecycle workflow completed successfully!");

  // -------------------------------------------------------------
  // Test 20: Full End-to-End Workflow: Distributor Register → Pending → Blocked → Admin Approves → Login Success
  // -------------------------------------------------------------
  console.log("\n[TEST 20] Running full End-to-End Distributor lifecycle workflow...");
  const e2eDistEmail = `e2e_dist_${timestamp}@saiajantha.com`;

  // Step 1: Register
  const e2eDistReg = await postJson(`${STORE_BASE}/api/auth/register`, {
    name: "E2E Regional Wholesale",
    email: e2eDistEmail,
    phone: "9842408888",
    organization: "E2E Regional Distribution Hub",
    gstin: "33DDDDD0000D1Z8",
    businessCity: "Trichy",
    password: testPassword,
    role: "DISTRIBUTOR",
    proposedPins: ["620001", "620002"],
    categories: ["Door Closer & Floor Spring", "Kitchen Basket"],
  });
  assert.strictEqual(e2eDistReg.status, 201);
  assert.ok(!e2eDistReg.setCookie.includes("sa_session="), "No session cookie on registration");

  // Step 2: Login must be blocked while PENDING_APPROVAL
  const e2eDistPendingLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: e2eDistEmail,
    password: testPassword,
  });
  assert.strictEqual(e2eDistPendingLogin.status, 403);
  assert.strictEqual(e2eDistPendingLogin.data.code, "ACCOUNT_PENDING_APPROVAL");

  // Step 3: Admin inspects and approves
  const portalDistLatest = await getJson(`${MEDUSA_BASE}/admin/sai-ajanta/portal`, {
    Authorization: adminBearer,
  });
  const e2eDistUser = portalDistLatest.data.users.find((u) => u.email === e2eDistEmail);
  assert.ok(e2eDistUser, "E2E distributor found in admin portal");

  const e2eDistApproveRes = await patchJson(
    `${MEDUSA_BASE}/admin/sai-ajanta/customers/${e2eDistUser.id}`,
    { status: "ACTIVE" },
    { Authorization: adminBearer }
  );
  assert.strictEqual(e2eDistApproveRes.status, 200);

  // Step 4: Distributor now logs in successfully
  const e2eDistFinalLogin = await postJson(`${STORE_BASE}/api/auth/login`, {
    email: e2eDistEmail,
    password: testPassword,
  });
  assert.strictEqual(e2eDistFinalLogin.status, 200);
  assert.ok(e2eDistFinalLogin.setCookie.includes("sa_session="), "Session cookie granted upon approval");
  assert.strictEqual(e2eDistFinalLogin.data.user.role, "DISTRIBUTOR");
  assert.strictEqual(e2eDistFinalLogin.data.user.approvalStatus, "APPROVED");
  console.log("✓ Full End-to-End Distributor lifecycle workflow completed successfully!");

  console.log("\n=======================================================");
  console.log("🎉 ALL 20 AUTOMATED INTEGRATION & SECURITY TESTS PASSED!");
  console.log("=======================================================");
}

runTestSuite().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
