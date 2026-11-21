import fs from "node:fs";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

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

  for (const page of ["login", "register"]) {
    console.log(`\n=== INSPECTING MOBILE ${page.toUpperCase()} (390px) ===`);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await client.send("Page.navigate", { url: `http://localhost:3000/${page}` });
    await sleep(2000);

    const evalRes = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const header = document.querySelector('header');
        const headerBox = header ? header.getBoundingClientRect() : null;
        const footer = document.querySelector('footer');
        const footerBox = footer ? footer.getBoundingClientRect() : null;
        const bodyHeight = document.body.scrollHeight;
        const winHeight = window.innerHeight;

        const headerLinks = Array.from(document.querySelectorAll('header a')).map(a => ({
          text: a.innerText.trim(),
          width: Math.round(a.getBoundingClientRect().width),
          right: Math.round(a.getBoundingClientRect().right)
        }));

        const roleButtons = Array.from(document.querySelectorAll('[role="radio"]')).map(b => ({
          text: b.innerText.split('\\n')[0].trim(),
          height: Math.round(b.getBoundingClientRect().height),
          width: Math.round(b.getBoundingClientRect().width)
        }));

        return {
          winHeight,
          bodyHeight,
          headerBox: headerBox ? { height: Math.round(headerBox.height), width: Math.round(headerBox.width) } : null,
          footerBox: footerBox ? { height: Math.round(footerBox.height), width: Math.round(footerBox.width) } : null,
          headerLinks,
          roleButtons
        };
      })()`,
      returnByValue: true,
    });

    console.log(JSON.stringify(evalRes.result?.value, null, 2));
  }

  client.close();
  if (chromeProc) chromeProc.kill();
}

run().catch(console.error);
