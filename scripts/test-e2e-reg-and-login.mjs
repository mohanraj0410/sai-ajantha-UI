async function run() {
  const ts = Date.now();
  const email = `login.verify.${ts}@sai-ajanta-test.internal`;
  const password = "VerifyPassword123!";

  console.log("1. Registering user:", email);
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ramesh Verification",
      email,
      phone: "9842411999",
      password,
      role: "CUSTOMER",
      businessCity: "Trichy",
    }),
  });
  console.log("Registration status:", regRes.status);
  const regData = await regRes.json();
  console.log("Registration response:", regData);

  console.log("\n2. Attempting login with same credentials...");
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  console.log("Login status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login response:", loginData);

  if (loginRes.status === 200 && loginData.user) {
    console.log("\n[PASS] E2E Registration and Login Successfully Verified!");
  } else {
    console.error("\n[FAIL] Login failed:", loginData);
    process.exit(1);
  }
}

run().catch(console.error);
