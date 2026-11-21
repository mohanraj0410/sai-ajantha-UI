// Using built-in fetch

const STOREFRONT_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:9000";
const PUBLISHABLE_KEY = "pk_b62d5e6a89859691e73b003895d5f58590410fdca8252a42abbb688e56a6c627";

async function run() {
  console.log("=== P5.1.1 TRUE HTTP SESSION REVOCATION VERIFICATION ===");

  // 1. Verify /store/sai-ajanta/auth/test-password-sink is truly 404
  console.log("\n[Test 1] Verifying public token sink is absent...");
  const sinkRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/auth/test-password-sink`, {
    headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
  });
  console.log(`GET /store/sai-ajanta/auth/test-password-sink status: ${sinkRes.status}`);
  if (sinkRes.status !== 404) {
    throw new Error(`Expected 404 for test sink, got ${sinkRes.status}`);
  }
  console.log("PASS: Test sink is 404 Not Found (no sensitive token disclosure).");

  // 2. Generate unique test user credentials
  const uniqueId = Date.now();
  const testEmail = `test.revocation.${uniqueId}@sai-ajanta-test.internal`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "NewRotatedPassword456!";

  // 2. Register customer on Device A (receives Session A cookie directly)
  console.log(`\n[Test 2] Registering customer on Device A: ${testEmail}...`);
  const regRes = await fetch(`${STOREFRONT_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
      name: "Session Tester",
      phone: "9876543210",
      role: "CUSTOMER",
    }),
  });
  console.log(`Register status: ${regRes.status}`);
  const regData = await regRes.json();
  console.log("Register response:", regData);
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const rawCookieA = regRes.headers.get("set-cookie");
  if (!rawCookieA) throw new Error("No session cookie set on registration for Device A");
  const cookieA = rawCookieA.split(";")[0];
  console.log("PASS: Registered customer and acquired Session A cookie (Device A).");

  // Delay before login to avoid Medusa auth rate limiting
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Login Session B (Device B)
  console.log("\n[Test 3] Logging in Session B (Device B)...");
  const loginResB = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
    }),
  });
  console.log(`Login Session B status: ${loginResB.status}`);
  const rawCookieB = loginResB.headers.get("set-cookie");
  if (!rawCookieB) throw new Error("No session cookie set for Session B");
  const cookieB = rawCookieB.split(";")[0];
  console.log("PASS: Session B cookie acquired (Device B).");

  // 4. Verify Session B is valid prior to revocation
  console.log("\n[Test 4] Verifying Session B is currently authenticated...");
  const meResB1 = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: cookieB },
  });
  console.log(`Session B /api/auth/me status: ${meResB1.status}`);
  const meDataB1 = await meResB1.json();
  if (meResB1.status !== 200 || !meDataB1.user) {
    throw new Error(`Session B expected 200, got ${meResB1.status}: ${JSON.stringify(meDataB1)}`);
  }
  console.log(`PASS: Session B authenticated as: ${meDataB1.user.email}`);

  // Small delay so revocation timestamp > Session B iat
  await new Promise((r) => setTimeout(r, 1200));

  // 6. Request password reset on Device A
  console.log("\n[Test 6] Requesting password reset on Device A...");
  const forgotRes = await fetch(`${STOREFRONT_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });
  console.log(`Forgot-password status: ${forgotRes.status}`);
  const forgotData = await forgotRes.json();
  console.log("Forgot response (generic non-enumerating):", forgotData);
  if (forgotRes.status !== 200 || !forgotData.ok) {
    throw new Error(`Forgot-password expected 200, got ${forgotRes.status}: ${JSON.stringify(forgotData)}`);
  }
  console.log("PASS: Forgot-password returned 200 with non-enumerating message.");

  // 7. Directly simulate credential update / session revocation in database
  // (Sets session_revoked_at in customer's DMS AccountProfile, exactly as reset-password route and staff suspension do)
  console.log("\n[Test 7] Setting session_revoked_at on customer account profile in DB...");
  const pgModule = await import("../apps/backend/node_modules/pg/lib/index.js");
  const Client = pgModule.default?.Client || pgModule.Client || pgModule.default;
  const pgClient = new Client({
    connectionString: "postgres://medusa:medusa@127.0.0.1:5432/medusa",
  });
  await pgClient.connect();

  const nowIso = new Date().toISOString();
  await pgClient.query(
    `UPDATE account_profile 
     SET dynamic_attributes = jsonb_set(
       COALESCE(dynamic_attributes, '{}'::jsonb), 
       '{session_revoked_at}', 
       $1::jsonb
     )
     WHERE customer_id = $2`,
    [JSON.stringify(nowIso), regData.user.id]
  );
  await pgClient.end();
  console.log(`PASS: Set session_revoked_at = ${nowIso} for customer ${regData.user.id}`);

  // 8. Verify cross-device session revocation:
  // When session_revoked_at is set in DMS AccountProfile, Session B (which was issued earlier)
  // MUST be rejected by getSessionContext with 401 Session Revoked!
  console.log("\n[Test 8] Checking Session B (Device B) behavior after revocation...");
  const meResB2 = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: cookieB },
  });
  console.log(`Session B /api/auth/me status after revocation: ${meResB2.status}`);
  const meDataB2 = await meResB2.json();
  console.log("Session B response:", meDataB2);

  if (meResB2.status !== 401 || !meDataB2.error?.includes("invalidated")) {
    throw new Error(`Expected 401 Session Invalidated, got ${meResB2.status}: ${JSON.stringify(meDataB2)}`);
  }
  console.log("PASS: Session B was rejected with 401 (Cross-Device Session Revocation Server-Enforced!).");

  // 9. Verify Session A (Device A) is ALSO revoked because its cookie was issued before the revocation timestamp
  console.log("\n[Test 9] Checking Session A (Device A) behavior after revocation...");
  const meResA2 = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: cookieA },
  });
  console.log(`Session A /api/auth/me status after revocation: ${meResA2.status}`);
  const meDataA2 = await meResA2.json();
  console.log("Session A response:", meDataA2);
  if (meResA2.status !== 401) {
    throw new Error(`Expected 401 for Session A as well, got ${meResA2.status}`);
  }
  console.log("PASS: Session A was also rejected with 401.");

  // 10. Re-login with credentials to acquire a fresh session
  console.log("\n[Test 10] Fresh login after revocation...");
  // Sleep 1.5s to respect login rate limits
  await new Promise((r) => setTimeout(r, 1500));
  const freshLoginRes = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
    }),
  });
  console.log(`Fresh login status: ${freshLoginRes.status}`);
  if (freshLoginRes.status === 200) {
    const rawFreshCookie = freshLoginRes.headers.get("set-cookie");
    const freshCookie = rawFreshCookie?.split(";")[0];

    const freshMeRes = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
      headers: { Cookie: freshCookie },
    });
    console.log(`Fresh session /api/auth/me status: ${freshMeRes.status}`);
    const freshMeData = await freshMeRes.json();
    if (freshMeRes.status === 200 && freshMeData.user) {
      console.log("PASS: Fresh login session is accepted (issued after revocation timestamp).");
    }
  } else {
    console.log(`Login throttled with ${freshLoginRes.status} (rate limiter active).`);
  }

  // 11. Test Trade Suspension Lockout
  console.log("\n[Test 11] Verifying Trade Suspension Lockout on protected pricing...");
  // Temporarily set role = DEALER and status = SUSPENDED in DB
  const pgClient2 = new Client({
    connectionString: "postgres://medusa:medusa@127.0.0.1:5432/medusa",
  });
  await pgClient2.connect();
  await pgClient2.query(
    `UPDATE account_profile 
     SET role = 'DEALER', status = 'SUSPENDED' 
     WHERE customer_id = $1`,
    [regData.user.id]
  );
  await pgClient2.end();
  console.log("Set account role = DEALER, status = SUSPENDED in DB.");

  // Login as suspended dealer
  const suspLoginRes = await fetch(`${STOREFRONT_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
    }),
  });
  const suspCookie = suspLoginRes.headers.get("set-cookie")?.split(";")[0];

  const suspMeRes = await fetch(`${STOREFRONT_URL}/api/auth/me`, {
    headers: { Cookie: suspCookie },
  });
  const suspMeData = await suspMeRes.json();
  console.log("Suspended user /api/auth/me response:", suspMeData);

  if (suspMeData.wholesaleUnlocked !== false || suspMeData.effectivePriceTier !== "CUSTOMER") {
    throw new Error(`Suspended user must not unlock wholesale pricing! Got: ${JSON.stringify(suspMeData)}`);
  }
  console.log("PASS: Suspended user is strictly locked to B2C pricing (wholesaleUnlocked: false).");

  console.log("\n=== SUMMARY OF P5.1.1 VERIFICATION ===");
  console.log("1. Public test sink: 404 Confirmed.");
  console.log("2. Cross-device session revocation: Confirmed (401 across all devices).");
  console.log("3. Generic forgot-password response: Confirmed.");
  console.log("4. Suspension trade lockout: Confirmed (wholesaleUnlocked: false).");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
