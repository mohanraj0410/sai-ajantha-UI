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
    } catch {}
    await sleep(500);
  }
  throw new Error("Could not find Chrome debugger WebSocket URL");
}

async function run() {
  let chromeProc = null;
  let wsUrl = null;

  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await res.json();
    if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
      wsUrl = list[0].webSocketDebuggerUrl;
    }
  } catch {
    console.log("Spawning fresh Chrome headless...");
    chromeProc = spawn(CHROME_PATH, [
      `--remote-debugging-port=${PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "about:blank",
    ]);
    wsUrl = await getDebuggerUrl();
  }

  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  const targets = [
    {
      name: "storefront-pdp",
      url: "http://localhost:3000/products/prod-001",
      shotName: "storefront-pdp-mobile-390.png",
    },
    {
      name: "storefront-project-detail",
      url: "http://localhost:3000/projects/residential-apartment-screens-and-hardware",
      shotName: "storefront-project-detail-mobile-390.png",
    },
  ];

  const results = [];

  for (const t of targets) {
    for (const w of [390, 320]) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });

      await client.send("Page.navigate", { url: t.url });
      await sleep(1500);

      const evalRes = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = window.innerWidth;
          const hasOverflow = scrollW > clientW + 2;

          let overflowingSelectors = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            for (const el of all) {
              const r = el.getBoundingClientRect();
              if (r.right > clientW + 2) {
                const tag = el.tagName.toLowerCase();
                const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 3).join('.') : '';
                overflowingSelectors.push(tag + (cls ? '.' + cls : '') + ' (r:' + Math.round(r.right) + ')');
                if (overflowingSelectors.length > 5) break;
              }
            }
          }

          return {
            scrollW,
            clientW,
            overflowDelta: scrollW - clientW,
            hasOverflow,
            overflowingSelectors
          };
        })()`,
        returnByValue: true,
      });

      const data = evalRes.result.value;
      const pass = !data.hasOverflow;
      results.push({
        target: t.name,
        width: w,
        scrollW: data.scrollW,
        clientW: data.clientW,
        delta: data.overflowDelta,
        pass,
        overflowingSelectors: data.overflowingSelectors,
      });

      console.log(
        `[${pass ? "PASS" : "FAIL"}] ${t.name} @ ${w}px: scrollW=${data.scrollW}, clientW=${data.clientW}, delta=${data.overflowDelta}`
      );
      if (!pass) {
        console.log(`   Overflowing elements:`, data.overflowingSelectors);
      }

      if (w === 390) {
        const shot = await client.send("Page.captureScreenshot", { format: "png" });
        const filePath = path.join(QA_DIR, t.shotName);
        fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
        console.log(`   Saved screenshot: ${filePath}`);
      }
    }
  }

  client.close();
  if (chromeProc) {
    chromeProc.kill();
  }

  const allPassed = results.every((r) => r.pass);
  console.log(`\nOverall Mobile Overflow Status: ${allPassed ? "ALL PASSED" : "FAILED"}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
