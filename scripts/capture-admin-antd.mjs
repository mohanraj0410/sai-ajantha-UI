import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9265;
const ADMIN_URL = "http://localhost:7001";
const OUT_DIR = path.resolve("docs/screenshots/antd-after");

fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === "Runtime.exceptionThrown") {
          this.consoleErrors.push(msg.params?.exceptionDetails?.text || "Runtime exception");
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej, timer } = this.callbacks.get(msg.id);
          clearTimeout(timer);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}, timeoutMs = 12000) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          rej(new Error(`CDP ${method} timed out`));
        }
      }, timeoutMs);
      this.callbacks.set(id, { res, rej, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(300);
    }
  }
  throw new Error("Could not connect to Chrome CDP");
}

const ROUTES = [
  { id: "01-dashboard", path: "/dashboard" },
  { id: "02-orders", path: "/orders" },
  { id: "03-quotes", path: "/quotes" },
  { id: "04-enquiries", path: "/enquiries" },
  { id: "05-products", path: "/products" },
  { id: "06-product-new", path: "/products/new" },
  { id: "07-categories", path: "/categories" },
  { id: "08-inventory", path: "/inventory" },
  { id: "09-pricing", path: "/pricing" },
  { id: "10-customers", path: "/customers" },
  { id: "11-dealers", path: "/dealers" },
  { id: "12-distributors", path: "/distributors" },
  { id: "13-seller-coverage", path: "/seller-coverage" },
  { id: "14-reports", path: "/reports" },
  { id: "15-settings", path: "/settings" },
];

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900, mobile: false },
  { key: "tablet", width: 768, height: 1024, mobile: false },
  { key: "mobile", width: 390, height: 844, mobile: true },
];

async function main() {
  let authData = null;
  for (let i = 1; i <= 25; i++) {
    try {
      const authRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
      });
      const json = await authRes.json();
      if (json.token) {
        authData = json;
        console.log(`Admin authenticated on attempt ${i}`);
        break;
      }
    } catch {}
    await sleep(2000);
  }
  if (!authData?.token) throw new Error("Admin login failed after waiting for backend boot.");

  const meRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${authData.token}` },
  });
  const meData = await meRes.json();
  const staff = meData.staff || {
    email: "admin@sai-ajanta.com",
    role: "admin",
    permissions: [
      "CUSTOMERS_MANAGE",
      "ORDERS_MANAGE",
      "CATALOG_MANAGE",
      "ANALYTICS_VIEW",
      "ENQUIRIES_MANAGE",
      "SETTINGS_MANAGE",
    ],
    isFullAdmin: true,
  };

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "about:blank",
  ]);

  const wsUrl = await getDebuggerUrl();
  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  // Capture Login Screen first (unauthenticated)
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.navigate", { url: `${ADMIN_URL}/login` });
  await sleep(1400);
  const loginShot = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, "00-login-desktop-antd.png"), Buffer.from(loginShot.data, "base64"));

  // Inject authenticated admin session
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      localStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(authData.token)});
      sessionStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(authData.token)});
      localStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
      sessionStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
      localStorage.setItem("sai_ajanta_admin_theme", "light");
    })()`,
  });

  const report = [];

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });
      await client.send("Page.navigate", { url: `${ADMIN_URL}${route.path}` });
      // Wait for page heading and skeleton completion (up to 6s)
      for (let w = 0; w < 20; w++) {
        await sleep(300);
        const readyRes = await client.send("Runtime.evaluate", {
          expression: `Boolean(document.querySelector('h3') && !document.querySelector('.ant-skeleton'))`,
          returnByValue: true,
        });
        if (readyRes.result?.value) {
          await sleep(350);
          break;
        }
      }

      const metricsRes = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const clientW = window.innerWidth;
          const hasAntd = Boolean(document.querySelector('[class*="ant-"]'));
          const hasMui = Boolean(document.querySelector('[class*="Mui"]'));
          const hTitle = document.querySelector('h3, h2, h1')?.innerText || '';
          return {
            scrollW,
            clientW,
            overflow: scrollW > clientW + 2,
            hasAntd,
            hasMui,
            hTitle,
          };
        })()`,
        returnByValue: true,
      });

      const m = metricsRes.result?.value || {};
      const filename = `${route.id}-${vp.key}-antd.png`;
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(shot.data, "base64"));

      const status = !m.overflow && m.hasAntd && !m.hasMui ? "PASS" : "CHECK";
      report.push({ route: route.path, viewport: vp.key, ...m, status, filename });
      console.log(
        `[${status}] ${route.id} (${vp.key} ${vp.width}px) | scrollW=${m.scrollW}/${m.clientW} | antd=${m.hasAntd} | mui=${m.hasMui} | title="${m.hTitle}"`
      );
    }
  }

  fs.writeFileSync(
    path.resolve("docs/admin-ant-design/ANTD_VISUAL_QA_METRICS.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), consoleErrors: client.consoleErrors, report }, null, 2)
  );

  const failed = report.filter((r) => r.status !== "PASS");
  console.log(`\n=== SUMMARY: ${report.length - failed.length}/${report.length} PASS | Runtime Exceptions: ${client.consoleErrors.length} ===`);
  if (client.consoleErrors.length > 0) {
    console.log("Exceptions:", client.consoleErrors);
  }

  client.close();
  chrome.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
