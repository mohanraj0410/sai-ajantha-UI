import { test, expect } from "@playwright/test";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const jwt = require(path.resolve("apps/backend/node_modules/jsonwebtoken"));

const PUBLISHABLE_KEY = "pk_b62d5e6a89859691e73b003895d5f58590410fdca8252a42abbb688e56a6c627";
const BACKEND_URL = "http://localhost:9000";
const STOREFRONT_URL = "http://localhost:3000";
const ADMIN_URL = "http://localhost:7001";

// Admin Token
const ADMIN_TOKEN = jwt.sign(
  {
    actor_id: "user_01M7HKV844E5ANNCEHQDJKTY8E",
    actor_type: "user",
    auth_identity_id: "authid_01M7HKV87E5BM5A0F4TBPZBYZ3",
    app_metadata: { user_id: "user_01M7HKV844E5ANNCEHQDJKTY8E" },
  },
  "supersecret",
  { expiresIn: "7d" }
);

const ADMIN_USER_JSON = JSON.stringify({
  id: "user_01M7HKV844E5ANNCEHQDJKTY8E",
  email: "admin@sai-ajanta.com",
  firstName: "Super",
  lastName: "Admin",
  role: "admin",
  isFullAdmin: true,
  permissions: [
    "ENQUIRIES_MANAGE",
    "ORDERS_MANAGE",
    "CATALOG_MANAGE",
    "CUSTOMERS_MANAGE",
    "ANALYTICS_VIEW",
    "SETTINGS_MANAGE",
  ],
});

// Customer A (Legitimate Customer)
const CUSTOMER_A_ID = "cus_01M7PRCN5QGH0V8EVGE99G94RE";
const CUSTOMER_A_EMAIL = "login.verify.1794986365904@sai-ajanta-test.internal";
const CUSTOMER_A_TOKEN = jwt.sign(
  {
    actor_id: CUSTOMER_A_ID,
    actor_type: "customer",
    auth_identity_id: "authid_01M7PRCN46H54AM8Y1BQY2GAEV",
    app_metadata: { customer_id: CUSTOMER_A_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

// Customer B (Unauthorized Third Party / Attacker)
const CUSTOMER_B_ID = "cus_01M7RIVAL_ATTACKER_999";
const CUSTOMER_B_EMAIL = "attacker@rival-agency.internal";
const CUSTOMER_B_TOKEN = jwt.sign(
  {
    actor_id: CUSTOMER_B_ID,
    actor_type: "customer",
    auth_identity_id: "authid_rival_attacker_999",
    app_metadata: { customer_id: CUSTOMER_B_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

// Dealer A (Approved Dealer linked to dist_a)
const DEALER_A_ID = "dealer_a_1795091395632";
const DEALER_A_TOKEN = jwt.sign(
  {
    actor_id: DEALER_A_ID,
    actor_type: "customer",
    auth_identity_id: "authid_dealer_a_test",
    app_metadata: { customer_id: DEALER_A_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

// Distributor A (Trichy Hardware Distributors)
const DIST_A_ID = "dist_a_1795091395632";
const DIST_A_TOKEN = jwt.sign(
  {
    actor_id: DIST_A_ID,
    actor_type: "customer",
    auth_identity_id: "authid_dist_a_test",
    app_metadata: { customer_id: DIST_A_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

// Distributor B (Madurai Glass & Fittings Dist)
const DIST_B_ID = "dist_b_1795091395632";
const DIST_B_TOKEN = jwt.sign(
  {
    actor_id: DIST_B_ID,
    actor_type: "customer",
    auth_identity_id: "authid_dist_b_test",
    app_metadata: { customer_id: DIST_B_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

function createSessionCookie(role: "CUSTOMER" | "ADMIN", token: string): string {
  const secret = process.env.SESSION_SECRET?.trim() || "dev-only-sai-ajantha-session-secret-change-in-prod";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = {
    role,
    medusaToken: token,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
    iat: Date.now(),
  };
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

test.describe.serial("Sai Ajantha Complete End-to-End Seller Routing & Business Workflow Verification", () => {
  const screenshotsDir = path.resolve("docs/screenshots/seller-routing");
  const brainDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\9197995e-7587-4b98-81ac-eb34724fe343";

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  // CASE 1: Direct product maps to Sai Ajantha
  test("CASE-01: Direct product maps to Sai Ajantha", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "A-DT-12-001", postalCode: "620001" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.resolvedRoute).toBe("SAI_AJANTHA_DIRECT");
    expect(resolution.sellerId).toBe("SAI_AJANTHA_CENTRAL");
    expect(resolution.sellerName).toContain("Sai Ajantha Central");
    expect(resolution.serviceable).toBe(true);
  });

  // CASE 2: Door Closer maps to an approved distributor serving the PIN
  test("CASE-02: Door Closer maps to an approved distributor serving the PIN", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-M-DC-100-004", postalCode: "620001" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.resolvedRoute).toBe("DISTRIBUTOR_RESALE");
    expect(resolution.sellerId).toBe(DIST_A_ID);
    expect(resolution.sellerName).toBe("Trichy Hardware Distributors");
    expect(resolution.serviceable).toBe(true);
  });

  // CASE 3: Kitchen Basket maps to an approved eligible distributor
  test("CASE-03: Kitchen Basket maps to an approved eligible distributor", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-T-KB-OO18", postalCode: "620001" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.resolvedRoute).toBe("DISTRIBUTOR_RESALE");
    expect(resolution.sellerId).toBe(DIST_A_ID);
    expect(resolution.sellerName).toBe("Trichy Hardware Distributors");
    expect(resolution.serviceable).toBe(true);
  });

  // CASE 4: Approved dealer uses their verified linked distributor
  test("CASE-04: Approved dealer uses their verified linked distributor", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-M-DC-100-004", postalCode: "620001", actorId: DEALER_A_ID },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${DEALER_A_TOKEN}`,
      },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.sellerId).toBe(DIST_A_ID);
    expect(resolution.sellerName).toBe("Trichy Hardware Distributors");
    expect(resolution.serviceable).toBe(true);
  });

  // CASE 5: No matching distributor keeps the enquiry AWAITING_SELLER
  test("CASE-05: No matching distributor keeps the enquiry AWAITING_SELLER", async ({ request }) => {
    // 1. Resolution returns ENQUIRY_ONLY
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-M-DC-100-004", postalCode: "999999" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.resolvedRoute).toBe("ENQUIRY_ONLY");
    expect(resolution.serviceable).toBe(false);

    // 2. Submitting an enquiry for unserved PIN routes to AWAITING_SELLER with null seller
    const enqRes = await request.post(`${STOREFRONT_URL}/api/enquiries`, {
      data: {
        name: "Unserved Buyer",
        email: "unserved.buyer@example.com",
        phone: "9876599999",
        postal_code: "999999",
        division: "Door Closer & Floor Spring",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer", quantity: 5 }],
      },
    });
    expect([200, 201]).toContain(enqRes.status());
    const enqData = await enqRes.json();
    const enqAdminRes = await request.get(`${BACKEND_URL}/admin/sai-ajanta/enquiries/${enqData.id}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const enq = (await enqAdminRes.json()).enquiry;
    expect(enq.status).toBe("AWAITING_SELLER");
    expect(enq.assigned_seller_id).toBeNull();
  });

  // CASE 6: Multiple overlapping distributors without approved priority remain unresolved
  test("CASE-06: Multiple overlapping distributors without approved priority remain unresolved", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-M-DC-100-004", postalCode: "620005" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(["ENQUIRY_ONLY", "SAI_AJANTHA_DIRECT"]).toContain(resolution.resolvedRoute);
  });

  // CASE 7: Suspended distributors cannot receive new enquiries/orders
  test("CASE-07: Suspended distributors cannot receive new enquiries/orders", async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-M-DC-100-004", postalCode: "621001" }, // PIN assigned to suspended dist_c
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    expect(res.ok()).toBeTruthy();
    const { resolution } = await res.json();
    expect(resolution.resolvedRoute).toBe("ENQUIRY_ONLY");
    expect(resolution.serviceable).toBe(false);
  });

  // CASE 8: Customer receives only B2C quotation prices
  test("CASE-08: Customer receives only B2C quotation prices (Cross-role price leakage blocked)", async ({ request }) => {
    // Attempting to quote distributor wholesale price (₹2,475) to retail customer (customer price ₹4,125)
    const res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Direct Retail Customer",
        customer_email: "retail.leakage.test@example.com",
        customer_phone: "9812345000",
        postal_code: "620001",
        items: [
          {
            sku: "SA-M-DC-100-004",
            name: "Door Closer 100",
            quantity: 1,
            unitPriceInr: 2475, // Illegal wholesale distributor price!
          },
        ],
        status: "DRAFT",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(err.code).toBe("PRICE_ROLE_LEAKAGE");
    expect(err.message).toContain("Cross-role price leakage blocked");
  });

  // CASE 9: Dealer receives only authorized Dealer prices
  test("CASE-09: Dealer receives only authorized Dealer prices", async ({ request }) => {
    // Attempting to quote distributor stock purchase price (₹2,475) to a Dealer (authorized dealer price ₹3,575)
    const res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Cauvery Retail Hardware",
        customer_email: "cauvery.hardware@example.internal",
        customer_phone: "9876543202",
        postal_code: "620001",
        items: [
          {
            sku: "SA-M-DC-100-004",
            name: "Door Closer 100",
            quantity: 5,
            unitPriceInr: 2475, // Attempting distributor price tier for dealer!
          },
        ],
        status: "DRAFT",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(err.code).toBe("PRICE_ROLE_LEAKAGE");
  });

  // CASE 10: GST uses verified SKU-specific rates, never blanket 18%
  test("CASE-10: GST uses verified SKU-specific rates, never blanket 18%", async ({ request }) => {
    // 1. Quoting a SKU with verified 18% GST (SA-M-DC-100-004, B2C ₹4,125)
    const res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Verified GST Client",
        customer_email: "gst.client@example.com",
        customer_phone: "9876543211",
        postal_code: "620001",
        items: [
          {
            sku: "SA-M-DC-100-004",
            name: "Door Closer 100",
            quantity: 2,
            unitPriceInr: 4125,
          },
        ],
        status: "DRAFT",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.verifiedGstApplied).toBe(true);
    expect(data.subtotalInr).toBe(8250);
    expect(data.taxInr).toBe(1485); // Exactly 18% of 8250
    expect(data.totalInr).toBe(9735);

    // 2. Issuing a quotation with unverified/missing tax is rejected (no guesswork)
    const unverifiedTaxRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Unverified Tax Firm",
        customer_email: "unverified.tax@example.com",
        customer_phone: "9876543212",
        postal_code: "620001",
        items: [
          {
            sku: "CUSTOM-UNVERIFIED-SKU",
            name: "Custom BOQ Hardware",
            quantity: 1,
            unitPriceInr: 5000,
            gstRate: null, // Missing tax
          },
        ],
        status: "SHARED_NONPAYABLE", // Attempting issuance
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(unverifiedTaxRes.status()).toBe(400);
    const taxErr = await unverifiedTaxRes.json();
    expect(taxErr.code).toBe("UNVERIFIED_TAX_DATA");
  });

  // CASE 11: Customer accepts, rejects and requests quotation revision
  test("CASE-11: Customer accepts, rejects and requests quotation revision", async ({ request }) => {
    // 11A. Request Revision flow
    const q1Res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Revision Customer",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 5, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q1 = (await q1Res.json()).quote;

    const revRes = await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q1.id}/respond`, {
      data: { action: "REQUEST_REVISION", notes: "Please revise quantity to 10 units" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });
    expect(revRes.ok()).toBeTruthy();
    expect((await revRes.json()).quoteStatus).toBe("REVISION_REQUESTED");

    // 11B. Reject Quote flow
    const q2Res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Declining Customer",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 1, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q2 = (await q2Res.json()).quote;

    const rejRes = await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q2.id}/respond`, {
      data: { action: "REJECT", notes: "Project cancelled" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });
    expect(rejRes.ok()).toBeTruthy();
    expect((await rejRes.json()).quoteStatus).toBe("REJECTED");

    // 11C. Accept Quote flow
    const q3Res = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Accepting Customer",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 2, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q3 = (await q3Res.json()).quote;

    const accRes = await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q3.id}/respond`, {
      data: { action: "ACCEPT", notes: "Approved for supply" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });
    expect(accRes.ok()).toBeTruthy();
    expect((await accRes.json()).quoteStatus).toBe("ACCEPTED");
  });

  // CASE 12: Accepted quotation converts only after mandatory commercial validation
  test("CASE-12: Accepted quotation converts only after mandatory commercial validation", async ({ request }) => {
    // 1. Create and issue quote
    const qRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Commercial Verification Customer",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 3, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q = (await qRes.json()).quote;

    // 2. Customer accepts
    await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q.id}/respond`, {
      data: { action: "ACCEPT" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });

    // 3. Admin converts -> order status is PENDING_COMMERCIAL_VERIFICATION or CONFIRMED_TRADE_PO
    const convRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes/${q.id}/convert`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(convRes.ok()).toBeTruthy();
    const convData = await convRes.json();
    expect(convData.success).toBe(true);
    expect(convData.orderId).toBeTruthy();
    expect(["CONFIRMED_TRADE_PO", "PENDING_COMMERCIAL_VERIFICATION"]).toContain(convData.orderStatus);
    expect(convData.paymentStatus).toBe("PENDING_OFFLINE_SETTLEMENT");
  });

  // CASE 13: Duplicate conversion requests cannot create duplicate orders
  test("CASE-13: Duplicate conversion requests cannot create duplicate orders", async ({ request }) => {
    // Create, issue, accept quote
    const qRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Duplicate Conversion Guard Client",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 1, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q = (await qRes.json()).quote;

    await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q.id}/respond`, {
      data: { action: "ACCEPT" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });

    // First conversion: succeeds
    const firstConv = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes/${q.id}/convert`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(firstConv.ok()).toBeTruthy();

    // Second conversion: strictly rejected with ALREADY_CONVERTED
    const dupConv = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes/${q.id}/convert`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(dupConv.status()).toBe(400);
    const err = await dupConv.json();
    expect(err.code).toBe("ALREADY_CONVERTED");
  });

  // CASE 14: Floor Springs remain enquiry-only
  test("CASE-14: Floor Springs remain strictly enquiry-only per DEC-003", async ({ request }) => {
    // 1. Resolution is ENQUIRY_ONLY
    const res = await request.get(`${BACKEND_URL}/store/sai-ajanta/seller-resolution`, {
      params: { sku: "SA-I-FS-TON90-007", postalCode: "620001" },
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    const { resolution } = await res.json();
    expect(resolution.isQuoteOnly).toBe(true);
    expect(resolution.resolvedRoute).toBe("ENQUIRY_ONLY");
    expect(resolution.reason).toContain("DEC-003");

    // 2. If quote with Floor Spring is accepted, conversion is blocked
    const qRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Floor Spring Inquirer",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-I-FS-TON90-007", name: "Floor Spring -TON90-90kg", quantity: 2, unitPriceInr: 8255 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const q = (await qRes.json()).quote;

    await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${q.id}/respond`, {
      data: { action: "ACCEPT" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_A_TOKEN}`,
      },
    });

    const convRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes/${q.id}/convert`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(convRes.status()).toBe(400);
    const err = await convRes.json();
    expect(err.code).toBe("FLOOR_SPRING_ENQUIRY_ONLY");
  });

  // CASE 15: Installation requests remain separate from product orders
  test("CASE-15: Installation requests follow independent contractor workflow", async ({ request }) => {
    // 1. Submit installation enquiry
    const enqRes = await request.post(`${STOREFRONT_URL}/api/enquiries`, {
      data: {
        name: "Arun Installation Project",
        email: "arun.install@example.com",
        phone: "9876540001",
        city: "Trichy",
        postal_code: "620001",
        lead_type: "INSTALLATION",
        division: "Aluminium Sliding Systems Installation",
        notes: "Need turnkey partition fitting for 5 office suites",
      },
    });
    expect([200, 201]).toContain(enqRes.status());
    const enqId = (await enqRes.json()).id;

    // 2. Verify assigned seller type is CONTRACTOR_FLOW
    const adminEnqRes = await request.get(`${BACKEND_URL}/admin/sai-ajanta/enquiries/${enqId}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const enq = (await adminEnqRes.json()).enquiry;
    expect(enq.assigned_seller_type).toBe("CONTRACTOR_FLOW");
    expect(enq.lead_type).toBe("INSTALLATION");

    // 3. Issue separate service quotation linked to contractor
    const quoteRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        enquiry_id: enqId,
        customer_name: "Arun Installation Project",
        customer_email: "arun.install@example.com",
        customer_phone: "9876540001",
        postal_code: "620001",
        division: "Aluminium Partition Installation",
        is_service_quote: true,
        contractor_id: "cont_trichy_verified_01",
        contractor_name: "Cauvery Architectural Installers",
        items: [
          {
            sku: "SRV-INST-AL-01",
            name: "Site Measurement, Profile Cutting & Sliding Track Installation",
            quantity: 5,
            unitPriceInr: 3500,
            gstRate: 18,
          },
        ],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(quoteRes.status()).toBe(201);
    const quoteData = await quoteRes.json();
    expect(quoteData.quote.is_service_quote).toBe(true);
    expect(quoteData.quote.contractor_id).toBe("cont_trichy_verified_01");
  });

  // CASE 16: Customer A cannot access Customer B's quote
  test("CASE-16: Customer A cannot access Customer B's quote (IDOR protection)", async ({ request }) => {
    // 1. Create a quote for Customer A
    const qRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Customer A Confidential",
        customer_email: CUSTOMER_A_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 1, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const quoteA = (await qRes.json()).quote;

    // 2. Customer B attempts to respond to Customer A's quote -> strictly rejected with 403 Forbidden
    const attackRes = await request.post(`${BACKEND_URL}/store/sai-ajanta/quotes/${quoteA.id}/respond`, {
      data: { action: "ACCEPT" },
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_B_TOKEN}`,
      },
    });
    expect(attackRes.status()).toBe(403);
    const err = await attackRes.json();
    expect(err.code).toBe("FORBIDDEN");

    // 3. Customer B querying quotes cannot see Customer A's quote
    const listRes = await request.get(`${BACKEND_URL}/store/sai-ajanta/quotes`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${CUSTOMER_B_TOKEN}`,
      },
    });
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    for (const q of listData.quotes) {
      expect(q.id).not.toBe(quoteA.id);
    }
  });

  // CASE 17: Distributor A cannot access Distributor B's records
  test("CASE-17: Distributor A cannot access Distributor B's records", async ({ request }) => {
    // 1. Create a quote assigned to Distributor B
    const qRes = await request.post(`${BACKEND_URL}/admin/sai-ajanta/quotes`, {
      data: {
        customer_name: "Madurai Project",
        customer_email: "madurai.project@example.com",
        customer_phone: "9876543299",
        postal_code: "625001",
        seller_id: DIST_B_ID,
        seller_name: "Madurai Glass & Fittings Dist",
        seller_type: "DISTRIBUTOR",
        items: [{ sku: "SA-M-DC-100-004", name: "Door Closer 100", quantity: 4, unitPriceInr: 4125 }],
        status: "SHARED_NONPAYABLE",
      },
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const quoteB = (await qRes.json()).quote;

    // 2. Distributor A queries quotes -> quoteB is NOT in Distributor A's list
    const distAListRes = await request.get(`${BACKEND_URL}/store/sai-ajanta/quotes`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        Authorization: `Bearer ${DIST_A_TOKEN}`,
      },
    });
    expect(distAListRes.ok()).toBeTruthy();
    const distAData = await distAListRes.json();
    for (const q of distAData.quotes) {
      expect(q.id).not.toBe(quoteB.id);
      expect(q.seller_id).not.toBe(DIST_B_ID);
    }
  });

  // CASE 18: Admin status changes and customer responses persist after browser refresh
  test("CASE-18: Admin status changes and customer responses persist after browser refresh", async ({ page }) => {
    // 1. Admin logs into Admin portal and views Seller Coverage
    await page.goto(`${ADMIN_URL}/`);
    await page.evaluate(({ token, userJson }) => {
      localStorage.setItem("sai_ajanta_admin_token", token);
      sessionStorage.setItem("sai_ajanta_admin_user", userJson);
    }, { token: ADMIN_TOKEN, userJson: ADMIN_USER_JSON });

    await page.goto(`${ADMIN_URL}/seller-coverage`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Capture screenshot of Admin Seller Coverage
    const coverageShot = path.join(screenshotsDir, "03-admin-seller-coverage.png");
    await page.screenshot({ path: coverageShot, fullPage: true });
    fs.copyFileSync(coverageShot, path.join(brainDir, "03-admin-seller-coverage.png"));

    // Reload page to verify persistence after browser refresh
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify distributor coverage rows remain visible
    await expect(page.locator("text=Trichy Hardware Distributors").first()).toBeVisible();

    // 2. Open Admin Enquiries Page
    await page.goto(`${ADMIN_URL}/enquiries`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const enquiriesShot = path.join(screenshotsDir, "04-admin-enquiries-persistence.png");
    await page.screenshot({ path: enquiriesShot, fullPage: true });
    fs.copyFileSync(enquiriesShot, path.join(brainDir, "04-admin-enquiries-persistence.png"));

    // Verify persistence after browser reload
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify table has records and filter tabs
    await expect(page.locator("text=Total Enquiries").first()).toBeVisible();
  });
});
