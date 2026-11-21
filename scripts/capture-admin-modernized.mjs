import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9260;
const ADMIN_URL = "http://localhost:7001";
const OUT_DIR = path.resolve("docs/screenshots/admin-modernized");

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
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
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
          rej(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
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
  throw new Error("Could not connect to Chrome debugging port");
}

async function main() {
  console.log("Acquiring admin session...");
  let token = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const authRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
      });
      const authData = await authRes.json();
      if (authData.token) {
        token = authData.token;
        console.log(`Authenticated on attempt ${attempt}`);
        break;
      }
      console.log(`Waiting for backend boot (attempt ${attempt}): ${authData.message || JSON.stringify(authData)}`);
    } catch (e) {
      console.log(`Fetch error (attempt ${attempt}): ${e.message}`);
    }
    await sleep(2000);
  }
  if (!token) throw new Error("Could not authenticate admin after 15 attempts");

  console.log("Fetching staff profile...");
  const meRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meData = await meRes.json();
  const staffProfile = meData.staff;

  console.log(`Launching headless Chrome on port ${CDP_PORT}...`);
  const userDataDir = path.resolve(`C:/Windows/Temp/sai-ajanta-modernized-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  try {
    const wsUrl = await getDebuggerUrl();
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    // Establish origin and inject auth tokens
    await client.send("Page.navigate", { url: `${ADMIN_URL}/login` });
    await sleep(800);

    await client.send("Runtime.evaluate", {
      expression: `
        localStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(token)});
        sessionStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(token)});
        localStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staffProfile))});
        sessionStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staffProfile))});
      `,
    });

    const routes = [
      { path: "/dashboard", name: "01-dashboard" },
      { path: "/orders", name: "02-orders" },
      { path: "/quotes", name: "03-quotes" },
      { path: "/enquiries", name: "04-enquiries" },
      { path: "/products", name: "05-products" },
      { path: "/products/new", name: "06-product-new" },
      { path: "/categories", name: "07-categories" },
      { path: "/inventory", name: "08-inventory" },
      { path: "/pricing", name: "09-pricing" },
      { path: "/customers", name: "10-customers" },
      { path: "/dealers", name: "11-dealers" },
      { path: "/distributors", name: "12-distributors" },
      { path: "/seller-coverage", name: "13-seller-coverage" },
      { path: "/reports", name: "14-reports" },
      { path: "/settings", name: "15-settings" },
    ];

    const viewports = [
      { name: "desktop", width: 1440, height: 900, mobile: false },
      { name: "tablet", width: 768, height: 1024, mobile: false },
      { name: "mobile", width: 390, height: 844, mobile: true },
    ];

    const overflowViolations = [];
    let savedCount = 0;

    for (const vp of viewports) {
      console.log(`\n--- Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      });

      for (const r of routes) {
        try {
          await client.send("Page.navigate", { url: `${ADMIN_URL}${r.path}` });
          await sleep(750);

          // Measure horizontal overflow
          const evalRes = await client.send("Runtime.evaluate", {
            expression: `
              ({
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                hasOverflow: document.documentElement.scrollWidth > window.innerWidth
              })
            `,
            returnByValue: true,
          });

          const overflowInfo = evalRes.result?.value;
          if (overflowInfo?.hasOverflow) {
            overflowViolations.push({
              route: r.path,
              viewport: vp.name,
              scrollWidth: overflowInfo.scrollWidth,
              innerWidth: overflowInfo.innerWidth,
            });
          }

          const { data } = await client.send("Page.captureScreenshot", { format: "png" });
          const filename = `${r.name}-${vp.name}-modernized.png`;
          fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.from(data, "base64"));
          savedCount++;
          console.log(`[${savedCount}/45] Saved ${filename} (scrollWidth: ${overflowInfo?.scrollWidth || 0}px / ${vp.width}px)`);
        } catch (err) {
          console.error(`Failed to capture ${r.name} on ${vp.name}:`, err.message);
        }
      }
    }

    console.log("\n=========================================");
    console.log(`Total Modernized Screenshots Captured: ${savedCount}/45`);
    if (overflowViolations.length > 0) {
      console.warn("Horizontal overflow warnings:", overflowViolations);
    } else {
      console.log("Responsive Verification: PASSED! Zero horizontal page scrollbar violations across all viewports!");
    }
    console.log("=========================================\n");

    client.close();
  } finally {
    try {
      chromeProc.kill("SIGKILL");
    } catch {}
  }
}

main().catch((err) => {
  console.error("Modernized capture fatal error:", err);
  process.exit(1);
});
