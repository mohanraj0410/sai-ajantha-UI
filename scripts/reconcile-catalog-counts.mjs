import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require(path.resolve(process.cwd(), "apps/backend/node_modules/pg"));

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9225;
const STOREFRONT_URL = "http://localhost:3000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
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
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
  }
}

async function run() {
  console.log("=== P11.14 CATALOGUE COUNT INVESTIGATION & RECONCILIATION ===");

  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "about:blank",
  ]);

  try {
    await sleep(1000);
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const list = await listRes.json();
    const client = new CDPClient(list[0].webSocketDebuggerUrl);
    await client.connect();

    await client.send("Page.enable");
    await client.send("DOM.enable");
    await client.send("Runtime.enable");

    async function evalJs(expr) {
      const res = await client.send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      console.log("Runtime.evaluate raw res:", JSON.stringify(res));
      return res?.result?.value;
    }

    console.log(`Navigating to ${STOREFRONT_URL}/products ...`);
    await client.send("Page.navigate", { url: `${STOREFRONT_URL}/products` });
    await sleep(2500);

    const audit = await evalJs(`
      (() => {
        const allLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        const productCardElements = Array.from(document.querySelectorAll('.sa-product-card'));
        
        // Count how many cards are currently on page
        const cardCount = productCardElements.length;
        
        // Find pagination info
        const paginationText = document.body.innerText.match(/Showing \\d+–\\d+ of (\\d+) items/i);
        const totalItemsFromText = paginationText ? paginationText[1] : null;

        // Check category pills / tabs
        const categoryButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent && b.textContent.includes('('));
        const categoryCounts = categoryButtons.map(b => b.textContent.trim());

        return {
          totalAnchorTagsMatchingProducts: allLinks.length,
          productCardElementsCount: cardCount,
          totalItemsFromText,
          sampleHrefs: allLinks.slice(0, 10).map(a => a.getAttribute('href')),
          categoryCounts: categoryCounts.slice(0, 12),
          bodyExcerpt: document.body.innerText.slice(0, 300)
        };
      })()
    `);

    console.log("DOM Audit Result on /products:", JSON.stringify(audit, null, 2));

    client.close();
  } finally {
    chrome.kill("SIGKILL");
  }
}

run().catch(console.error);
