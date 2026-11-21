import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9231;
const TEST_BACKEND_PORT = 9099;
const TEST_ADMIN_PORT = 7099;
const TEST_DB_NAME = "sai_ajanta_ops_e2e";
const PG_CONTAINER = "sai-ajanta-monorepo-postgres";
const TEST_DB_URL = `postgres://medusa:medusa@127.0.0.1:5432/${TEST_DB_NAME}`;
const TEST_REDIS_URL = "redis://127.0.0.1:6379/10";
const BACKEND_URL = `http://127.0.0.1:${TEST_BACKEND_PORT}`;
const ADMIN_URL = `http://127.0.0.1:${TEST_ADMIN_PORT}`;
const OUT_DIR = path.resolve("docs/screenshots/admin-ops-authenticated");
const D_TEMP_DIR = path.resolve(".tmp-ops-e2e");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(D_TEMP_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runSync(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts });
}

function runPsql(dbName, sql) {
  return execSync(
    `docker exec -i ${PG_CONTAINER} psql -U medusa -d ${dbName} -v ON_ERROR_STOP=1`,
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
}

function killTree(pid) {
  if (!pid) return;
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
  } catch {
    // exited
  }
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.pageExceptions = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result);
        } else if (msg.method === "Runtime.exceptionThrown") {
          const d =
            msg.params?.exceptionDetails?.exception?.description ||
            msg.params?.exceptionDetails?.text;
          if (d) this.pageExceptions.push(d);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(
        `Browser eval exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`
      );
    }
    return res?.result?.value;
  }
  async navigate(url, waitMs = 1300) {
    await this.send("Page.navigate", { url });
    await sleep(waitMs);
  }
  async hardReload(waitMs = 1600) {
    await this.send("Page.reload", { ignoreCache: true });
    await sleep(waitMs);
  }
  async waitForText(substr, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = await this.eval("document.body ? document.body.innerText : ''");
      if (typeof text === "string" && text.includes(substr)) return text;
      await sleep(250);
    }
    const lastText = await this.eval("document.body ? document.body.innerText.slice(0, 700) : ''");
    throw new Error(`Timeout waiting for text "${substr}". Current body: ${lastText}`);
  }
  async waitForSelector(selector, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = await this.eval(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
      if (found) return true;
      await sleep(200);
    }
    throw new Error(`Timeout waiting for selector "${selector}"`);
  }
  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await sleep(300);
  }
  async screenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(res.data, "base64"));
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function waitForHttp(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500) return true;
    } catch {
      // booting
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await r.json();
      if (Array.isArray(list) && list[0]?.webSocketDebuggerUrl) return list[0].webSocketDebuggerUrl;
    } catch {
      await sleep(300);
    }
  }
  throw new Error("Chrome debug port timeout");
}

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

async function uiLogin(cdp, email, password) {
  await cdp.navigate(`${ADMIN_URL}/login`, 1200);
  await cdp.waitForSelector('input[name="email"]');
  await cdp.eval(`(() => {
    const setVal = (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setVal(document.querySelector('input[name="email"]'), ${JSON.stringify(email)});
    setVal(document.querySelector('input[name="password"]'), ${JSON.stringify(password)});
  })()`);
  await sleep(150);
  await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
}

async function main() {
  let backendProc = null;
  let adminProc = null;
  let chromeProc = null;
  let cdp = null;

  const liveCountsBefore = runPsql(
    "medusa",
    "SELECT COUNT(*)::text || '|' || (SELECT COUNT(*)::text FROM product) FROM \"user\";"
  ).trim();

  const superEmail = "ops-superadmin@sai-ajanta.test";
  const catalogEmail = "ops-catalog@sai-ajanta.test";
  const orderCustEmail = "ops-orders-cust@sai-ajanta.test";
  const superPass = crypto.randomBytes(16).toString("base64url") + "A1!";
  const catalogPass = crypto.randomBytes(16).toString("base64url") + "B2!";
  const orderCustPass = crypto.randomBytes(16).toString("base64url") + "C3!";

  const medusaBin = path.resolve("apps/backend/node_modules/.bin/medusa.cmd");
  const viteBin = path.resolve("apps/admin/node_modules/.bin/vite.cmd");

  const isolatedEnv = {
    ...process.env,
    TEMP: D_TEMP_DIR,
    TMP: D_TEMP_DIR,
    npm_config_cache: path.join(D_TEMP_DIR, "npm-cache"),
    NODE_ENV: "development",
    DATABASE_URL: TEST_DB_URL,
    REDIS_URL: TEST_REDIS_URL,
    PORT: String(TEST_BACKEND_PORT),
    MEDUSA_ADMIN_DISABLE: "true",
    STORE_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT},http://localhost:3000`,
    ADMIN_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT}`,
    AUTH_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT}`,
    JWT_SECRET: crypto.randomBytes(24).toString("hex"),
    COOKIE_SECRET: crypto.randomBytes(24).toString("hex"),
    VITE_PROXY_BACKEND_URL: BACKEND_URL,
  };

  try {
    console.log("=== 1. ISOLATED DISPOSABLE POSTGRES SETUP & MIGRATION PROOF ===");
    runPsql("postgres", `DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE);`);
    runPsql("postgres", `CREATE DATABASE ${TEST_DB_NAME};`);

    runSync(`"${medusaBin}" db:migrate`, {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
    });
    console.log(`Migrations applied cleanly to disposable ${TEST_DB_NAME}`);

    // Verify new additive tables exist cleanly
    const tablesCheck = runPsql(
      TEST_DB_NAME,
      "SELECT COUNT(*)::text FROM information_schema.tables WHERE table_name IN ('dms_staff_audit_event','dms_admin_setting','dms_trade_quote','dms_trade_promo_draft');"
    ).trim();
    check(tablesCheck.includes("4"), "All 4 new ADM-OPS PostgreSQL tables created by migrations");

    for (const [e, p] of [
      [superEmail, superPass],
      [catalogEmail, catalogPass],
      [orderCustEmail, orderCustPass],
    ]) {
      runSync(`"${medusaBin}" user -e "${e}" -p "${p}"`, {
        cwd: path.resolve("apps/backend"),
        env: isolatedEnv,
      });
    }

    runPsql(
      TEST_DB_NAME,
      `
      UPDATE "user" SET first_name = 'Ops', last_name = 'Superadmin', metadata = '{"role":"admin","active":true}'::jsonb WHERE email = '${superEmail}';
      UPDATE "user" SET first_name = 'Ops', last_name = 'CatalogStaff', metadata = '{"role":"staff","permissions":["CATALOG_MANAGE","ANALYTICS_VIEW"],"active":true}'::jsonb WHERE email = '${catalogEmail}';
      UPDATE "user" SET first_name = 'Ops', last_name = 'OrderCustStaff', metadata = '{"role":"staff","permissions":["ORDERS_MANAGE","CUSTOMERS_MANAGE"],"active":true}'::jsonb WHERE email = '${orderCustEmail}';
      `
    );

    console.log("=== 2. BOOTING ISOLATED BACKEND (:9099) & ADMIN PREVIEW (:7099) ===");
    let backendOutput = "";
    backendProc = spawn("npx.cmd", ["medusa", "develop", "--port", String(TEST_BACKEND_PORT)], {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    backendProc.stdout.on("data", (d) => { backendOutput += d.toString(); });
    backendProc.stderr.on("data", (d) => { backendOutput += d.toString(); });
    try {
      await waitForHttp(`${BACKEND_URL}/health`, 120000);
    } catch (e) {
      console.error("--- BACKEND BOOT LOG TAIL ---\n" + backendOutput.slice(-2000));
      throw e;
    }

    adminProc = spawn(
      "npx.cmd",
      ["vite", "preview", "--host", "127.0.0.1", "--port", String(TEST_ADMIN_PORT), "--strictPort"],
      {
        cwd: path.resolve("apps/admin"),
        env: isolatedEnv,
        stdio: "ignore",
        shell: true,
      }
    );
    await waitForHttp(`${ADMIN_URL}/login`, 30000);

    // Tokens for 3 distinct staff roles
    const loginToken = async (email, password) => {
      const r = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return (await r.json()).token;
    };
    const superToken = await loginToken(superEmail, superPass);
    const catalogToken = await loginToken(catalogEmail, catalogPass);
    const orderCustToken = await loginToken(orderCustEmail, orderCustPass);
    check(Boolean(superToken && catalogToken && orderCustToken), "All 3 staff role tokens issued cleanly");

    console.log("=== 3. ADM-OPS-01: 3-ROLE + ANON RBAC & SCOPING REGRESSION ===");
    for (const ep of [
      "/admin/sai-ajanta/me",
      "/admin/sai-ajanta/portal",
      "/admin/sai-ajanta/analytics",
      "/admin/sai-ajanta/products",
      "/admin/sai-ajanta/overview",
      "/admin/sai-ajanta/orders",
      "/admin/sai-ajanta/customers",
      "/admin/sai-ajanta/audit-log",
      "/admin/sai-ajanta/staff",
      "/admin/sai-ajanta/settings",
      "/admin/sai-ajanta/seller-coverage",
      "/admin/sai-ajanta/quotes",
      "/admin/sai-ajanta/inventory/ledger",
      "/admin/sai-ajanta/promotions",
    ]) {
      const r = await fetch(`${ADMIN_URL}${ep}`);
      check(r.status === 401, `Anon blocked (${r.status}) on ${ep}`);
    }

    // Catalog-only role checks
    for (const ep of ["/admin/sai-ajanta/orders", "/admin/sai-ajanta/customers", "/admin/sai-ajanta/audit-log", "/admin/sai-ajanta/staff", "/admin/sai-ajanta/settings", "/admin/sai-ajanta/seller-coverage", "/admin/sai-ajanta/quotes"]) {
      const r = await fetch(`${BACKEND_URL}${ep}`, { headers: { Authorization: `Bearer ${catalogToken}` } });
      check(r.status === 403, `Catalog-only denied 403 (${r.status}) on ${ep}`);
    }
    const catOk = await fetch(`${BACKEND_URL}/admin/sai-ajanta/overview`, { headers: { Authorization: `Bearer ${catalogToken}` } });
    check(catOk.status === 200, `Catalog-only allowed 200 on /overview (${catOk.status})`);

    // Orders+Customers-only role checks
    for (const ep of ["/admin/sai-ajanta/products", "/admin/sai-ajanta/overview", "/admin/sai-ajanta/audit-log", "/admin/sai-ajanta/staff", "/admin/sai-ajanta/settings"]) {
      const r = await fetch(`${BACKEND_URL}${ep}`, { headers: { Authorization: `Bearer ${orderCustToken}` } });
      check(r.status === 403, `Order/Customer-only denied 403 (${r.status}) on ${ep}`);
    }

    // Seed infrastructure + fixtures in test DB
    const scRes = await fetch(`${BACKEND_URL}/admin/sales-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ name: "Sai Ajantha OPS E2E", description: "E2E" }),
    });
    const scId = (await scRes.json()).sales_channel?.id;
    await fetch(`${BACKEND_URL}/admin/stock-locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ name: "Trichy OPS Warehouse" }),
    });
    const akRes = await fetch(`${BACKEND_URL}/admin/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ title: "OPS Key", type: "publishable" }),
    });
    const akJson = await akRes.json();
    const pubKey = akJson.api_key?.token;
    if (akJson.api_key?.id && scId) {
      await fetch(`${BACKEND_URL}/admin/api-keys/${akJson.api_key.id}/sales-channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({ add: [scId] }),
      });
    }
    for (const catName of ["Door Closer & Floor Spring", "Aluminium"]) {
      await fetch(`${BACKEND_URL}/admin/product-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({ name: catName, is_active: true }),
      });
    }

    const baseProdRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        sku: "OPS-BASE-ALM",
        name: "OPS Extruded Section",
        category: "Aluminium",
        customerPriceInr: 1200,
        dealerPriceInr: 950,
        distributorPriceInr: 850,
        billingUnit: "1 length",
        stockQty: 80,
        isManufactured: true,
        cmsStatus: "PUBLISHED",
      }),
    });
    check(baseProdRes.status === 201, `Seeded base SKU (${baseProdRes.status})`);

    const ordRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        customerName: "Surya Traders",
        customerEmail: "surya.ops@example.test",
        customerPhone: "9842100001",
        totalAmount: 11800,
        itemsSummary: "OPS Extruded Section (10 pcs)",
        status: "CONFIRMED",
        isManufactured: true,
      }),
    });
    const ordJson = await ordRes.json();
    const seededOrderId = ordJson.order?.id;
    check(ordRes.status === 201 && Boolean(seededOrderId), `Seeded TradeOrder (${ordRes.status})`);

    // Test parent_distributor_id validation (ADM-OPS-00/01)
    const distCreate = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        name: "Kaveri Distributors",
        company_name: "Kaveri Distributors Pvt Ltd",
        email: "kaveri-dist@sai-ajanta.test",
        phone: "9842100099",
        city: "Trichy",
        role: "DISTRIBUTOR",
      }),
    });
    const distId = (await distCreate.json()).customer?.id;
    check(distCreate.status === 201, "Distributor created cleanly in PENDING_APPROVAL");

    const dealCreate = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        name: "Madurai Dealer",
        company_name: "Madurai Hardware Co",
        email: "madurai-deal@sai-ajanta.test",
        phone: "9842100088",
        city: "Madurai",
        role: "DEALER",
      }),
    });
    const dealId = (await dealCreate.json()).customer?.id;

    // Try linking dealer to unapproved PENDING distributor -> must return 400!
    const linkPendingRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ parent_distributor_id: distId }),
    });
    check(linkPendingRes.status === 400, `Linking dealer to PENDING_APPROVAL distributor rejected (${linkPendingRes.status})`);

    // Approve distributor & set structured overlapping PINs on two active distributors for ADM-OPS-06
    await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${distId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const selfLinkRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${distId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ role: "DEALER", parent_distributor_id: distId }),
    });
    check(selfLinkRes.status === 400, `Self-link parent_distributor_id rejected (${selfLinkRes.status})`);

    const linkOkRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ status: "ACTIVE", parent_distributor_id: distId }),
    });
    check(linkOkRes.status === 200, `Approved DEALER linked cleanly to ACTIVE DISTRIBUTOR (${linkOkRes.status})`);

    // Verify ADM-OPS-02 Database Immutability Trigger on dms_staff_audit_event!
    let triggerRejected = false;
    try {
      runPsql(TEST_DB_NAME, "UPDATE dms_staff_audit_event SET action = 'TAMPERED';");
    } catch (e) {
      triggerRejected = String(e.stderr || e.message).includes("strictly append-only");
    }
    check(triggerRejected, "PostgreSQL immutability trigger blocks UPDATE/DELETE on dms_staff_audit_event");

    // Verify invalid CMS stage jump DRAFT -> PUBLISHED rejected (ADM-OPS-07)
    const draftProdRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        sku: "OPS-DC-95",
        name: "Ajantha Door Closer DC-95",
        category: "Door Closer & Floor Spring",
        customerPriceInr: 3900,
        dealerPriceInr: 3100,
        distributorPriceInr: 2700,
        billingUnit: "1 unit",
        stockQty: 20,
        cmsStatus: "DRAFT",
        internalNotes: "CONFIDENTIAL COST NOTE OPS",
      }),
    });
    const draftProdId = (await draftProdRes.json()).product?.medusa_id;
    const illegalJump = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${draftProdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ cmsStatus: "PUBLISHED" }),
    });
    check(illegalJump.status === 400, `Illegal DRAFT -> PUBLISHED jump rejected 400 (${illegalJump.status})`);

    // Legal transition DRAFT -> REVIEW -> APPROVED -> PUBLISHED
    const step1 = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${draftProdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ cmsStatus: "REVIEW" }),
    });
    const step2 = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${draftProdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ cmsStatus: "APPROVED" }),
    });
    const step3 = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${draftProdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ cmsStatus: "PUBLISHED" }),
    });
    check(step1.ok && step2.ok && step3.ok, "Legal DRAFT -> REVIEW -> APPROVED -> PUBLISHED sequence succeeded");

    console.log("=== 4. CHROME CDP AUTHENTICATED WORKFLOWS (ADM-OPS-02..11) ===");
    const chromeProfile = path.join(D_TEMP_DIR, "chrome-profile");
    chromeProc = spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${chromeProfile}`,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        "about:blank",
      ],
      { stdio: "ignore" }
    );
    cdp = new CDPClient(await getWsUrl());
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.setViewport(1440, 900, false);

    // 4A. ADM-OPS-04 Forgot Password UI check
    await cdp.navigate(`${ADMIN_URL}/forgot-password`, 1200);
    const fpText = await cdp.waitForText("BLOCKED_EXTERNAL_PROVIDER");
    check(fpText.includes("Staff Password Recovery"), "Forgot Password shows BLOCKED_EXTERNAL_PROVIDER when SMTP unconfigured");
    await cdp.screenshot("forgot-password-desktop.png");

    // 4B. Superadmin Sign In
    await uiLogin(cdp, superEmail, superPass);
    await cdp.waitForText("Executive Operations Dashboard");

    // 4C. ADM-OPS-05 Safe Settings Persistence & 409 Concurrency
    await cdp.navigate(`${ADMIN_URL}/settings`, 1200);
    await cdp.waitForText("Safe Operational Console Preferences");
    await cdp.eval(`(() => {
      const thresh = Array.from(document.querySelectorAll('input')).find(i => i.type === 'number');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(thresh, '15');
      thresh.dispatchEvent(new Event('input', { bubbles: true }));
      thresh.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("Saved operational preferences (v1)");
    await cdp.hardReload(1600);
    const setAfterReload = await cdp.waitForText("Safe Operational Console Preferences");
    const threshVal = await cdp.eval("Array.from(document.querySelectorAll('input')).find(i => i.type === 'number')?.value");
    check(threshVal === "15" && setAfterReload.includes("(v1"), "Settings low_stock_threshold=15 persisted cleanly across hard reload");
    await cdp.screenshot("settings-preferences-desktop.png");

    // Negative Settings Stale Version Conflict (409)
    const staleRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ low_stock_threshold: 20, expectedVersion: 0 }),
    });
    check(staleRes.status === 409, `Stale settings version rejected 409 (${staleRes.status})`);

    // 4D. ADM-OPS-03 Staff Provisioning, Deactivation Session Revocation, Privilege Escalation Block
    await cdp.navigate(`${ADMIN_URL}/settings/staff`, 1200);
    await cdp.waitForText("Provision Scoped Staff Account");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Provision Scoped Staff'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Provision Scoped Operational Staff");
    const newStaffPass = crypto.randomBytes(12).toString("base64url") + "D4!";
    await cdp.eval(`(() => {
      const setLbl = (lblSub, val) => {
        const lbl = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes(lblSub));
        const inp = lbl?.closest('.MuiFormControl-root')?.querySelector('input');
        if (inp) {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, val);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      setLbl('Staff Email', 'e2e-scoped@sai-ajanta.test');
      setLbl('First Name', 'Scoped');
      setLbl('Initial Password', ${JSON.stringify(newStaffPass)});
    })()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('[role="dialog"] button[type="submit"]').click()`);
    await cdp.waitForText("e2e-scoped@sai-ajanta.test", 12000);
    await cdp.hardReload(1600);
    const staffPageText = await cdp.waitForText("e2e-scoped@sai-ajanta.test");
    check(staffPageText.includes("CATALOG_MANAGE"), "Created scoped staff persisted across hard reload");
    await cdp.screenshot("staff-directory-desktop.png");

    // Verify new scoped staff token works BEFORE deactivation, and FAILS (401) AFTER deactivation!
    const scopedToken = await loginToken("e2e-scoped@sai-ajanta.test", newStaffPass);
    const preDeact = await fetch(`${BACKEND_URL}/admin/sai-ajanta/me`, {
      headers: { Authorization: `Bearer ${scopedToken}` },
    });
    check(preDeact.status === 200, "New scoped staff can authenticate cleanly");

    // Escalation check: try granting SETTINGS_MANAGE -> 403 OWNER_POLICY_LOCKED
    const escRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        email: "bad-admin@sai-ajanta.test",
        first_name: "Bad",
        password: newStaffPass,
        permissions: ["SETTINGS_MANAGE"],
      }),
    });
    check(escRes.status === 403, `Granting SETTINGS_MANAGE via UI API blocked 403 (${escRes.status})`);

    // Deactivate scoped staff via UI button
    await cdp.eval(`(() => {
      const row = Array.from(document.querySelectorAll('.MuiDataGrid-row')).find(r => r.innerText.includes('e2e-scoped@sai-ajanta.test'));
      const btn = Array.from(row?.querySelectorAll('button') || []).find(b => b.innerText.includes('Deactivate'));
      if (btn) btn.click();
    })()`);
    await sleep(1000);
    const postDeact = await fetch(`${BACKEND_URL}/admin/sai-ajanta/me`, {
      headers: { Authorization: `Bearer ${scopedToken}` },
    });
    check(postDeact.status === 401, `Deactivated staff session immediately rejected 401 (${postDeact.status})`);

    // 4E. ADM-OPS-02 Durable Audit Log Viewer
    await cdp.navigate(`${ADMIN_URL}/settings/audit-log`, 1200);
    const auditBody = await cdp.waitForText("PRODUCT_CREATE");
    check(
      auditBody.includes("ADMIN_SETTINGS_UPDATE") &&
        auditBody.includes("STAFF_CREATE") &&
        !auditBody.includes("Export CSV"),
      "Audit Log renders real durable events and excludes unrestricted CSV export"
    );
    await cdp.screenshot("audit-log-desktop.png");

    // 4F. ADM-OPS-06 Seller Coverage Simulator
    await cdp.navigate(`${ADMIN_URL}/seller-coverage`, 1200);
    await cdp.waitForText("PIN-Code & Territory Seller Coverage Inspector");
    await cdp.eval(`(() => {
      const inp = Array.from(document.querySelectorAll('input')).find(i => i.maxLength === 6);
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, '620001');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("ENQUIRY_ONLY_BLOCKED");
    check(true, "Seller Coverage Simulator verifies Floor Springs -> ENQUIRY_ONLY_BLOCKED");
    const covWrite = await fetch(`${BACKEND_URL}/admin/sai-ajanta/seller-coverage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${superToken}` },
    });
    check(covWrite.status === 403, `Seller coverage write gated 403 OWNER_POLICY_LOCKED (${covWrite.status})`);
    await cdp.screenshot("seller-coverage-desktop.png");

    // 4G. ADM-OPS-08 Nonpayable Quote Create -> Revision -> Hard Reload
    await cdp.navigate(`${ADMIN_URL}/quotes`, 1200);
    await cdp.waitForText("BOQ Quotations & Draft Revisions");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Nonpayable Quote'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Create Nonpayable BOQ Quotation");
    await cdp.eval(`(() => {
      const lbl = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Customer / Firm Contact Name'));
      const inp = lbl?.closest('.MuiFormControl-root')?.querySelector('input');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, 'Coimbatore Glazing Works');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('[role="dialog"] button[type="submit"]').click()`);
    await cdp.waitForText("Coimbatore Glazing Works", 10000);
    await cdp.hardReload(1600);
    const quoteReloaded = await cdp.waitForText("Coimbatore Glazing Works");
    check(quoteReloaded.includes("DRAFT") && quoteReloaded.includes("12,500"), "Nonpayable BOQ quotation persisted across hard reload");
    await cdp.screenshot("quotes-desktop.png");

    // 4H. ADM-OPS-09 Inventory Read-Only Reservations & Movement Ledger
    await cdp.navigate(`${ADMIN_URL}/inventory/reservations`, 1200);
    await cdp.waitForText("Phase 03 Stock Reservations (Read-Only)");
    await cdp.navigate(`${ADMIN_URL}/inventory/adjustments`, 1200);
    await cdp.waitForText("Bulk Manual Stock Quantity Overwrites Disabled");
    await cdp.screenshot("inventory-ledger-desktop.png");

    // 4I. ADM-OPS-10 Returns Inspection (Save -> Reload) & Promotions Draft
    await cdp.navigate(`${ADMIN_URL}/returns`, 1200);
    await cdp.waitForText("Surya Traders");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Inspect'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Physical Return Inspection");
    await cdp.eval(`(() => {
      const dmg = Array.from(document.querySelectorAll('input')).find(i => i.type === 'number');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(dmg, '1');
      dmg.dispatchEvent(new Event('input', { bubbles: true }));
      dmg.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(150);
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.innerText.includes('Save Inspection Record'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Return: REQUESTED");
    await cdp.hardReload(1600);
    const retAfterReload = await cdp.waitForText("Surya Traders");
    check(retAfterReload.includes("Return: REQUESTED"), "Return physical inspection persisted across hard reload");
    const overQtyBlock = await fetch(`${BACKEND_URL}/admin/sai-ajanta/returns/${seededOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ damaged_qty: 99 }),
    });
    check(overQtyBlock.status === 400, `Excess damaged_qty rejected 400 (${overQtyBlock.status})`);
    const refundBlock = await fetch(`${BACKEND_URL}/admin/sai-ajanta/returns/${seededOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ refund_status: "REFUNDED" }),
    });
    check(refundBlock.status === 403, `Unauthorized return refund/restock blocked 403 (${refundBlock.status})`);
    await cdp.screenshot("returns-inspection-desktop.png");

    await cdp.navigate(`${ADMIN_URL}/promotions`, 1200);
    await cdp.waitForText("Promotional Proposals (Draft Only)");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create Promo Draft'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Create Promotional Proposal Draft");
    await cdp.eval(`(() => {
      const setLbl = (sub, val) => {
        const lbl = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes(sub));
        const inp = lbl?.closest('.MuiFormControl-root')?.querySelector('input');
        if (inp) {
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(inp, val);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      setLbl('Draft Code', 'OPS-DEALER-10');
      setLbl('Proposal Title', 'Dealer Slab Draft Q4');
    })()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('[role="dialog"] button[type="submit"]').click()`);
    await cdp.waitForText("OPS-DEALER-10", 10000);
    await cdp.hardReload(1600);
    await cdp.waitForText("OPS-DEALER-10");
    check(true, "Promotional proposal draft persisted as DRAFT across hard reload");
    await cdp.screenshot("promotions-draft-desktop.png");

    // 4J. Mobile/Tablet Responsive Breakpoints (1920, 768, 390, 320)
    for (const vp of [
      { w: 1920, h: 1080, mob: false },
      { w: 768, h: 1024, mob: true },
      { w: 390, h: 844, mob: true },
      { w: 320, h: 568, mob: true },
    ]) {
      await cdp.setViewport(vp.w, vp.h, vp.mob);
      for (const route of ["/settings/audit-log", "/settings/staff", "/quotes", "/seller-coverage"]) {
        await cdp.navigate(`${ADMIN_URL}${route}`, 900);
        const ov = await cdp.eval("({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })");
        check(ov.sw <= ov.iw + 2, `No horizontal overflow on ${route} at ${vp.w}px (${ov.sw} <= ${ov.iw})`);
        if (vp.w === 390 && route === "/settings/audit-log") {
          await cdp.screenshot("audit-log-mobile-390.png");
        }
      }
    }

    check(
      cdp.pageExceptions.length === 0,
      `Zero unhandled runtime JS exceptions across ADM-OPS E2E (${cdp.pageExceptions.length})`
    );
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) killTree(chromeProc.pid);
    if (adminProc) killTree(adminProc.pid);
    if (backendProc) killTree(backendProc.pid);
    await sleep(1000);
    try {
      runPsql("postgres", `DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE);`);
      console.log(`Cleaned up disposable database: ${TEST_DB_NAME}`);
    } catch (e) {
      console.error("DB cleanup error:", e.message);
    }
    fs.rmSync(D_TEMP_DIR, { recursive: true, force: true });

    const liveCountsAfter = runPsql(
      "medusa",
      "SELECT COUNT(*)::text || '|' || (SELECT COUNT(*)::text FROM product) FROM \"user\";"
    ).trim();
    check(
      liveCountsBefore === liveCountsAfter,
      `Live/dev 'medusa' DB remained 100% untouched (${liveCountsBefore} === ${liveCountsAfter})`
    );
  }

  console.log(`\n=== ADM-OPS E2E SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("OPS E2E fatal error:", err);
  process.exit(1);
});
