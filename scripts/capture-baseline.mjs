import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), "docs/screenshots/baseline");

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

async function capture() {
  console.log("Launching headless Chrome...");
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
    console.log("Connected to Chrome CDP at", wsUrl);
    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    // Helper to evaluate script
    const evaluate = async (expression) => {
      return await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
    };

    // Helper to scroll page and trigger lazy images
    const triggerLazyImages = async () => {
      await evaluate(`
        (async () => {
          const totalHeight = document.body.scrollHeight;
          let current = 0;
          const step = 600;
          while (current < totalHeight) {
            window.scrollBy(0, step);
            current += step;
            await new Promise(r => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
          await new Promise(r => setTimeout(r, 600));
        })()
      `);
    };

    // Helper to take screenshot
    const takeScreenshot = async (filePath, fullPage = false) => {
      let params = { format: "png" };
      if (fullPage) {
        await triggerLazyImages();
        const metrics = await client.send("Page.getLayoutMetrics");
        const { width, height } = metrics.contentSize;
        params = {
          format: "png",
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width, height, scale: 1 },
        };
      }
      const result = await client.send("Page.captureScreenshot", params);
      fs.writeFileSync(filePath, Buffer.from(result.data, "base64"));
      console.log(`Saved: ${filePath}`);
    };

    // 1. DESKTOP VIEWPORT: 1440 x 900
    console.log("Navigating to desktop homepage (1440x900)...");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2500);

    // Hero 01 Overview Desktop
    await takeScreenshot(path.join(OUTPUT_DIR, "hero-overview-desktop.png"));

    // Click 02 Promise button
    console.log("Switching to 02 Promise state...");
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const promiseBtn = btns.find(b => b.textContent && b.textContent.includes('02 Promise'));
        if (promiseBtn) {
          promiseBtn.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(1500);
    // Hero 02 Promise Desktop
    await takeScreenshot(path.join(OUTPUT_DIR, "hero-promise-desktop.png"));

    // Click back to 01 Overview
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const overviewBtn = btns.find(b => b.textContent && b.textContent.includes('01 Overview'));
        if (overviewBtn) {
          overviewBtn.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(1000);

    // Full page desktop screenshot with lazy images triggered
    console.log("Capturing full-page desktop screenshot...");
    await takeScreenshot(path.join(OUTPUT_DIR, "homepage-full-desktop.png"), true);

    // 2. MOBILE VIEWPORT: 390 x 844 (iPhone 14)
    console.log("Switching to mobile viewport (390x844)...");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2500);

    // Hero 01 Overview Mobile
    await takeScreenshot(path.join(OUTPUT_DIR, "hero-overview-mobile.png"));

    // Click 02 Promise button on mobile
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const promiseBtn = btns.find(b => b.textContent && b.textContent.includes('02 Promise'));
        if (promiseBtn) {
          promiseBtn.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(1500);
    // Hero 02 Promise Mobile
    await takeScreenshot(path.join(OUTPUT_DIR, "hero-promise-mobile.png"));

    // Full page mobile screenshot with lazy images triggered
    console.log("Capturing full-page mobile screenshot...");
    await takeScreenshot(path.join(OUTPUT_DIR, "homepage-full-mobile.png"), true);

    client.close();
    console.log("Baseline capture complete!");
  } finally {
    chromeProc.kill();
  }
}

capture().catch((err) => {
  console.error("Error during capture:", err);
  process.exit(1);
});
