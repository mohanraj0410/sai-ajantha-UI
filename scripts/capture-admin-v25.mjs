import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9266;
const ADMIN_URL = "http://localhost:7001";
const OUT_DIR = path.resolve("docs/screenshots/admin-v25-after");

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

  send(method, params = {}, timeoutMs = 15000) {
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

// Primary 16 routes + Critical nested & error routes (QA-V25-01 full transparent accounting)
const ROUTES = [
  { id: "01-dashboard", path: "/dashboard", tier: "critical", darkBoth: true },
  { id: "02-orders", path: "/orders", tier: "critical", darkBoth: true },
  { id: "03-quotes", path: "/quotes", tier: "standard" },
  { id: "04-enquiries", path: "/enquiries", tier: "standard" },
  { id: "05-products", path: "/products", tier: "critical", darkBoth: true },
  { id: "06-product-new", path: "/products/new", tier: "critical" },
  { id: "07-categories", path: "/categories", tier: "standard" },
  { id: "08-inventory", path: "/inventory", tier: "standard" },
  { id: "09-pricing", path: "/pricing", tier: "standard" },
  { id: "10-customers", path: "/customers", tier: "standard" },
  { id: "11-dealers", path: "/dealers", tier: "standard" },
  { id: "12-distributors", path: "/distributors", tier: "standard" },
  { id: "13-seller-coverage", path: "/seller-coverage", tier: "standard" },
  { id: "14-reports", path: "/reports", tier: "critical" },
  { id: "15-settings", path: "/settings", tier: "critical" },
  { id: "16-returns", path: "/returns", tier: "standard" },
  // Critical nested & error views explicitly verified (QA-V25-01)
  { id: "17-product-import", path: "/products/import", tier: "nested" },
  { id: "18-floor-spring-detail", path: "/products/SA-I-FS-TON90-007", tier: "nested" },
  { id: "19-dealer-approvals", path: "/dealers/approvals", tier: "nested" },
  { id: "20-settings-staff", path: "/settings/staff", tier: "nested" },
  { id: "21-settings-audit", path: "/settings/audit-log", tier: "nested" },
  { id: "22-access-denied-403", path: "/403", tier: "error" },
  { id: "23-not-found-404", path: "/unknown-qa-route", tier: "error" },
];

const CORE_VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900, mobile: false },
  { key: "tablet", width: 768, height: 1024, mobile: false },
  { key: "mobile", width: 390, height: 844, mobile: true },
];

const EXTRA_VIEWPORTS = [
  { key: "xs320", width: 320, height: 740, mobile: true },
  { key: "lap1024", width: 1024, height: 900, mobile: false },
  { key: "wide1920", width: 1920, height: 1080, mobile: false },
];

async function waitForPageReady(client) {
  for (let w = 0; w < 30; w++) {
    await sleep(250);
    const readyRes = await client.send("Runtime.evaluate", {
      expression: `Boolean((document.querySelector('h3, h4, .ant-result-title')) && !document.querySelector('.ant-skeleton') && !document.querySelector('.ant-spin-spinning'))`,
      returnByValue: true,
    });
    if (readyRes.result?.value) {
      await sleep(300);
      return;
    }
  }
}

async function inspectAndCapture(client, route, vp, themeMode = "light") {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.mobile,
  });

  await client.send("Runtime.evaluate", {
    expression: `localStorage.setItem("sai_ajanta_admin_theme", ${JSON.stringify(themeMode)});`,
  });

  await client.send("Page.navigate", { url: `${ADMIN_URL}${route.path}` });
  await waitForPageReady(client);

  const metricsRes = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const clientW = window.innerWidth;
      const hasAntd = Boolean(document.querySelector('[class*="ant-"]'));
      const hasMui = Boolean(document.querySelector('[class*="Mui"]'));
      const breadcrumbNav = document.querySelector('nav[aria-label="Breadcrumb"]');
      const hasBreadcrumb = Boolean(breadcrumbNav);
      const breadcrumbText = breadcrumbNav ? breadcrumbNav.innerText.replace(/\\s+/g, ' ').trim() : '';
      const hTitle = document.querySelector('h3, h4, .ant-result-title')?.innerText?.trim() || '';
      const docTitle = document.title;

      let sidebarBottom = null;
      let sidebarClipped = false;
      const siderItems = document.querySelectorAll('.sa-admin-sider .ant-menu-item');
      if (window.innerWidth >= 992 && siderItems.length > 0) {
        const lastRect = siderItems[siderItems.length - 1].getBoundingClientRect();
        sidebarBottom = Math.round(lastRect.bottom);
        sidebarClipped = lastRect.bottom > window.innerHeight;
      }

      const sidebarBadges = document.querySelectorAll('[data-testid^="sidebar-count-"]').length;
      const chartCount = document.querySelectorAll('.recharts-wrapper svg').length;

      return {
        scrollW,
        clientW,
        overflow: scrollW > clientW + 2,
        hasAntd,
        hasMui,
        hasBreadcrumb,
        breadcrumbText,
        docTitle,
        hTitle,
        sidebarBottom,
        sidebarClipped,
        sidebarBadges,
        chartCount,
      };
    })()`,
    returnByValue: true,
  });

  const m = metricsRes.result?.value || {};
  const suffix = themeMode === "dark" ? "-dark" : "";
  const filename = `${route.id}-${vp.key}${suffix}-v25.png`;
  const shot = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(shot.data, "base64"));

  const status =
    !m.overflow &&
    m.hasAntd &&
    !m.hasMui &&
    m.hasBreadcrumb &&
    !m.sidebarClipped &&
    Boolean(m.docTitle)
      ? "PASS"
      : "CHECK";

  console.log(
    `[${status}] ${route.id} (${vp.key} ${vp.width}px${suffix}) | scrollW=${m.scrollW}/${m.clientW} | crumb="${m.breadcrumbText}" | siderB=${m.sidebarBottom ?? "-"} | charts=${m.chartCount}`
  );

  return {
    route: route.path,
    tier: route.tier,
    viewport: vp.key,
    width: vp.width,
    theme: themeMode,
    ...m,
    status,
    filename,
  };
}

async function main() {
  let authData = null;
  for (let i = 1; i <= 20; i++) {
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
    await sleep(1500);
  }
  if (!authData?.token) throw new Error("Admin login failed.");

  const meRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${authData.token}` },
  });
  const meData = await meRes.json();
  const staff = meData.staff;

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

  // Capture Login Screen on Desktop & Mobile
  for (const vp of [CORE_VIEWPORTS[0], CORE_VIEWPORTS[2]]) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await client.send("Page.navigate", { url: `${ADMIN_URL}/login` });
    await sleep(1000);
    const loginShot = await client.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT_DIR, `00-login-${vp.key}-v25.png`), Buffer.from(loginShot.data, "base64"));
  }

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
    if (route.tier === "critical") {
      // All 6 viewports for critical routes
      for (const vp of [...CORE_VIEWPORTS, ...EXTRA_VIEWPORTS]) {
        report.push(await inspectAndCapture(client, route, vp, "light"));
      }
    } else if (route.tier === "standard") {
      // Desktop 1440 + Tablet 768 + Mobile 390
      for (const vp of CORE_VIEWPORTS) {
        report.push(await inspectAndCapture(client, route, vp, "light"));
      }
    } else {
      // Nested & error routes: Desktop 1440 + Mobile 390
      report.push(await inspectAndCapture(client, route, CORE_VIEWPORTS[0], "light"));
      report.push(await inspectAndCapture(client, route, CORE_VIEWPORTS[2], "light"));
    }

    if (route.darkBoth) {
      // Dark Mode at BOTH Desktop 1440px AND Mobile 390px (QA-V25-01)
      report.push(await inspectAndCapture(client, route, CORE_VIEWPORTS[0], "dark"));
      report.push(await inspectAndCapture(client, route, CORE_VIEWPORTS[2], "dark"));
    }
  }

  await client.send("Runtime.evaluate", {
    expression: `localStorage.setItem("sai_ajanta_admin_theme", "light");`,
  });

  fs.writeFileSync(
    path.resolve("docs/admin-ant-design/ADMIN_V25_QA_METRICS.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), consoleErrors: client.consoleErrors, report }, null, 2)
  );

  const failed = report.filter((r) => r.status !== "PASS");
  console.log(
    `\n=== QA-V25 VISUAL MATRIX SUMMARY: ${report.length - failed.length}/${report.length} PASS | Runtime Exceptions: ${client.consoleErrors.length} ===`
  );
  if (failed.length > 0) {
    console.log("Items to inspect:", failed.map((f) => `${f.filename} (overflow=${f.overflow}, crumb=${f.hasBreadcrumb}, siderClip=${f.sidebarClipped})`));
  }

  client.close();
  chrome.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
