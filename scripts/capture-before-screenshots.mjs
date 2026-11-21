import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "D:\\Sai_Ajantha_Archive\\ui_screenshots\\before";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
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

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const pages = await res.json();
        if (pages.length > 0 && pages[0].webSocketDebuggerUrl) {
          return pages[0].webSocketDebuggerUrl;
        }
      }
    } catch {}
    await sleep(300);
  }
  throw new Error("Failed to connect to Chrome remote debugging port.");
}

const ROUTES = [
  { name: "homepage_baseline", path: "/" },
  { name: "account_customer", path: "/account" },
  { name: "dealer_portal", path: "/dealer" },
  { name: "distributor_portal", path: "/distributor" },
  { name: "products_catalog", path: "/products" },
  { name: "cart_page", path: "/cart" },
  { name: "checkout_page", path: "/checkout" },
  { name: "login_page", path: "/login" },
  { name: "register_page", path: "/register" },
  { name: "orders_page", path: "/orders" },
  { name: "quotes_page", path: "/quotes" },
  { name: "wishlist_page", path: "/wishlist" },
  { name: "search_page", path: "/search" },
  { name: "about_page", path: "/about" },
  { name: "contact_page", path: "/contact" },
  { name: "solutions_page", path: "/solutions" },
  { name: "projects_page", path: "/projects" },
  { name: "blogs_page", path: "/blogs" },
  { name: "installation_page", path: "/installation" },
  { name: "privacy_policy", path: "/privacy-policy" }
];

async function main() {
  console.log("Launching headless Chrome on port " + PORT + "...");
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "about:blank",
  ]);

  try {
    const wsUrl = await getDebuggerUrl();
    console.log("Connected to Chrome via CDP:", wsUrl);
    const cdp = new CDPClient(wsUrl);
    await cdp.connect();

    await cdp.send("Page.enable");
    await cdp.send("DOM.enable");

    for (const r of ROUTES) {
      console.log(`Capturing: ${r.name} (${r.path})...`);

      // 1440px desktop
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Page.navigate", { url: `${BASE_URL}${r.path}` });
      await sleep(1500);

      const desktopShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${r.name}_1440px.png`),
        Buffer.from(desktopShot.data, "base64")
      );

      // 375px mobile
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await sleep(800);

      const mobileShot = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        path.join(OUTPUT_DIR, `${r.name}_375px.png`),
        Buffer.from(mobileShot.data, "base64")
      );
    }

    cdp.close();
    console.log(`\nAll before screenshots captured successfully in ${OUTPUT_DIR}`);
  } finally {
    chromeProc.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
