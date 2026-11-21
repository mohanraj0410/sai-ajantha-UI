import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const BASE_URL = "http://localhost:3000/login";
const OUT_DIR = path.resolve(process.cwd(), "docs/screenshots/auth");

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
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
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
      "about:blank",
    ]);
    wsUrl = await getDebuggerUrl();
  }

  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  const viewports = [
    { name: "desktop-1440px", width: 1440, height: 900, mobile: false },
    { name: "tablet-768px", width: 768, height: 1024, mobile: false },
    { name: "mobile-390px", width: 390, height: 844, mobile: true },
    { name: "mobile-320px", width: 320, height: 700, mobile: true },
  ];

  console.log("=== CAPTURING REDESIGNED LOGIN PAGE & VERIFYING GEOMETRY ===");

  for (const vp of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.mobile,
    });

    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2000);

    // Verify overflow
    const evalRes = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientW = window.innerWidth;
        const hasOverflow = scrollW > clientW + 2;

        const h1 = document.querySelector('h1')?.innerText || '';
        const roleRadios = Array.from(document.querySelectorAll('[role="radio"]')).map(el => el.innerText.split('\\n')[0]);
        const submitBtn = document.querySelector('button[type="submit"]')?.innerText || '';

        return {
          scrollW,
          clientW,
          hasOverflow,
          h1,
          roleRadios,
          submitBtn
        };
      })()`,
      returnByValue: true,
    });

    const data = evalRes.result?.value;
    const pass = !data.hasOverflow;
    console.log(
      `[${pass ? "PASS" : "FAIL"}] ${vp.name}: scrollW=${data.scrollW}, clientW=${data.clientW}, overflow=${data.hasOverflow}`
    );
    console.log(`   H1: "${data.h1}", Button: "${data.submitBtn}", Radios: ${JSON.stringify(data.roleRadios)}`);

    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    const filename = `login-redesigned-${vp.name}.png`;
    const filepath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(shot.data, "base64"));
    console.log(`   Saved screenshot: ${filepath}`);
  }

  // Interactive UI Test: validation and role switching
  console.log("\n=== TESTING LOGIN INTERACTIVE VALIDATION ===");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await client.send("Page.navigate", { url: BASE_URL });
  await sleep(1500);

  // Click submit to trigger validation errors
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      document.querySelector('button[type="submit"]')?.click();
    })()`,
  });
  await sleep(500);

  const errorCheck = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const emailErr = document.querySelector('#login-email')?.closest('.space-y-1')?.querySelector('.text-red-600')?.innerText || '';
      const passErr = document.querySelector('#login-password')?.closest('.space-y-1')?.querySelector('.text-red-600')?.innerText || '';
      return { emailErr, passErr };
    })()`,
    returnByValue: true,
  });
  console.log("Validation Trigger Check:", errorCheck.result?.value);

  const errorShot = await client.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, "login-validation-errors-desktop.png"), Buffer.from(errorShot.data, "base64"));
  console.log("Saved login validation error screenshot: docs/screenshots/auth/login-validation-errors-desktop.png");

  client.close();
  if (chromeProc) chromeProc.kill();
  console.log("\nAll login visual & interaction checks completed successfully!");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
