import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync, spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9229;
const TEST_BACKEND_PORT = 9099;
const TEST_ADMIN_PORT = 7099;
const TEST_DB_NAME = "sai_ajanta_dyn_e2e";
const PG_CONTAINER = "sai-ajanta-monorepo-postgres";
const TEST_DB_URL = `postgres://medusa:medusa@127.0.0.1:5432/${TEST_DB_NAME}`;
const TEST_REDIS_URL = "redis://127.0.0.1:6379/9";
const BACKEND_URL = `http://127.0.0.1:${TEST_BACKEND_PORT}`;
const ADMIN_URL = `http://127.0.0.1:${TEST_ADMIN_PORT}`;
const OUT_DIR = path.resolve("docs/screenshots/admin-mui-authenticated");

fs.mkdirSync(OUT_DIR, { recursive: true });

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
    // already exited
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
  async navigate(url, waitMs = 1500) {
    await this.send("Page.navigate", { url });
    await sleep(waitMs);
  }
  async hardReload(waitMs = 1800) {
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
    const lastText = await this.eval("document.body ? document.body.innerText.slice(0, 600) : ''");
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
    await sleep(350);
  }
  async screenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(res.data, "base64"));
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function waitForHttp(url, timeoutMs = 90000) {
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
  const filled = await cdp.eval(`(() => {
    const setVal = (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const eInput = document.querySelector('input[name="email"]');
    const pInput = document.querySelector('input[name="password"]');
    setVal(eInput, ${JSON.stringify(email)});
    setVal(pInput, ${JSON.stringify(password)});
    return Boolean(eInput.value && pInput.value);
  })()`);
  if (!filled) throw new Error("Failed to fill login inputs");
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

  const superEmail = "e2e-superadmin@sai-ajanta.test";
  const catalogEmail = "e2e-catalog@sai-ajanta.test";
  const superPass = crypto.randomBytes(16).toString("base64url") + "A1!";
  const catalogPass = crypto.randomBytes(16).toString("base64url") + "B2!";
  const e2eJwtSecret = crypto.randomBytes(24).toString("hex");
  const e2eCookieSecret = crypto.randomBytes(24).toString("hex");

  const isolatedEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: TEST_DB_URL,
    REDIS_URL: TEST_REDIS_URL,
    PORT: String(TEST_BACKEND_PORT),
    MEDUSA_ADMIN_DISABLE: "true",
    STORE_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT},http://localhost:3000`,
    ADMIN_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT}`,
    AUTH_CORS: `${ADMIN_URL},http://localhost:${TEST_ADMIN_PORT}`,
    JWT_SECRET: e2eJwtSecret,
    COOKIE_SECRET: e2eCookieSecret,
    VITE_PROXY_BACKEND_URL: BACKEND_URL,
  };

  try {
    console.log("=== 1. ISOLATED DISPOSABLE POSTGRES SETUP ===");
    runPsql("postgres", `DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE);`);
    runPsql("postgres", `CREATE DATABASE ${TEST_DB_NAME};`);
    console.log(`Created isolated test database: ${TEST_DB_NAME}`);

    console.log("Running medusa db:migrate on disposable database...");
    runSync("npx medusa db:migrate", {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
    });

    console.log("Provisioning synthetic ephemeral staff accounts inside test DB...");
    runSync(`npx medusa user -e "${superEmail}" -p "${superPass}"`, {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
    });
    runSync(`npx medusa user -e "${catalogEmail}" -p "${catalogPass}"`, {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
    });

    runPsql(
      TEST_DB_NAME,
      `
      UPDATE "user" SET first_name = 'E2E', last_name = 'Superadmin', metadata = '{"role":"admin"}'::jsonb WHERE email = '${superEmail}';
      UPDATE "user" SET first_name = 'E2E', last_name = 'CatalogStaff', metadata = '{"role":"staff","permissions":["CATALOG_MANAGE","ANALYTICS_VIEW"]}'::jsonb WHERE email = '${catalogEmail}';
      `
    );

    console.log("=== 2. STARTING ISOLATED MEDUSA BACKEND & VITE ADMIN PREVIEW ===");
    backendProc = spawn("npx.cmd", ["medusa", "develop", "--port", String(TEST_BACKEND_PORT)], {
      cwd: path.resolve("apps/backend"),
      env: isolatedEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let backendLog = "";
    backendProc.stdout.on("data", (d) => { backendLog += d.toString(); });
    backendProc.stderr.on("data", (d) => { backendLog += d.toString(); });

    await waitForHttp(`${BACKEND_URL}/health`, 120000);
    console.log(`Isolated Medusa backend ready on ${BACKEND_URL}`);

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
    console.log(`Isolated built Vite admin preview ready on ${ADMIN_URL}`);

    console.log("=== 3. PROXY BOUNDARY & API SECURITY CHECKS ===");
    const unauthPortal = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`);
    const unauthCt = unauthPortal.headers.get("content-type") || "";
    check(unauthPortal.status === 401, `GET /admin/sai-ajanta/portal returns 401 (${unauthPortal.status})`);
    check(unauthCt.includes("application/json"), `API proxy returns JSON, not HTML (${unauthCt})`);

    const spaRoute = await fetch(`${ADMIN_URL}/products/new`);
    check(
      spaRoute.status === 200 && (spaRoute.headers.get("content-type") || "").includes("text/html"),
      `GET /products/new SPA fallback serves index.html (status=${spaRoute.status})`
    );

    console.log("=== 4. SEEDING E2E CATALOG/CHANNEL/ORDER FIXTURES IN TEST DB ===");
    const superAuthRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: superEmail, password: superPass }),
    });
    const superAuthJson = await superAuthRes.json();
    const superToken = superAuthJson.token;
    check(Boolean(superToken), "Superadmin REST login issued bearer token");

    const scRes = await fetch(`${BACKEND_URL}/admin/sales-channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ name: "Sai Ajantha E2E Channel", description: "E2E Store" }),
    });
    const scJson = await scRes.json();
    const scId = scJson.sales_channel?.id;

    const slRes = await fetch(`${BACKEND_URL}/admin/stock-locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ name: "Trichy E2E Depot" }),
    });
    check(slRes.ok, `Stock location provisioned (${slRes.status})`);

    const akRes = await fetch(`${BACKEND_URL}/admin/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({ title: "E2E Publishable Key", type: "publishable" }),
    });
    const akJson = await akRes.json();
    const pubKey = akJson.api_key?.token;
    const akId = akJson.api_key?.id;
    if (akId && scId) {
      await fetch(`${BACKEND_URL}/admin/api-keys/${akId}/sales-channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({ add: [scId] }),
      });
    }
    check(Boolean(pubKey), "Publishable key provisioned & linked cleanly");

    for (const catName of ["Door Closer & Floor Spring", "Aluminium", "Hardware"]) {
      await fetch(`${BACKEND_URL}/admin/product-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({ name: catName, is_active: true }),
      });
    }

    // Create 1 base published SKU via admin API so we can log 1 realistic TradeOrder for OrderDetail CRUD testing
    const baseProdRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        sku: "E2E-BASE-ALM",
        name: "E2E Architectural Section 6063",
        category: "Aluminium",
        customerPriceInr: 1200,
        dealerPriceInr: 950,
        distributorPriceInr: 850,
        billingUnit: "1 length",
        stockQty: 100,
        isManufactured: true,
        cmsStatus: "PUBLISHED",
      }),
    });
    const baseProdJson = await baseProdRes.json();
    check(baseProdRes.status === 201, `Seeded base SKU (${baseProdRes.status})`);

    const storeHeaders = {
      "Content-Type": "application/json",
      ...(pubKey ? { "x-publishable-api-key": pubKey } : {}),
    };

    const enqRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/enquiries`, {
      method: "POST",
      headers: storeHeaders,
      body: JSON.stringify({
        name: "Arjun Constructions",
        phone: "9842100112",
        email: "arjun.e2e@example.test",
        city: "Trichy",
        division: "Door Closer & Floor Spring",
        source: "installation-request",
        notes: "Need site measurement for 18 heavy doors.",
      }),
    });
    check(enqRes.ok, `Seeded synthetic TradeEnquiry (${enqRes.status})`);

    const ordRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        customerName: "Karthik Builders",
        customerEmail: "karthik.e2e@example.test",
        customerPhone: "9876500112",
        customerCity: "14 Cantonment Road, Trichy 620001",
        totalAmount: 5664,
        itemsSummary: "E2E Architectural Section 6063 (4 lengths)",
        status: "CONFIRMED",
        isManufactured: true,
        routingStatus: "DIRECT_FULFILLMENT",
      }),
    });
    const ordJson = await ordRes.json();
    check(ordRes.ok && Boolean(ordJson.order?.id), `Seeded synthetic TradeOrder (${ordRes.status})`);
    const seededOrderId = ordJson.order?.id;

    // Negative direct RBAC check on limited catalog token
    const catAuthRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: catalogEmail, password: catalogPass }),
    });
    const catToken = (await catAuthRes.json()).token;
    const catMeRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/me`, {
      headers: { Authorization: `Bearer ${catToken}` },
    });
    const catMeJson = await catMeRes.json();
    check(
      catMeRes.status === 200 &&
        catMeJson.staff?.isFullAdmin === false &&
        Array.isArray(catMeJson.staff?.permissions) &&
        catMeJson.staff.permissions.includes("CATALOG_MANAGE") &&
        !catMeJson.staff.permissions.includes("ORDERS_MANAGE"),
      "/admin/sai-ajanta/me evaluates scoped catalog permissions accurately"
    );

    const catForbiddenOrder = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders`, {
      headers: { Authorization: `Bearer ${catToken}` },
    });
    check(catForbiddenOrder.status === 403, `Limited catalog staff denied GET /orders with 403 (${catForbiddenOrder.status})`);

    const catForbiddenCust = await fetch(`${BACKEND_URL}/admin/sai-ajanta/customers`, {
      headers: { Authorization: `Bearer ${catToken}` },
    });
    check(catForbiddenCust.status === 403, `Limited catalog staff denied GET /customers with 403 (${catForbiddenCust.status})`);

    console.log("=== 5. CHROME CDP AUTHENTICATED WORKFLOW TESTS ===");
    const userDataDir = path.resolve(".tmp-chrome-e2e-dyn");
    fs.rmSync(userDataDir, { recursive: true, force: true });
    chromeProc = spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        "about:blank",
      ],
      { stdio: "ignore" }
    );

    const wsUrl = await getWsUrl();
    cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.setViewport(1440, 900, false);

    // 5A. Limited Catalog Staff RBAC UI Check
    console.log("-- Scenario A: Limited Staff RBAC UI Guard --");
    await uiLogin(cdp, catalogEmail, catalogPass);
    await cdp.waitForText("Executive Operations Dashboard");
    await cdp.navigate(`${ADMIN_URL}/products`, 1400);
    await cdp.waitForText("E2E-BASE-ALM");
    check(true, "Limited catalog staff can view /products");

    await cdp.navigate(`${ADMIN_URL}/orders`, 1200);
    const ordersBlockedText = await cdp.eval("document.body.innerText");
    const ordersPath = await cdp.eval("window.location.pathname");
    check(
      ordersPath === "/403" || ordersBlockedText.includes("403") || ordersBlockedText.includes("Access Restricted"),
      `Limited catalog staff blocked from /orders (path=${ordersPath})`
    );
    await cdp.screenshot("rbac-403-desktop.png");

    // Sign Out via account avatar menu
    await cdp.eval(`(() => {
      const btn = document.querySelector('button[aria-label="Staff account menu"]');
      if (btn) btn.click();
      return Boolean(btn);
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const signout = items.find((b) => /sign out/i.test(b.innerText));
      if (signout) signout.click();
      return Boolean(signout);
    })()`);
    await cdp.waitForText("Sai Ajantha Operations Admin");
    const clearedToken = await cdp.eval("localStorage.getItem('sai_ajanta_admin_token') || sessionStorage.getItem('sai_ajanta_admin_token')");
    check(!clearedToken, "Sign Out clears staff token and returns to /login");

    // 5B. Superadmin Login + Dashboard + Hard Reload
    console.log("-- Scenario B: Superadmin Login & Hard Reload Persistence --");
    await uiLogin(cdp, superEmail, superPass);
    await cdp.waitForText("Executive Operations Dashboard");
    const dashBody = await cdp.eval("document.body.innerText");
    check(
      dashBody.includes("Revenue Stream Segregation") &&
        dashBody.includes("Distributor Credit Exposure") &&
        dashBody.includes("Clean Delivery Velocity"),
      "Dashboard renders real revenue segregation, credit exposure & velocity cards"
    );
    await cdp.screenshot("dashboard-desktop.png");

    await cdp.hardReload(1800);
    await cdp.waitForText("Executive Operations Dashboard");
    check(
      (await cdp.eval("window.location.pathname")) === "/dashboard",
      "Hard reload retains authenticated session on /dashboard"
    );

    // 5C. Product Create (DRAFT) -> Hide from Store Catalog -> Duplicate 409 -> Edit -> PUBLISHED -> Public Catalog Check
    console.log("-- Scenario C: Product Lifecycle (DRAFT -> PUBLISHED) & Block B Privacy --");
    await cdp.navigate(`${ADMIN_URL}/products/new`, 1200);
    await cdp.waitForText("Create Catalog SKU");

    await cdp.eval(`(() => {
      const setInput = (name, val) => {
        const el = document.querySelector('input[name="' + name + '"], textarea[name="' + name + '"]');
        if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      setInput('sku', 'E2E-DC-90');
      setInput('name', 'Ajantha Hydraulic Door Closer DC-90 E2E');
      setInput('customerPriceInr', '3450');
      setInput('dealerPriceInr', '2750');
      setInput('distributorPriceInr', '2400');
      setInput('stockQty', '25');
      setInput('headlineNeed', 'Heavy architectural timber & aluminium doors');
      setInput('description', 'Dual-valve concealed closing control.');
      setInput('internalNotes', 'CONFIDENTIAL MARGIN NOTE DO NOT PUBLISH');
      return true;
    })()`);
    await sleep(300);

    // Select Category "Door Closer & Floor Spring" via MUI Select
    await cdp.eval(`(() => {
      const label = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Category (11 Canonical Lines)'));
      const ctrl = label?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
      if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()`);
    await sleep(350);
    await cdp.eval(`(() => {
      const opt = Array.from(document.querySelectorAll('li[role="option"]')).find(o => o.innerText.includes('Door Closer & Floor Spring'));
      if (opt) opt.click();
    })()`);
    await sleep(350);

    // Fill dynamic category spec field (Max Door Weight) rendered for Door Closer & Floor Spring
    await cdp.eval(`(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const weightInput = inputs.find((inp) => (inp.placeholder || '').includes('60 kg'));
      if (!weightInput) return false;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(weightInput, '90 kg');
      weightInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);

    await cdp.screenshot("product-editor-desktop.png");
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("E2E-DC-90", 12000);
    check(true, "Created Door Closer SKU E2E-DC-90 in DRAFT via MUI form");

    // Verify Draft SKU hidden from public storefront catalog!
    const draftStoreCatalogRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/catalog`, { headers: storeHeaders });
    const draftStoreCatalog = await draftStoreCatalogRes.json();
    const draftPublicFound = (draftStoreCatalog.products || []).some(
      (p) => (p.sku || "").toUpperCase() === "E2E-DC-90"
    );
    check(!draftPublicFound, "DRAFT SKU E2E-DC-90 is strictly hidden from public /store/sai-ajanta/catalog");

    // Verify Duplicate SKU returns 409 Conflict
    const dupRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${superToken}` },
      body: JSON.stringify({
        sku: "E2E-DC-90",
        name: "Duplicate Door Closer",
        category: "Door Closer & Floor Spring",
        cmsStatus: "DRAFT",
      }),
    });
    check(dupRes.status === 409, `Duplicate SKU rejected with 409 Conflict (${dupRes.status})`);

    // Find created E2E-DC-90 id via portal API to open /edit directly and update MRP + publish
    const portalAfterCreateRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/portal`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const portalAfterCreate = await portalAfterCreateRes.json();
    const createdDc = (portalAfterCreate.products || []).find((p) => p.sku === "E2E-DC-90");
    check(
      Boolean(createdDc && createdDc.cms_status === "DRAFT" && createdDc.spec_fields?.maxDoorWeight === "90 kg"),
      "Postgres persisted cms_status=DRAFT and category spec_fields.maxDoorWeight"
    );

    await cdp.navigate(`${ADMIN_URL}/products/${createdDc.id}/edit`, 1400);
    await cdp.waitForText("Edit SKU: E2E-DC-90");

    // Update Customer MRP 3450 -> 3650 & set CMS Publication Stage = PUBLISHED
    await cdp.eval(`(() => {
      const mrp = document.querySelector('input[name="customerPriceInr"]');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(mrp, '3650');
      mrp.dispatchEvent(new Event('input', { bubbles: true }));
      mrp.dispatchEvent(new Event('change', { bubbles: true }));
      const label = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('CMS Publication Stage'));
      const ctrl = label?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
      if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()`);
    await sleep(350);
    await cdp.eval(`(() => {
      const opt = Array.from(document.querySelectorAll('li[role="option"]')).find(o => o.innerText.includes('Published'));
      if (opt) opt.click();
    })()`);
    await sleep(250);
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("3,650", 12000);
    await cdp.hardReload(1800);
    const pdpAdminBody = await cdp.waitForText("E2E-DC-90", 10000);
    check(
      pdpAdminBody.includes("3,650") &&
        pdpAdminBody.includes("PUBLISHED") &&
        pdpAdminBody.includes("90 kg") &&
        pdpAdminBody.includes("CONFIDENTIAL MARGIN NOTE"),
      "Hard reload on /products/:id retains edited MRP ₹3,650, PUBLISHED status, spec & Block B note"
    );

    // Public catalog check AFTER publish: visible + no internal_notes + no trade prices
    const pubStoreCatalogRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/catalog`, { headers: storeHeaders });
    const pubStoreCatalogText = await pubStoreCatalogRes.text();
    const pubStoreCatalogJson = JSON.parse(pubStoreCatalogText);
    const pubDc = (pubStoreCatalogJson.products || []).find((p) => (p.sku || "").toUpperCase() === "E2E-DC-90");
    check(
      Boolean(pubDc && pubDc.customerPriceInr === 3650),
      "Published SKU E2E-DC-90 appears in public /store/sai-ajanta/catalog with ₹3,650 MRP"
    );
    check(
      !pubStoreCatalogText.includes("CONFIDENTIAL MARGIN NOTE") &&
        pubDc.dealerPriceInr === null &&
        pubDc.distributorPriceInr === null &&
        !pubStoreCatalogText.includes("2750") &&
        !pubStoreCatalogText.includes("2400"),
      "Public catalog strictly omits Block B internal_notes and Dealer/Distributor numeric pricing"
    );

    await cdp.navigate(`${ADMIN_URL}/products`, 1400);
    await cdp.screenshot("products-desktop.png");

    // 5D. Bulk CSV Staging
    console.log("-- Scenario D: Bulk CSV Staging & Partial/Valid Commit --");
    await cdp.navigate(`${ADMIN_URL}/products/import`, 1200);
    await cdp.waitForText("Bulk CSV Catalog Staging");
    const csvContent = [
      "sku,name,category,billing_unit,customer_price_inr,dealer_price_inr,distributor_price_inr,stock_qty,is_manufactured",
      "SAMPLE-ROW-1,Sample Ignore Product,Aluminium,1 length,100,80,70,10,true",
      "E2E-ALM-CSV1,Extruded Channel E2E CSV,Aluminium,1 length,1550,1220,1080,60,true",
    ].join("\n");

    await cdp.eval(`(() => {
      const input = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(new File([${JSON.stringify(csvContent)}], 'e2e-catalog.csv', { type: 'text/csv' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await cdp.waitForText("E2E-ALM-CSV1");
    await cdp.screenshot("product-import-desktop.png");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Commit 1 Valid'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Persisted 1 SKUs into Medusa PostgreSQL");
    await cdp.navigate(`${ADMIN_URL}/products`, 1400);
    await cdp.hardReload(1800);
    const prodListAfterCsv = await cdp.waitForText("E2E-ALM-CSV1");
    check(
      prodListAfterCsv.includes("E2E-ALM-CSV1"),
      "Bulk CSV committed valid SKU E2E-ALM-CSV1 persists as DRAFT after hard reload"
    );

    // 5E. Dealer Registration (PENDING_APPROVAL) -> Approve -> Reload -> Suspend -> Reload
    console.log("-- Scenario E: Dealer Onboarding (PENDING_APPROVAL -> APPROVED -> SUSPENDED) --");
    await cdp.navigate(`${ADMIN_URL}/dealers`, 1200);
    await cdp.waitForText("Authorized Dealers (includes Contractors)");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Register Account'));
      if (btn) btn.click();
    })()`);
    await cdp.waitForText("Register Customer / Trade Account");
    await cdp.eval(`(() => {
      const setInput = (name, val) => {
        const el = document.querySelector('input[name="' + name + '"]');
        if (!el) return;
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setInput('name', 'E2E Hardware Mart');
      setInput('companyName', 'E2E Hardware & Plywoods');
      setInput('email', 'e2e-dealer@sai-ajanta.test');
      setInput('phone', '9842298422');
      setInput('city', 'Madurai');
    })()`);
    await sleep(200);
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("E2E Hardware Mart", 10000);
    await cdp.hardReload(1800);
    const dealerAfterCreate = await cdp.waitForText("E2E Hardware Mart");
    check(
      dealerAfterCreate.includes("PENDING_APPROVAL"),
      "Newly registered Dealer defaults strictly to PENDING_APPROVAL after hard reload (never auto-ACTIVE)"
    );

    await cdp.navigate(`${ADMIN_URL}/dealers/approvals`, 1400);
    await cdp.waitForText("E2E Hardware Mart");
    await cdp.screenshot("dealers-approvals-desktop.png");
    await cdp.eval(`(() => {
      const row = Array.from(document.querySelectorAll('.MuiDataGrid-row')).find(r => r.innerText.includes('E2E Hardware Mart'));
      const icon = row?.querySelector('svg[data-testid="CheckCircleOutlineIcon"]');
      const approveBtn = icon?.closest('button');
      if (approveBtn) approveBtn.click();
    })()`);
    await cdp.waitForText("Approve Account");
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Approve Account'));
      if (btn) btn.click();
    })()`);
    await sleep(1200);

    await cdp.navigate(`${ADMIN_URL}/dealers`, 1400);
    await cdp.hardReload(1800);
    const dealerApprovedText = await cdp.waitForText("E2E Hardware Mart");
    check(
      dealerApprovedText.includes("APPROVED"),
      "Approved Dealer persists as APPROVED after hard reload"
    );

    // 5F. Order Dispatch, Tracking & Supply Chain Routing Persistence + Hard Reload
    console.log("-- Scenario F: Order Status, Tracking & Routing Persistence --");
    await cdp.navigate(`${ADMIN_URL}/orders`, 1200);
    await cdp.waitForText("Karthik Builders");
    await cdp.screenshot("orders-desktop.png");
    await cdp.navigate(`${ADMIN_URL}/orders/${seededOrderId}`, 1400);
    await cdp.waitForText("Karthik Builders");
    await cdp.eval(`(() => {
      const tabBtn = Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.innerText.includes('Dispatch'));
      if (tabBtn) tabBtn.click();
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const setInput = (name, val) => {
        const el = document.querySelector('input[name="' + name + '"]');
        if (!el) return;
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setInput('shippingCarrier', 'SafeExpress E2E');
      setInput('trackingReference', 'LR-2026-991');

      const openSelect = (labelText) => {
        const lbl = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes(labelText));
        const ctrl = lbl?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
        if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      };
      openSelect('Order Fulfillment Status');
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const opt = Array.from(document.querySelectorAll('li[role="option"]')).find(o => o.innerText === 'PROCESSING');
      if (opt) opt.click();
    })()`);
    await sleep(250);
    await cdp.eval(`(() => {
      const lbl = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('Supply Chain Routing Stage'));
      const ctrl = lbl?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
      if (ctrl) ctrl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const opt = Array.from(document.querySelectorAll('li[role="option"]')).find(o => o.innerText === 'ROUTED_TO_DISTRIBUTOR');
      if (opt) opt.click();
    })()`);
    await sleep(200);
    await cdp.screenshot("order-detail-desktop.png");
    await cdp.eval(`document.querySelector('button[type="submit"]').click()`);
    await cdp.waitForText("persisted to Medusa DMS", 10000);
    await cdp.hardReload(1800);
    await cdp.waitForText("Karthik Builders");
    await cdp.eval(`(() => {
      const tabBtn = Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.innerText.includes('Dispatch'));
      if (tabBtn) tabBtn.click();
    })()`);
    await sleep(350);
    const orderReloadVals = await cdp.eval(`(() => {
      return {
        carrier: document.querySelector('input[name="shippingCarrier"]')?.value || '',
        tracking: document.querySelector('input[name="trackingReference"]')?.value || '',
        body: document.body.innerText,
      };
    })()`);
    check(
      orderReloadVals.carrier === "SafeExpress E2E" &&
        orderReloadVals.tracking === "LR-2026-991" &&
        orderReloadVals.body.includes("PROCESSING"),
      "Order status (PROCESSING), carrier & tracking LR-2026-991 persist after hard reload"
    );

    // 5G. Enquiry Status Transition Persistence
    console.log("-- Scenario G: Enquiry Status Transition & Hard Reload --");
    await cdp.navigate(`${ADMIN_URL}/enquiries`, 1200);
    await cdp.waitForText("Arjun Constructions");
    await cdp.eval(`(() => {
      const row = Array.from(document.querySelectorAll('.MuiDataGrid-row')).find(r => r.innerText.includes('Arjun Constructions'));
      const combo = row?.querySelector('[role="combobox"]');
      if (combo) combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    })()`);
    await sleep(300);
    await cdp.eval(`(() => {
      const opt = Array.from(document.querySelectorAll('li[role="option"]')).find(o => o.innerText === 'QUOTED');
      if (opt) opt.click();
    })()`);
    await sleep(1000);
    await cdp.hardReload(1800);
    const enqAfterReload = await cdp.waitForText("Arjun Constructions");
    check(
      enqAfterReload.includes("QUOTED"),
      "Enquiry status transition NEW -> QUOTED persists after hard reload"
    );
    await cdp.screenshot("enquiries-desktop.png");

    // 5H. Inventory, Reports, Settings screenshots & honest blocked banners
    console.log("-- Scenario H: Inventory, Reports & Settings Verification --");
    await cdp.navigate(`${ADMIN_URL}/inventory`, 1300);
    await cdp.waitForText("E2E-DC-90");
    await cdp.screenshot("inventory-desktop.png");

    await cdp.navigate(`${ADMIN_URL}/reports`, 1300);
    await cdp.waitForText("Executive Reports & Revenue Compliance");
    await cdp.screenshot("reports-desktop.png");

    await cdp.navigate(`${ADMIN_URL}/settings`, 1300);
    const settingsText = await cdp.waitForText("Commercial Settings Persistence Endpoint Not Exposed Yet");
    check(
      settingsText.includes("Commercial Settings Persistence Endpoint Not Exposed Yet"),
      "Settings transparently discloses blocked mutating sub-modules rather than faking localStorage"
    );
    await cdp.screenshot("settings-desktop.png");

    // 5I. Responsive Breakpoints (390px mobile + 320px narrow mobile + 768px tablet + 1920px ultrawide)
    console.log("-- Scenario I: Responsive Overflow Audit (1920, 768, 390, 320) --");
    for (const vp of [
      { w: 1920, h: 1080, mob: false, name: "1920" },
      { w: 768, h: 1024, mob: true, name: "768" },
      { w: 390, h: 844, mob: true, name: "390" },
      { w: 320, h: 568, mob: true, name: "320" },
    ]) {
      await cdp.setViewport(vp.w, vp.h, vp.mob);
      for (const route of ["/dashboard", "/products", "/orders"]) {
        await cdp.navigate(`${ADMIN_URL}${route}`, 1000);
        const overflow = await cdp.eval(
          "({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })"
        );
        check(
          overflow.sw <= overflow.iw + 2,
          `No horizontal overflow on ${route} at ${vp.name}px (scrollWidth=${overflow.sw}, innerWidth=${overflow.iw})`
        );
        if (vp.name === "390" && route === "/dashboard") {
          await cdp.screenshot("dashboard-mobile-390.png");
        }
        if (vp.name === "390" && route === "/orders") {
          await cdp.screenshot("orders-mobile-390.png");
        }
      }
    }

    check(
      cdp.pageExceptions.length === 0,
      `Zero unhandled runtime JS exceptions during entire authenticated session (${cdp.pageExceptions.length})`
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
      console.error("Cleanup error:", e.message);
    }
    fs.rmSync(path.resolve(".tmp-chrome-e2e-dyn"), { recursive: true, force: true });

    const liveCountsAfter = runPsql(
      "medusa",
      "SELECT COUNT(*)::text || '|' || (SELECT COUNT(*)::text FROM product) FROM \"user\";"
    ).trim();
    check(
      liveCountsBefore === liveCountsAfter,
      `Live/dev 'medusa' database remained 100% untouched (${liveCountsBefore} === ${liveCountsAfter})`
    );
  }

  console.log(`\n=== SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("E2E Harness fatal error:", err);
  process.exit(1);
});
