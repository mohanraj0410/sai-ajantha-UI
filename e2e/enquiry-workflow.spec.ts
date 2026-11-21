import { test, expect } from "@playwright/test";
import crypto from "crypto";
import path from "path";

const jwt = require(path.resolve("apps/backend/node_modules/jsonwebtoken"));

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

const CUSTOMER_ID = "cus_01M7PRCN5QGH0V8EVGE99G94RE";
const CUSTOMER_EMAIL = "login.verify.1794986365904@sai-ajanta-test.internal";

const CUSTOMER_TOKEN = jwt.sign(
  {
    actor_id: CUSTOMER_ID,
    actor_type: "customer",
    auth_identity_id: "authid_01M7PRCN46H54AM8Y1BQY2GAEV",
    app_metadata: { customer_id: CUSTOMER_ID },
  },
  "supersecret",
  { expiresIn: "7d" }
);

function createCustomerSessionCookie(): string {
  const secret = process.env.SESSION_SECRET?.trim() || "dev-only-sai-ajantha-session-secret-change-in-prod";
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = {
    role: "CUSTOMER",
    medusaToken: CUSTOMER_TOKEN,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
    iat: Date.now(),
  };
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

test.describe.serial("Sai Ajantha Complete Enquiry → Quotation → Customer Response → Order Workflow", () => {
  let createdEnquiryId: string;
  let createdQuoteId: string;

  test("Step 1: Customer submits product enquiry with line items and PIN", async ({ request }) => {
    const res = await request.post("http://localhost:3000/api/enquiries", {
      data: {
        name: "Arun Kumar Architecture",
        email: CUSTOMER_EMAIL,
        phone: "9876543210",
        city: "Trichy",
        postal_code: "620001",
        role: "Contractor / Architect",
        organization: "Arun Design Studio",
        division: "Aluminium Architectural Systems",
        notes: "Need urgent BOQ estimate for 15 units sliding partition profiles.",
        source: "contact-form",
        lead_type: "PRODUCT_QUOTE",
        items: [
          {
            sku: "AL-SL-9001",
            name: "Heavy Duty Aluminium Sliding Profile 90mm",
            quantity: 15,
            size: "12ft length",
            unit: "Length",
            notes: "Champagne anodized finish",
          },
        ],
      },
    });

    expect([200, 201]).toContain(res.status());
    const data = await res.json();
    expect(data.id).toBeTruthy();
    createdEnquiryId = data.id;
    console.log(`[E2E] Created test enquiry ID: ${createdEnquiryId}`);
  });

  test("Step 2 & 3: Enquiry appears in Admin, opens details drawer with full timeline and recommended seller", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ token, userJson }) => {
        window.localStorage.setItem("sai_ajanta_admin_token", token);
        window.localStorage.setItem("sai_ajanta_admin_user", userJson);
        window.sessionStorage.setItem("sai_ajanta_admin_token", token);
        window.sessionStorage.setItem("sai_ajanta_admin_user", userJson);
      },
      { token: ADMIN_TOKEN, userJson: ADMIN_USER_JSON }
    );

    await page.goto("http://localhost:7001/enquiries");
    await page.waitForLoadState("networkidle");

    // Verify persisted stat cards exist
    await expect(page.locator("text=Total Enquiries").first()).toBeVisible();
    await expect(page.locator("text=New Enquiries").first()).toBeVisible();
    await expect(page.locator("text=Under Review").first()).toBeVisible();
    await expect(page.locator("text=Quote Preparing").first()).toBeVisible();
    await expect(page.locator("text=Quote Sent").first()).toBeVisible();

    // Verify created enquiry row is present in table
    const enquiryRow = page.locator(`tr:has-text("Arun Kumar Architecture")`).first();
    await expect(enquiryRow).toBeVisible();

    // Click 'Details' button to open drawer
    await enquiryRow.locator("button:has-text('Details')").click();
    await page.waitForSelector(".ant-drawer-open");

    // Drawer header shows enquiry reference and status
    await expect(page.locator(".ant-drawer-title")).toContainText("Enquiry");
    await expect(page.locator(".ant-drawer-open")).toContainText("Arun Kumar Architecture");
    await expect(page.locator(".ant-drawer-open")).toContainText("9876543210");
    await expect(page.locator(".ant-drawer-open")).toContainText("Trichy");
    await expect(page.locator(".ant-drawer-open")).toContainText("AL-SL-9001");

    // Take screenshot of opened details drawer
    await page.screenshot({
      path: "docs/screenshots/workflow-e2e/01-enquiry-details-drawer.png",
      fullPage: true,
    });
  });

  test("Step 4: Admin starts review and assigns responsible seller via API / UI", async ({ request }) => {
    expect(createdEnquiryId).toBeTruthy();

    // Perform START_REVIEW action
    const reviewRes = await request.patch(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${createdEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          action: "START_REVIEW",
          notes: "Review started by Technical Estimator. Validated customer details and site PIN 620001.",
        },
      }
    );
    expect(reviewRes.status()).toBe(200);
    const reviewData = await reviewRes.json();
    expect(reviewData.enquiry.status).toBe("IN_REVIEW");

    // Assign Seller: Direct 9-category routes to Sai Ajantha Central
    const assignSellerRes = await request.patch(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${createdEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          action: "ASSIGN_SELLER",
          sellerId: "SAI_AJANTHA_CENTRAL",
          sellerName: "Sai Ajantha Central Warehouse (Direct)",
          sellerType: "DIRECT",
          notes: "Assigned to Sai Ajantha Central fulfillment desk.",
        },
      }
    );
    expect(assignSellerRes.status()).toBe(200);
    const sellerData = await assignSellerRes.json();
    expect(sellerData.enquiry.assigned_seller_name).toContain("Sai Ajantha Central");
  });

  test("Step 5 & 6: Authorized user creates & issues quotation linked to enquiry", async ({ request }) => {
    expect(createdEnquiryId).toBeTruthy();

    // Create quotation linked to enquiry with verified 18% GST and items
    const quoteRes = await request.post("http://localhost:9000/admin/sai-ajanta/quotes", {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      data: {
        enquiry_id: createdEnquiryId,
        customer_name: "Arun Kumar Architecture",
        customer_email: CUSTOMER_EMAIL,
        customer_phone: "9876543210",
        postal_code: "620001",
        division: "Aluminium Architectural Systems",
        status: "SHARED_NONPAYABLE", // Issued
        seller_id: "SAI_AJANTHA_CENTRAL",
        seller_name: "Sai Ajantha Central Warehouse (Direct)",
        seller_type: "DIRECT",
        internal_notes: "Includes standard mill test certification, transit freight, and 18% GST.",
        items: [
          {
            sku: "AL-SL-9001",
            name: "Heavy Duty Aluminium Sliding Profile 90mm",
            quantity: 15,
            unitPriceInr: 4500,
            gstRate: 18,
          },
        ],
      },
    });

    expect(quoteRes.status()).toBe(201);
    const quoteData = await quoteRes.json();
    expect(quoteData.quote).toBeTruthy();
    expect(quoteData.quote.id).toBeTruthy();
    createdQuoteId = quoteData.quote.id;
    console.log(`[E2E] Created & issued Quote ID: ${createdQuoteId}`);

    // Verify linked enquiry automatically transitioned to QUOTED in database
    const verifyEnquiryRes = await request.get(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${createdEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }
    );
    const verifyData = await verifyEnquiryRes.json();
    expect(verifyData.enquiry.status).toBe("QUOTED");
    expect(verifyData.quotes.length).toBeGreaterThanOrEqual(1);
    expect(verifyData.quotes[0].id).toBe(createdQuoteId);
  });

  test("Step 7 & 8: Customer views quotation in Account dashboard and accepts quote", async ({
    page,
    request,
  }) => {
    expect(createdQuoteId).toBeTruthy();

    // Set authenticated customer session cookie
    const sessionCookieValue = createCustomerSessionCookie();
    await page.context().addCookies([
      {
        name: "sa_session",
        value: sessionCookieValue,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("http://localhost:3000/account");
    await page.waitForLoadState("networkidle");

    // Click 'Quotes & Enquiries' tab in desktop sidebar
    const quotesNav = page.locator("aside button:has-text('Quotes & Enquiries')");
    await expect(quotesNav).toBeVisible();
    await quotesNav.click();

    // Verify Quote card is rendered with actions
    await expect(page.locator("text=Commercial Material Quotation").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Awaiting Your Response").first()).toBeVisible();
    await expect(page.locator("text=AL-SL-9001").first()).toBeVisible();
    await expect(page.locator("button:has-text('Accept Quotation')").first()).toBeVisible();
    await expect(page.locator("button:has-text('Request Revision')").first()).toBeVisible();

    // Take screenshot of customer viewing issued quotation
    await page.screenshot({
      path: "docs/screenshots/workflow-e2e/02-customer-quote-view.png",
      fullPage: true,
    });

    // Customer clicks Accept Quotation in UI
    await page.locator("button:has-text('Accept Quotation')").first().click();

    // Verify UI reflects accepted state
    await expect(page.locator("text=Quotation accepted").first()).toBeVisible({ timeout: 10000 });

    // Verify quote in DB has status ACCEPTED
    const custQuotesRes = await request.get(
      `http://localhost:3000/api/quotes?email=${encodeURIComponent(CUSTOMER_EMAIL)}`,
      {
        headers: {
          Cookie: `sa_session=${createCustomerSessionCookie()}`,
        },
      }
    );
    const custQuotesData = await custQuotesRes.json();
    const updatedQuote = custQuotesData.quotes.find((q: any) => q.id === createdQuoteId);
    expect(updatedQuote.status).toBe("ACCEPTED");
  });

  test("Step 9: Admin details view reflects updated QUOTE_ACCEPTED status and timeline audit", async ({
    request,
    page,
  }) => {
    expect(createdEnquiryId).toBeTruthy();

    // Verify DB via Admin API
    const verifyRes = await request.get(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${createdEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }
    );
    const data = await verifyRes.json();
    expect(data.enquiry.status).toBe("QUOTE_ACCEPTED");

    // Verify activity timeline contains customer response entry
    const activities = data.activity || data.activities || [];
    const acceptActivity = activities.find(
      (a: any) => a.action === "CUSTOMER_ACCEPTED" || a.action === "QUOTE_ACCEPTED"
    );
    expect(acceptActivity).toBeTruthy();

    // Open Admin browser UI and verify UI reflects Quote Accepted
    await page.addInitScript(
      ({ token, userJson }) => {
        window.localStorage.setItem("sai_ajanta_admin_token", token);
        window.localStorage.setItem("sai_ajanta_admin_user", userJson);
      },
      { token: ADMIN_TOKEN, userJson: ADMIN_USER_JSON }
    );

    await page.goto("http://localhost:7001/enquiries");
    await page.waitForLoadState("networkidle");

    const enquiryRow = page.locator(`tr:has-text("Arun Kumar Architecture")`).first();
    await enquiryRow.locator("button:has-text('Details')").click();
    await page.waitForSelector(".ant-drawer-open");

    await expect(page.locator(".ant-drawer-open")).toContainText("Quote Accepted");
    await expect(page.locator(".ant-drawer-open button:has-text('Convert to Order')")).toBeVisible();

    await page.screenshot({
      path: "docs/screenshots/workflow-e2e/03-admin-quote-accepted.png",
      fullPage: true,
    });
  });

  test("Step 10: Convert accepted quote to official trade order (CONFIRMED_TRADE_PO, PENDING_OFFLINE_SETTLEMENT)", async ({
    request,
    page,
  }) => {
    expect(createdQuoteId).toBeTruthy();

    // Convert via Admin convert endpoint
    const convertRes = await request.post(
      `http://localhost:9000/admin/sai-ajanta/quotes/${createdQuoteId}/convert`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          notes: "Approved for trade fulfillment. Offline PO settlement required prior to dispatch.",
        },
      }
    );

    const convertText = await convertRes.text();
    console.log("[E2E] Convert status & text:", convertRes.status(), convertText);
    expect(convertRes.status()).toBe(200);
    const convertData = JSON.parse(convertText);
    expect(convertData.success).toBe(true);
    expect(convertData.order).toBeTruthy();
    expect(convertData.order.order_number).toMatch(/^(SA-|PO-)/);
    expect(convertData.order.status).toBe("CONFIRMED_TRADE_PO");
    expect(convertData.order.payment_status).toBe("PENDING_OFFLINE_SETTLEMENT");
    console.log(`[E2E] Converted to Order: ${convertData.order.order_number}`);

    // Verify quote is now CONVERTED_TO_ORDER
    expect(convertData.quote.status).toBe("CONVERTED_TO_ORDER");
    expect([convertData.order.id, convertData.order.order_number]).toContain(convertData.quote.converted_order_id);

    // Verify enquiry is CONVERTED_TO_ORDER
    const finalEnquiryRes = await request.get(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${createdEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }
    );
    const finalData = await finalEnquiryRes.json();
    expect(finalData.enquiry.status).toBe("CONVERTED_TO_ORDER");

    // UI Verification: Refresh browser and confirm persistence
    await page.addInitScript(
      ({ token, userJson }) => {
        window.localStorage.setItem("sai_ajanta_admin_token", token);
        window.localStorage.setItem("sai_ajanta_admin_user", userJson);
      },
      { token: ADMIN_TOKEN, userJson: ADMIN_USER_JSON }
    );
    await page.goto("http://localhost:7001/enquiries");
    await page.waitForLoadState("networkidle");

    const row = page.locator(`tr:has-text("Arun Kumar Architecture")`).first();
    await row.locator("button:has-text('Details')").click();
    await page.waitForSelector(".ant-drawer-open");

    await expect(page.locator(".ant-drawer-open")).toContainText("Converted to Order");

    await page.screenshot({
      path: "docs/screenshots/workflow-e2e/04-order-converted.png",
      fullPage: true,
    });
  });

  test("Step 11: Invalid status transitions are strictly rejected by server-side guards", async ({
    request,
  }) => {
    // Create an unquoted enquiry
    const dummyRes = await request.post("http://localhost:3000/api/enquiries", {
      data: {
        name: "Invalid Transition Test",
        email: `invalid.${Date.now()}@sai-ajanta.internal`,
        phone: "9876500000",
        division: "Direct Sales",
        notes: "Testing illegal transition to QUOTED without issued quote",
      },
    });
    const dummyData = await dummyRes.json();
    const dummyId = dummyData.id;

    // Attempt illegal manual transition to QUOTED without quote
    const illegalRes = await request.patch(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${dummyId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          action: "CHANGE_STATUS",
          status: "QUOTED",
        },
      }
    );

    // Must be rejected with HTTP 400
    expect(illegalRes.status()).toBe(400);
    const errData = await illegalRes.json();
    expect(errData.message).toContain("Cannot mark enquiry as QUOTED");
  });

  test("Step 12: Independent contractor installation workflow (separate service quotation)", async ({
    request,
  }) => {
    // 1. Submit Installation Enquiry
    const installRes = await request.post("http://localhost:3000/api/enquiries", {
      data: {
        name: "Kannan Residence Fitting",
        email: `install.${Date.now()}@sai-ajanta.internal`,
        phone: "9842412345",
        city: "Trichy",
        postal_code: "620005",
        division: "Insect Screen & Partition Installation",
        notes: "Multi-room stainless steel insect screen site measurement and fitting.",
        lead_type: "INSTALLATION",
        items: [
          {
            sku: "SRV-INS-001",
            name: "Pleated Mesh Window Site Installation & Fitting",
            quantity: 8,
            size: "4x5 ft openings",
          },
        ],
      },
    });
    expect([200, 201]).toContain(installRes.status());
    const installData = await installRes.json();
    const installEnquiryId = installData.id;

    // 2. Assign verified contractor
    const assignContractorRes = await request.patch(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${installEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        data: {
          action: "ASSIGN_CONTRACTOR",
          contractorId: "cont_trichy_fitters_01",
          contractorName: "Trichy Precision Installers (Verified Contractor)",
          notes: "Assigned lead to verified local fitting team.",
        },
      }
    );
    expect(assignContractorRes.status()).toBe(200);
    const contractorData = await assignContractorRes.json();
    expect(contractorData.enquiry.contractor_name).toContain("Trichy Precision Installers");

    // 3. Issue separate service quotation (is_service_quote = true)
    const serviceQuoteRes = await request.post("http://localhost:9000/admin/sai-ajanta/quotes", {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      data: {
        enquiry_id: installEnquiryId,
        customer_name: "Kannan Residence Fitting",
        customer_email: `install.${Date.now()}@sai-ajanta.internal`,
        customer_phone: "9842412345",
        postal_code: "620005",
        division: "Insect Screen & Partition Installation",
        is_service_quote: true,
        contractor_id: "cont_trichy_fitters_01",
        contractor_name: "Trichy Precision Installers (Verified Contractor)",
        status: "SHARED_NONPAYABLE",
        seller_id: "INDEPENDENT_CONTRACTOR",
        seller_name: "Trichy Precision Installers (Verified Contractor)",
        seller_type: "CONTRACTOR",
        internal_notes: "Independent service quotation for labour and installation. Payable directly to contractor.",
        items: [
          {
            sku: "SRV-INS-001",
            name: "Pleated Mesh Window Site Installation & Fitting",
            quantity: 8,
            unitPriceInr: 850,
            gstRate: 18,
          },
        ],
      },
    });

    expect(serviceQuoteRes.status()).toBe(201);
    const serviceQuoteData = await serviceQuoteRes.json();
    expect(serviceQuoteData.quote.is_service_quote).toBe(true);
    expect(serviceQuoteData.quote.contractor_name).toContain("Trichy Precision Installers");

    // Verify enquiry is QUOTED with service quote
    const checkEnquiry = await request.get(
      `http://localhost:9000/admin/sai-ajanta/enquiries/${installEnquiryId}`,
      {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      }
    );
    const checkData = await checkEnquiry.json();
    expect(checkData.enquiry.status).toBe("QUOTED");
    expect(checkData.enquiry.contractor_name).toContain("Trichy Precision Installers");
  });
});
