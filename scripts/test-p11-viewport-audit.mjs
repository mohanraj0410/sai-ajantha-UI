import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9255;
const BASE_URL = "http://localhost:3000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }
  async init() {
    return new Promise((resolve) => {
      this.ws.onopen = () => resolve();
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          cb(msg.result);
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve) => {
      const curId = this.id++;
      this.callbacks.set(curId, resolve);
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "about:blank",
  ]);

  let pass = 0;
  let fail = 0;

  try {
    await sleep(800);
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await listRes.json();
    const cdp = new CDP(list[0].webSocketDebuggerUrl);
    await cdp.init();

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const viewports = [
      { name: "Mobile 320px", w: 320, h: 600 },
      { name: "Mobile 375px", w: 375, h: 667 },
      { name: "Tablet 768px", w: 768, h: 1024 },
      { name: "Desktop 1024px", w: 1024, h: 768 },
      { name: "Desktop 1440px", w: 1440, h: 900 },
    ];

    const routes = [
      "/",
      "/products",
      "/products/SA-I-FS-TON90-007",
      "/cart",
      "/checkout",
      "/login",
      "/register?type=dealer",
      "/register?type=distributor",
      "/dealer",
      "/distributor",
      "/contact",
    ];

    console.log("=== P11.1 RESPONSIVE VIEWPORT & 320PX ZERO OVERFLOW AUDIT ===");

    for (const r of routes) {
      console.log(`\nAuditing route: ${r}`);
      for (const vp of viewports) {
        await cdp.send("Emulation.setDeviceMetricsOverride", {
          width: vp.w,
          height: vp.h,
          deviceScaleFactor: 1,
          mobile: vp.w < 1024,
        });

        await cdp.send("Page.navigate", { url: BASE_URL + r });
        await sleep(1000);

        const evalRes = await cdp.send("Runtime.evaluate", {
          expression: `(() => {
            const sw = document.documentElement.scrollWidth;
            const cw = document.documentElement.clientWidth;
            const bodySw = document.body.scrollWidth;
            const bodyCw = document.body.clientWidth;
            const maxSw = Math.max(sw, bodySw);
            return {
              scrollWidth: maxSw,
              clientWidth: cw,
              hasHorizontalOverflow: maxSw > cw + 1
            };
          })()`,
          returnByValue: true,
        });

        const data = evalRes?.result?.value;
        const status = data?.hasHorizontalOverflow ? "OVERFLOW" : "PASS";
        if (!data?.hasHorizontalOverflow) {
          pass++;
          console.log(`  [PASS] ${vp.name.padEnd(15)} width=${vp.w}px maxScrollWidth=${data?.scrollWidth}px`);
        } else {
          fail++;
          console.error(`  [FAIL] ${vp.name.padEnd(15)} width=${vp.w}px maxScrollWidth=${data?.scrollWidth}px OVERFLOW!`);
        }
      }
    }

    cdp.close();
  } catch (err) {
    console.error("Audit error:", err);
    fail++;
  } finally {
    chrome.kill();
  }

  console.log(`\n========================================================`);
  console.log(`VIEWPORT AUDIT SUMMARY: ${pass} Passed, ${fail} Failed.`);
  console.log(`========================================================`);
  if (fail > 0) process.exit(1);
}

run();
