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

async function capture() {
  let chromeProc = null;
  let wsUrl = null;

  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await res.json();
    if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
      wsUrl = list[0].webSocketDebuggerUrl;
    }
  } catch {
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

  const viewports = [
    { name: "desktop-1440px", width: 1440, height: 900, mobile: false },
    { name: "tablet-768px", width: 768, height: 1024, mobile: false },
    { name: "mobile-390px", width: 390, height: 844, mobile: true },
  ];

  for (const vp of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.mobile,
    });

    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(1500);

    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    const filename = `login-before-${vp.name}.png`;
    const filepath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(shot.data, "base64"));
    console.log(`Saved login baseline: ${filepath}`);
  }

  client.close();
  if (chromeProc) chromeProc.kill();
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
