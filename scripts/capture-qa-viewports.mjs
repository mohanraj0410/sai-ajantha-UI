import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const BASE_URL = "http://localhost:3000";
const QA_DIR = path.resolve(process.cwd(), "docs/screenshots/qa");

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
  { name: "mobile-375", width: 375, height: 667, scale: 2, mobile: true },
  { name: "mobile-390", width: 390, height: 844, scale: 2, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, scale: 2, mobile: true },
  { name: "desktop-1024", width: 1024, height: 768, scale: 1, mobile: false },
  { name: "desktop-1440", width: 1440, height: 900, scale: 1, mobile: false },
  { name: "desktop-1920", width: 1920, height: 1080, scale: 1, mobile: false },
];

async function run() {
  console.log("Starting Chrome for multi-viewport QA captures...");
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

    const triggerLazyImages = async () => {
      await evaluate(`
        (async () => {
          const totalHeight = document.body.scrollHeight;
          const step = 600;
          for (let y = 0; y < totalHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 80));
          }
          window.scrollTo(0, 0);
        })()
      `);
      await sleep(1000);
    };

    console.log("=== MULTI-VIEWPORT RESPONSIVE & HORIZONTAL OVERFLOW CHECK ===");
    const results = [];

    for (const vp of VIEWPORTS) {
      console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.scale,
        mobile: vp.mobile,
      });

      await client.send("Page.navigate", { url: BASE_URL });
      await sleep(2000);
      await triggerLazyImages();

      // Check overflow metrics
      const overflowMetrics = await evaluate(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = docEl.clientWidth;
          const hasHorizontalOverflow = scrollWidth > clientWidth;
          return {
            clientWidth,
            scrollWidth,
            hasHorizontalOverflow,
            delta: scrollWidth - clientWidth
          };
        })()
      `);

      console.log(`  Client Width: ${overflowMetrics.clientWidth}px`);
      console.log(`  Scroll Width: ${overflowMetrics.scrollWidth}px`);
      console.log(`  Horizontal Overflow: ${overflowMetrics.hasHorizontalOverflow ? `YES (+${overflowMetrics.delta}px)` : "NONE (Pass)"}`);

      // Capture full-page screenshot
      const metrics = await client.send("Page.getLayoutMetrics");
      const contentHeight = Math.ceil(metrics.contentSize.height);

      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: contentHeight,
        deviceScaleFactor: vp.scale,
        mobile: vp.mobile,
      });

      const { data } = await client.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });

      const filePath = path.join(QA_DIR, `fullpage-${vp.width}px.png`);
      fs.writeFileSync(filePath, Buffer.from(data, "base64"));
      console.log(`  Screenshot saved: ${filePath}`);

      results.push({
        ...vp,
        ...overflowMetrics,
        file: filePath,
      });
    }

    client.close();
    console.log("\n=== MULTI-VIEWPORT SUMMARY ===");
    console.table(results.map(r => ({
      Viewport: `${r.width}px`,
      Type: r.mobile ? 'Mobile/Tablet' : 'Desktop',
      ClientWidth: `${r.clientWidth}px`,
      ScrollWidth: `${r.scrollWidth}px`,
      Overflow: r.hasHorizontalOverflow ? `FAIL (+${r.delta}px)` : 'PASS'
    })));

  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
