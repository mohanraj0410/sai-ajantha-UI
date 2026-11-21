async function testBuyerRegistration() {
  const ts = Date.now();
  const email = `buyer.test.${ts}@sai-ajanta-test.internal`;
  const res = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Kavitha Sundaram",
      email,
      phone: "9842455667",
      password: "TestPassword123!",
      role: "CUSTOMER",
      businessCity: "Trichy",
    }),
  });

  const data = await res.json();
  console.log("Buyer Registration Response Status:", res.status);
  console.log("Buyer Registration Data:", data);

  if (res.status === 201 && data.user && data.user.role === "CUSTOMER") {
    console.log("[PASS] Buyer Registration End-to-End Successful");
  } else {
    console.error("[FAIL] Buyer Registration Failed");
    process.exit(1);
  }
}

testBuyerRegistration().catch((e) => {
  console.error(e);
  process.exit(1);
});
