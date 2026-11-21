async function testLogin() {
  // Test invalid login
  const badRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent.user@example.com",
      password: "WrongPassword123!",
    }),
  });
  const badData = await badRes.json();
  console.log("Invalid login status:", badRes.status, "Error:", badData.error);
  if (badRes.status !== 401) {
    throw new Error("Expected 401 Unauthorized for bad credentials");
  }

  // Create fresh deterministic test user
  const ts = Date.now();
  const email = `buyer.login.${ts}@sai-ajanta-test.internal`;
  const password = "TestPassword123!";

  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Login Test User",
      email,
      phone: "9842499887",
      password,
      role: "CUSTOMER",
      businessCity: "Trichy",
    }),
  });
  if (regRes.status !== 201) {
    throw new Error(`User registration prerequisite failed: ${regRes.status}`);
  }

  // Test valid login
  const goodRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const goodData = await goodRes.json();
  console.log("Valid login status:", goodRes.status, "User:", goodData.user?.name, goodData.user?.role);
  if (goodRes.status !== 200 || !goodData.user) {
    throw new Error("Expected 200 OK for valid credentials");
  }

  console.log("\n[PASS] Real End-to-End Login Verification Passed!");
}

testLogin().catch((e) => {
  console.error(e);
  process.exit(1);
});
