import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const BASE_URL = "http://localhost:3000";
const ADMIN_URL = "http://localhost:7001";
const OUT_DIR = path.resolve("docs/screenshots/ui-after");

fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
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
          if (msg.error) rej(msg.error);
          else res(msg.result);
        } else if (msg.method === "Runtime.exceptionThrown") {
          const desc = msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text;
          if (desc) this.pageExceptions.push(desc);
        } else if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
          const txt = (msg.params.args || []).map((a) => a.value || a.description || "").join(" ");
          if (txt && !txt.includes("favicon") && !txt.includes("401")) {
            this.consoleErrors.push(txt);
          }
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      if (Array.isArray(list) && list[0]?.webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(400);
    }
  }
  throw new Error("Chrome debugging port did not open");
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

async function runApiSecurityChecks() {
  console.log("\n=== 1. API & TRADE PRICE PRIVACY CHECKS ===");
  const prodRes = await fetch(`${BASE_URL}/api/products`);
  const prodText = await prodRes.text();
  check(
    prodRes.ok || prodRes.status === 503,
    `GET /api/products responds 200 or fail-closed 503 when backend offline (${prodRes.status})`
  );
  const forbiddenKeys = [
    "dealer_price_inr",
    "distributor_price_inr",
    "contractor_price_inr",
    "dealerPriceInr",
    "distributorPriceInr",
    "contractorPriceInr",
  ];
  for (const k of forbiddenKeys) {
    check(!prodText.includes(k), `Public /api/products does not leak '${k}'`);
  }

  const ordersRes = await fetch(`${BASE_URL}/api/orders`);
  check(ordersRes.status === 401, `Unauthenticated GET /api/orders returns 401 (got ${ordersRes.status})`);

  const meRes = await fetch(`${BASE_URL}/api/auth/me`);
  const meJson = await meRes.json().catch(() => ({}));
  check(!meJson?.user && !meJson?.session, "Unauthenticated GET /api/auth/me returns no user session");

  const adminRes = await fetch(`${BASE_URL}/api/admin/overview`);
  check(adminRes.status === 401 || adminRes.status === 403, `Unauthenticated GET /api/admin/overview blocked (${adminRes.status})`);
}

async function setViewport(client, width, height) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
}

async function navigateAndMeasure(client, url, waitMs = 1500) {
  await client.send("Page.navigate", { url });
  await sleep(waitMs);
    const res = await client.send("Runtime.evaluate", {
      expression: `({
        title: document.title,
        h1: document.querySelector("h1")?.innerText || "",
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyText: document.body.innerText.slice(0, 6000),
        overflows: Array.from(document.querySelectorAll("*")).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > document.documentElement.clientWidth + 2;
        }).slice(0, 5).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), right: Math.round(el.getBoundingClientRect().right) }))
      })`,
      returnByValue: true,
    });
    const val = res.result?.value || {};
    if (val.scrollWidth > val.clientWidth + 2 && val.overflows?.length) {
      console.warn("  [OVERFLOW NODES]", url, JSON.stringify(val.overflows));
    }
    return val;
}

async function capture(client, filename) {
  const { data } = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(data, "base64"));
}

async function main() {
  await runApiSecurityChecks();

  const userDataDir = path.resolve("C:/Windows/Temp/sai-ajanta-cdp-verify");
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  try {
    const wsUrl = await getWsUrl();
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });

    console.log("\n=== 2. DESKTOP (1440x900) MULTI-ROUTE VERIFICATION & SCREENSHOTS ===");
    await setViewport(client, 1440, 900);

    const desktopRoutes = [
      { url: `${BASE_URL}/`, shot: "home-desktop.png", mustContain: ["House of Ajantha", "Quality Without Compromise"] },
      { url: `${BASE_URL}/products`, shot: "products-desktop.png", mustContain: ["Product", "Category"] },
      { url: `${BASE_URL}/products?category=Clip`, mustContain: ["Clip"] },
      { url: `${BASE_URL}/products?category=Door%20Closer%20%26%20Floor%20Spring`, mustContain: ["Door Closer"] },
      { url: `${BASE_URL}/products?category=Kitchen%20Basket`, mustContain: ["Kitchen Basket"] },
      { url: `${BASE_URL}/products?category=Mesh`, mustContain: ["Mesh"] },
      { url: `${BASE_URL}/search?q=door`, mustContain: ["Search"] },
      { url: `${BASE_URL}/blogs`, shot: "blogs-desktop.png", mustContain: ["Useful Articles", "Product Selection Guides"] },
      { url: `${BASE_URL}/blogs/door-closer-sizing-guide`, mustContain: ["Door Closer"] },
      { url: `${BASE_URL}/quotes`, shot: "quotes-desktop.png", mustContain: ["Request a Quotation", "Dimensions"] },
      { url: `${BASE_URL}/installation`, shot: "installation-desktop.png", mustContain: ["Need Installation", "Independent Contractor Billing"] },
      { url: `${BASE_URL}/cart`, shot: "cart-desktop.png", mustContain: ["Cart"] },
      { url: `${BASE_URL}/checkout`, shot: "checkout-desktop.png", mustContain: ["Checkout"] },
      { url: `${BASE_URL}/login`, shot: "login-desktop.png", mustContain: ["Sign In"] },
      { url: `${BASE_URL}/register`, mustContain: ["Registration", "Account"] },
      { url: `${BASE_URL}/account`, mustContain: ["Account"] },
      { url: `${BASE_URL}/dealer`, shot: "dealer-desktop.png", mustContain: ["Dealer Portal"] },
      { url: `${BASE_URL}/distributor`, shot: "distributor-desktop.png", mustContain: ["Distributor Portal"] },
      { url: `${BASE_URL}/contact`, mustContain: ["Contact", "Tiruchirappalli"] },
      { url: `${BASE_URL}/return-policy`, shot: "return-policy-desktop.png", mustContain: ["Seller-Scoped Return", "Pending Owner Legal"] },
      { url: `${BASE_URL}/privacy-policy`, mustContain: ["Privacy Policy"] },
      { url: `${BASE_URL}/terms`, mustContain: ["Terms"] },
      { url: `${BASE_URL}/admin`, shot: "admin-storefront-desktop.png", mustContain: ["Admin"] },
    ];

    for (const r of desktopRoutes) {
      const m = await navigateAndMeasure(client, r.url, 1200);
      const noOverflow = m.scrollWidth <= m.clientWidth + 2;
      check(noOverflow, `[1440] ${r.url} has no horizontal overflow (${m.scrollWidth} <= ${m.clientWidth})`);
      for (const txt of r.mustContain || []) {
        check(
          m.bodyText.toLowerCase().includes(txt.toLowerCase()),
          `[1440] ${r.url} contains '${txt}'`
        );
      }
      check(!m.bodyText.includes("33AAGFA9981L1ZY"), `[1440] ${r.url} does not expose unconfirmed GSTIN`);
      check(!m.bodyText.includes("within 24 working hours"), `[1440] ${r.url} does not claim unconfirmed 24h SLA`);
      if (r.shot) {
        await capture(client, r.shot);
      }
    }

    // Check standalone Vite Admin on :7001
    try {
      const adminM = await navigateAndMeasure(client, ADMIN_URL, 1500);
      check(adminM.scrollWidth <= adminM.clientWidth + 2, `[1440] Vite Admin ${ADMIN_URL} fits without overflow`);
      check(adminM.bodyText.length > 50, `[1440] Vite Admin ${ADMIN_URL} rendered content`);
      await capture(client, "admin-vite-desktop.png");
    } catch (e) {
      console.warn("  [WARN] Standalone Vite admin check failed:", e.message);
    }

    console.log("\n=== 3. TABLET (768x1024) & MOBILE (390x844, 320x700) RESPONSIVE CHECKS ===");
    await setViewport(client, 768, 1024);
    for (const u of [`${BASE_URL}/`, `${BASE_URL}/products`, `${BASE_URL}/quotes`, `${BASE_URL}/login`]) {
      const m = await navigateAndMeasure(client, u, 900);
      check(m.scrollWidth <= m.clientWidth + 2, `[768] ${u} has no horizontal overflow (${m.scrollWidth} <= ${m.clientWidth})`);
      if (u === `${BASE_URL}/`) await capture(client, "home-tablet.png");
      if (u === `${BASE_URL}/products`) await capture(client, "products-tablet.png");
    }

    await setViewport(client, 390, 844);
    for (const u of [
      `${BASE_URL}/`,
      `${BASE_URL}/products`,
      `${BASE_URL}/quotes`,
      `${BASE_URL}/installation`,
      `${BASE_URL}/login`,
      `${BASE_URL}/dealer`,
      `${BASE_URL}/distributor`,
    ]) {
      const m = await navigateAndMeasure(client, u, 900);
      check(m.scrollWidth <= m.clientWidth + 2, `[390] ${u} has no horizontal overflow (${m.scrollWidth} <= ${m.clientWidth})`);
      if (u === `${BASE_URL}/`) await capture(client, "home-mobile.png");
      if (u === `${BASE_URL}/products`) await capture(client, "products-mobile.png");
      if (u === `${BASE_URL}/login`) await capture(client, "login-mobile.png");
    }

    await setViewport(client, 320, 700);
    for (const u of [`${BASE_URL}/`, `${BASE_URL}/products`, `${BASE_URL}/login`]) {
      const m = await navigateAndMeasure(client, u, 800);
      check(m.scrollWidth <= m.clientWidth + 2, `[320] ${u} has no horizontal overflow (${m.scrollWidth} <= ${m.clientWidth})`);
    }

    console.log("\n=== 4. HERO SECTION BOUNDING PARITY CHECK ===");
    await setViewport(client, 1440, 900);
    await client.send("Page.navigate", { url: `${BASE_URL}/` });
    await sleep(1200);
    const heroStats = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const heroEl = document.querySelector("section[aria-label*='Hero'], main section:first-of-type, h1")?.closest("section") || document.querySelector("main > div > section");
        const txt = document.body.innerText;
        return {
          hasOverviewText: txt.includes("01") && txt.includes("OVERVIEW"),
          hasPromiseText: txt.includes("02") && txt.includes("PROMISE"),
          heroH: heroEl?.getBoundingClientRect().height || 0,
        };
      })()`,
      returnByValue: true,
    });
    const hs = heroStats.result?.value || {};
    check(hs.hasOverviewText && hs.heroH > 400, `Hero section 01 OVERVIEW rendered cleanly (height=${hs.heroH})`);
    check(hs.hasPromiseText, "Hero section 02 PROMISE rendered cleanly");

    check(client.pageExceptions.length === 0, `Zero uncaught JS page exceptions (found ${client.pageExceptions.length})`);
    if (client.pageExceptions.length > 0) console.error("Page exceptions:", client.pageExceptions);

    client.close();
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup lock
    }
  }

  console.log(`\n========================================================`);
  console.log(`FULL VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`Screenshots saved to: ${OUT_DIR}`);
  console.log(`========================================================`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
