import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const BASE_URL = "http://localhost:3000";

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

async function measure() {
  console.log("=== RUNNING HOMEPAGE PERFORMANCE & RESOURCE MEASUREMENT ===");
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
    await client.send("Performance.enable");

    // Set mobile viewport to measure mobile performance under standard constraints
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    console.log("Navigating to homepage...");
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(3500);

    // 1. Navigation Timing Metrics
    const navTiming = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const [nav] = performance.getEntriesByType('navigation');
          if (!nav) return null;
          return {
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            domInteractive: Math.round(nav.domInteractive),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
            loadComplete: Math.round(nav.loadEventEnd),
            duration: Math.round(nav.duration)
          };
        })()
      `,
      returnByValue: true,
    });

    // 2. Paint & Core Web Vitals Timing
    const paintMetrics = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const paints = performance.getEntriesByType('paint');
          const fp = paints.find(p => p.name === 'first-paint');
          const fcp = paints.find(p => p.name === 'first-contentful-paint');
          return {
            firstPaint: fp ? Math.round(fp.startTime) : null,
            firstContentfulPaint: fcp ? Math.round(fcp.startTime) : null
          };
        })()
      `,
      returnByValue: true,
    });

    // 3. Resource Transfer Breakdown
    const resources = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const entries = performance.getEntriesByType('resource');
          let jsBytes = 0, imgBytes = 0, cssBytes = 0, otherBytes = 0;
          let jsCount = 0, imgCount = 0, cssCount = 0, otherCount = 0;

          entries.forEach(e => {
            const size = e.transferSize || e.encodedBodySize || 0;
            if (e.initiatorType === 'script') {
              jsBytes += size; jsCount++;
            } else if (e.initiatorType === 'img' || e.name.match(/\\.(png|jpg|jpeg|webp|svg)/i)) {
              imgBytes += size; imgCount++;
            } else if (e.initiatorType === 'css' || e.name.includes('.css')) {
              cssBytes += size; cssCount++;
            } else {
              otherBytes += size; otherCount++;
            }
          });

          return {
            totalResources: entries.length,
            scripts: { count: jsCount, bytes: jsBytes, kb: (jsBytes / 1024).toFixed(1) },
            images: { count: imgCount, bytes: imgBytes, kb: (imgBytes / 1024).toFixed(1) },
            styles: { count: cssCount, bytes: cssBytes, kb: (cssBytes / 1024).toFixed(1) },
            totalTransferKb: ((jsBytes + imgBytes + cssBytes + otherBytes) / 1024).toFixed(1)
          };
        })()
      `,
      returnByValue: true,
    });

    // 4. CDP Engine Metrics
    const cdpMetrics = await client.send("Performance.getMetrics");
    const m = {};
    cdpMetrics.metrics.forEach((item) => {
      m[item.name] = item.value;
    });

    console.log("\n--- NAVIGATION & CORE TIMINGS ---");
    console.log(`  TTFB (Time to First Byte):       ${navTiming.result.value?.ttfb ?? 'N/A'} ms`);
    console.log(`  First Contentful Paint (FCP):    ${paintMetrics.result.value?.firstContentfulPaint ?? 'N/A'} ms`);
    console.log(`  DOM Content Loaded (DCL):        ${navTiming.result.value?.domContentLoaded ?? 'N/A'} ms`);
    console.log(`  Full Page Load Complete:        ${navTiming.result.value?.loadComplete ?? 'N/A'} ms`);

    console.log("\n--- RESOURCE TRANSFER BREAKDOWN ---");
    const r = resources.result.value;
    console.log(`  Total Resources Loaded:          ${r.totalResources}`);
    console.log(`  Scripts Transfer:               ${r.scripts.count} files, ${r.scripts.kb} KB`);
    console.log(`  Images Transfer:                ${r.images.count} files, ${r.images.kb} KB`);
    console.log(`  Stylesheets Transfer:           ${r.styles.count} files, ${r.styles.kb} KB`);
    console.log(`  Total Estimated Transfer:       ${r.totalTransferKb} KB`);

    console.log("\n--- DOM & LAYOUT ENGINE METRICS ---");
    console.log(`  Total DOM Nodes:                 ${m.Nodes}`);
    console.log(`  JS Heap Used:                    ${(m.JSHeapUsedSize / (1024 * 1024)).toFixed(2)} MB / ${(m.JSHeapTotalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Layout Count:                    ${m.LayoutCount}`);
    console.log(`  Layout Duration:                 ${(m.LayoutDuration * 1000).toFixed(2)} ms`);
    console.log(`  Recalc Style Duration:           ${(m.RecalcStyleDuration * 1000).toFixed(2)} ms`);

    client.close();
  } finally {
    chromeProc.kill();
  }
}

measure().catch((err) => {
  console.error("Measurement error:", err);
  process.exit(1);
});
