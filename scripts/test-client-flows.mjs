import path from "node:path";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

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

  const routes = [
    {
      url: "http://localhost:3000/dealer",
      test: () => document.body.innerText.includes("Trade Dealer Sign-In Required"),
      name: "Dealer Gate: Trade Dealer Sign-In Required",
    },
    {
      url: "http://localhost:3000/distributor",
      test: () => document.body.innerText.includes("Distributor Sign-In Required"),
      name: "Distributor Gate: Distributor Sign-In Required",
    },
    {
      url: "http://localhost:3000/installation",
      test: () =>
        document.body.innerText.includes("Need Installation?") &&
        document.body.innerText.includes("Independent Contractor Billing & Responsibility"),
      name: "Installation Page: Independent Contractor Disclaimer",
    },
    {
      url: "http://localhost:3000/quotes",
      test: () =>
        document.body.innerText.includes("Direct Trade & Custom Sizing Quotation Desk") ||
        document.body.innerText.includes("Request Custom Quote") ||
        document.body.innerText.includes("Quotation"),
      name: "Quotes Page Content",
    },
    {
      url: "http://localhost:3000/shipping-policy",
      test: () =>
        document.body.innerText.includes("Shipping & Return Policy") &&
        document.body.innerText.includes("Trichy"),
      name: "Shipping Policy Hub Info",
    },
  ];

  let passed = 0;
  for (const r of routes) {
    await client.send("Page.navigate", { url: r.url });
    await sleep(2000);

    const evalRes = await client.send("Runtime.evaluate", {
      expression: `(${r.test.toString()})()`,
      returnByValue: true,
    });

    const isPass = Boolean(evalRes.result && evalRes.result.value);
    if (isPass) {
      console.log(`[PASS] ${r.name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${r.name}`);
      const textEval = await client.send("Runtime.evaluate", {
        expression: "document.body.innerText.slice(0, 300)",
        returnByValue: true,
      });
      console.error(`   Page text starts with: ${JSON.stringify(textEval.result?.value)}`);
    }
  }

  client.close();
  if (chromeProc) chromeProc.kill();

  console.log(`\nClient Flow Verification: ${passed}/${routes.length} PASSED`);
  if (passed !== routes.length) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
