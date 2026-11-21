import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const QA_DIR = path.resolve(process.cwd(), "docs/screenshots/qa-final");

fs.mkdirSync(QA_DIR, { recursive: true });

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
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Could not connect to Chrome debugging port");
}

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 640, scale: 2, mobile: true },
  { name: "mobile-390", width: 390, height: 844, scale: 2, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, scale: 2, mobile: true },
  { name: "desktop-1024", width: 1024, height: 768, scale: 1, mobile: false },
  { name: "desktop-1440", width: 1440, height: 900, scale: 1, mobile: false },
];

const TARGETS = [
  // Storefront Homepage across all 5 viewports
  { url: "http://localhost:3000/", name: "storefront-home", viewports: ["mobile-320", "mobile-390", "tablet-768", "desktop-1024", "desktop-1440"] },
  // Core Storefront Pages at mobile-390 and desktop-1440
  { url: "http://localhost:3000/products", name: "storefront-products", viewports: ["mobile-390", "tablet-768", "desktop-1440"] },
  { url: "http://localhost:3000/products/prod-001", name: "storefront-pdp", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/cart", name: "storefront-cart", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/dealer", name: "storefront-dealer-portal", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/distributor", name: "storefront-distributor-portal", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/solutions", name: "storefront-solutions", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/solutions/residential-screens-and-door-control", name: "storefront-solution-detail", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/projects", name: "storefront-projects", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/projects/residential-apartment-screens-and-hardware", name: "storefront-project-detail", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/about", name: "storefront-about", viewports: ["mobile-390", "desktop-1440"] },
  { url: "http://localhost:3000/contact", name: "storefront-contact", viewports: ["mobile-390", "desktop-1440"] },
  // MUI Admin Pages
  { url: "http://localhost:7001/dashboard", name: "admin-dashboard", viewports: ["mobile-390", "tablet-768", "desktop-1440"] },
  { url: "http://localhost:7001/products", name: "admin-products", viewports: ["mobile-390", "tablet-768", "desktop-1440"] },
  { url: "http://localhost:7001/products/new", name: "admin-product-new", viewports: ["mobile-390", "tablet-768", "desktop-1440"] },
];

async function run() {
  console.log("=============================================================");
  console.log("Sai Ajantha Final Multi-Viewport Visual QA Capture");
  console.log("=============================================================\n");

  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
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

    const evaluate = async (expression) => {
      const res = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    };

    const results = [];

    for (const target of TARGETS) {
      console.log(`\nCapturing: ${target.name} (${target.url})...`);
      for (const vpName of target.viewports) {
        const vp = VIEWPORTS.find((v) => v.name === vpName);
        if (!vp) continue;

        await client.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.scale,
          mobile: vp.mobile,
        });

        await client.send("Page.navigate", { url: target.url });
        await sleep(1500);

        // Check horizontal overflow
        const overflow = await evaluate(`
          (() => {
            const docEl = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
            const clientWidth = docEl.clientWidth;
            return {
              clientWidth,
              scrollWidth,
              hasHorizontalOverflow: scrollWidth > clientWidth,
              delta: scrollWidth - clientWidth
            };
          })()
        `);

        // Capture screenshot
        const { data } = await client.send("Page.captureScreenshot", { format: "png" });
        const filename = `${target.name}-${vp.name}.png`;
        const filepath = path.join(QA_DIR, filename);
        fs.writeFileSync(filepath, Buffer.from(data, "base64"));
        console.log(`  [${vp.name}] Overflow: ${overflow?.hasHorizontalOverflow ? `FAIL (+${overflow.delta}px)` : "PASS"} -> Saved: ${filename}`);

        results.push({
          target: target.name,
          url: target.url,
          viewport: vp.name,
          width: vp.width,
          hasHorizontalOverflow: overflow?.hasHorizontalOverflow || false,
          file: filename,
        });
      }
    }

    client.close();
    console.log("\n=============================================================");
    console.log(`TOTAL SCREENSHOTS CAPTURED: ${results.length}`);
    const overflowFails = results.filter((r) => r.hasHorizontalOverflow);
    console.log(`HORIZONTAL OVERFLOW VIOLATIONS: ${overflowFails.length}`);
    console.log("=============================================================\n");
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
