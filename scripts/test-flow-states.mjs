async function testFlows() {
  const tests = [
    {
      url: "http://localhost:3000/dealer",
      expected: ["Trade Dealer Sign-In Required", "Single Login", "11 Categories"],
      name: "Dealer Portal Gate",
    },
    {
      url: "http://localhost:3000/distributor",
      expected: ["Distributor Sign-In Required", "wholesale Buy Stock"],
      name: "Distributor Portal Gate",
    },
    {
      url: "http://localhost:3000/installation",
      expected: [
        "Need Installation?",
        "Independent Contractor Billing &amp; Responsibility",
        "Direct product orders do not include installation",
      ],
      name: "Installation Flow & Policy",
    },
    {
      url: "http://localhost:3000/quotes",
      expected: ["Direct Trade &amp; Custom Sizing Quotation Desk", "GST invoice"],
      name: "Quotes Desk",
    },
    {
      url: "http://localhost:3000/shipping-policy",
      expected: ["Delivery &amp; Shipping Policy", "Tamil Nadu", "PIN Code"],
      name: "Shipping Policy",
    },
    {
      url: "http://localhost:3000/privacy-policy",
      expected: ["Privacy Policy", "Data We Collect", "Cookies"],
      name: "Privacy Policy",
    },
    {
      url: "http://localhost:3000/return-policy",
      expected: ["Return &amp; Replacement Policy", "Damage or Transit Issue"],
      name: "Return Policy",
    },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await fetch(t.url);
      const text = await res.text();
      const allFound = t.expected.every((str) => text.includes(str));
      if (allFound) {
        console.log(`[PASS] ${t.name} (${t.url})`);
        passed++;
      } else {
        console.error(`[FAIL] ${t.name} (${t.url})`);
        for (const exp of t.expected) {
          if (!text.includes(exp)) {
            console.error(`   Missing string: "${exp}"`);
          }
        }
      }
    } catch (e) {
      console.error(`[ERROR] ${t.name}: ${e.message}`);
    }
  }

  console.log(`\nFlow Verification: ${passed}/${tests.length} tests passed.`);
  if (passed !== tests.length) process.exit(1);
}

testFlows();
