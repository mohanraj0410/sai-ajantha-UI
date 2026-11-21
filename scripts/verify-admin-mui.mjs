import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9226;
const ADMIN_URL = "http://localhost:7001";
const OUT_DIR = path.resolve("docs/screenshots/admin-mui-after");

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
          const d = msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text;
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
  close() {
    if (this.ws) this.ws.close();
  }
}

async function getWsUrl() {
  for (let i = 0; i < 25; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
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

async function main() {
  console.log("=== 1. VITE PROXY & BACKEND HTTP SECURITY BOUNDARY CHECKS ===");
  // Unauthenticated backend admin routes via Vite proxy must return JSON 401/403 (never HTML!)
  for (const apiPath of [
    "/admin/sai-ajanta/portal",
    "/admin/sai-ajanta/overview",
    "/admin/sai-ajanta/analytics",
    "/admin/sai-ajanta/orders",
  ]) {
    const res = await fetch(`${ADMIN_URL}${apiPath}`);
    const ct = res.headers.get("content-type") || "";
    check(res.status === 401 || res.status === 403, `GET ${ADMIN_URL}${apiPath} blocked (${res.status})`);
    check(ct.includes("application/json"), `GET ${ADMIN_URL}${apiPath} returns JSON via proxy, not SPA HTML (${ct})`);
  }

  // Invalid credentials rejected by /auth/user/emailpass
  const badAuthRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid@example.com", password: "wrongpassword123" }),
  });
  check(badAuthRes.status === 401 || badAuthRes.status === 400, `POST /auth/user/emailpass rejects invalid credentials (${badAuthRes.status})`);

  console.log("\n=== 2. HEADLESS CHROME ROUTING, MUI CONTROLS & RESPONSIVE QA ===");
  const userDataDir = path.resolve("C:/Windows/Temp/sai-ajanta-admin-mui-cdp");
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

    const setVp = async (width, height) => {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
    };

    const evalPage = async (url, waitMs = 1200) => {
      await client.send("Page.navigate", { url });
      await sleep(waitMs);
      const r = await client.send("Runtime.evaluate", {
        expression: `({
          href: window.location.href,
          pathname: window.location.pathname,
          search: window.location.search,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          text: document.body.innerText,
          hasMuiRoot: Boolean(document.querySelector(".MuiCard-root, .MuiButton-root, .MuiTextField-root")),
          nativeInputsOutsideHidden: document.querySelectorAll("input:not([hidden]):not(.MuiInputBase-input):not(.PrivateSwitchBase-input)").length,
          nativeSelects: document.querySelectorAll("select").length,
        })`,
        returnByValue: true,
      });
      return r.result?.value || {};
    };

    const capture = async (name) => {
      const { data } = await client.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(data, "base64"));
    };

    // A) Desktop 1440x900: Verify unauthenticated deep link redirects cleanly with encoded ?redirect=
    await setVp(1440, 900);
    for (const deepUrl of [
      "/dashboard",
      "/products/sku-123/edit",
      "/orders/ord-999",
      "/dealers/approvals",
      "/settings/roles",
      "/nonexistent-route",
    ]) {
      const p = await evalPage(`${ADMIN_URL}${deepUrl}`, 900);
      check(p.pathname === "/login", `Unauthenticated ${deepUrl} redirects to /login (got ${p.pathname}${p.search})`);
      check(p.hasMuiRoot, `Redirect target on ${deepUrl} renders MUI components properly`);
    }

    // B) Verify /login MUI controls, RHF/Zod validation & server rejection
    const loginPage = await evalPage(`${ADMIN_URL}/login`, 1000);
    check(loginPage.hasMuiRoot, "/login renders MUI Card, TextField & Button");
    check(loginPage.nativeInputsOutsideHidden === 0, `/login has 0 non-MUI text inputs (${loginPage.nativeInputsOutsideHidden})`);
    check(loginPage.nativeSelects === 0, `/login has 0 raw <select> elements`);
    check(loginPage.scrollWidth <= loginPage.clientWidth + 2, `[1440] /login no horizontal overflow (${loginPage.scrollWidth} <= ${loginPage.clientWidth})`);
    await capture("admin-mui-login-desktop.png");

    // Trigger empty submit validation
    await client.send("Runtime.evaluate", {
      expression: `document.querySelector("button[type='submit']")?.click()`,
    });
    await sleep(400);
    const valRes = await client.send("Runtime.evaluate", {
      expression: `document.body.innerText`,
      returnByValue: true,
    });
    check(
      String(valRes.result?.value || "").includes("valid staff administrator email"),
      "RHF + Zod empty submit shows MUI TextField validation helper text"
    );

    // Trigger forgot-password route
    const fp = await evalPage(`${ADMIN_URL}/forgot-password`, 800);
    check(fp.pathname === "/forgot-password" && fp.text.includes("BACKEND_BLOCKED"), "/forgot-password renders honest BACKEND_BLOCKED alert");
    await capture("admin-mui-forgot-password-desktop.png");

    // Responsive check across 1920, 768, 390, 320 on /login and /forgot-password
    for (const [w, h, tag] of [
      [1920, 1080, "1920"],
      [768, 1024, "768-tablet"],
      [390, 844, "390-mobile"],
      [320, 700, "320-mobile"],
    ]) {
      await setVp(w, h);
      const mLogin = await evalPage(`${ADMIN_URL}/login`, 700);
      check(mLogin.scrollWidth <= mLogin.clientWidth + 2, `[${tag}] /login fits cleanly (${mLogin.scrollWidth} <= ${mLogin.clientWidth})`);
      if (tag === "768-tablet") await capture("admin-mui-login-tablet.png");
      if (tag === "390-mobile") await capture("admin-mui-login-mobile.png");
    }

    // Toggle dark mode test & screenshot
    await setVp(1440, 900);
    await evalPage(`${ADMIN_URL}/login`, 700);
    await client.send("Runtime.evaluate", {
      expression: `document.querySelector("button[aria-label='Toggle theme mode']")?.click()`,
    });
    await sleep(400);
    await capture("admin-mui-login-dark-desktop.png");

    check(client.pageExceptions.length === 0, `Zero uncaught JS exceptions in Chrome (${client.pageExceptions.length})`);
    if (client.pageExceptions.length > 0) console.error(client.pageExceptions);

    client.close();
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  console.log(`\n========================================================`);
  console.log(`ADMIN MUI VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`Screenshots saved to: ${OUT_DIR}`);
  console.log(`========================================================`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
