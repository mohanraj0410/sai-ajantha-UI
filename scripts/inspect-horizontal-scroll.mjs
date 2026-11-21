import fs from "node:fs";
import { spawn } from "node:child_process";
import http from "node:http";

const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new",
  "--remote-debugging-port=9224",
  "--no-sandbox",
  "--disable-gpu",
  "--window-size=1200,800",
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get("http://127.0.0.1:9224/json", (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => resolve(JSON.parse(buf)));
        }).on("error", reject);
      });
      const page = data.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Could not get CDP ws url");
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.callbacks = new Map();
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
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
      const id = ++this.id;
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  try {
    const wsUrl = await getWsUrl();
    const cdp = new CDP(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Console.enable");

    cdp.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === "Runtime.consoleAPICalled") {
        console.log("[BROWSER CONSOLE]", ...msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)));
      }
      if (msg.id && cdp.callbacks.has(msg.id)) {
        const cb = cdp.callbacks.get(msg.id);
        cdp.callbacks.delete(msg.id);
        cb(msg.result);
      }
    };

    console.log("Navigating to http://localhost:3000/products...");
    await cdp.send("Page.navigate", { url: "http://localhost:3000/products" });
    await sleep(4000);

    const evalResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const c = document.querySelector('.group\\\\/hscroll');
          const track = c ? c.querySelector('div[class*="overflow-x-auto"]') : null;
          const leftBtn = c ? c.querySelector('button[aria-label*="left"]') : null;
          const rightBtn = c ? c.querySelector('button[aria-label*="right"]') : null;
          const toObj = (r) => r ? ({ x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom }) : null;
          return {
            containerRect: toObj(c ? c.getBoundingClientRect() : null),
            parentOverflow: c ? window.getComputedStyle(c.parentElement).overflow : null,
            rightBtnRect: toObj(rightBtn ? rightBtn.getBoundingClientRect() : null),
            rightBtnComputed: rightBtn ? {
              display: window.getComputedStyle(rightBtn).display,
              visibility: window.getComputedStyle(rightBtn).visibility,
              opacity: window.getComputedStyle(rightBtn).opacity,
              zIndex: window.getComputedStyle(rightBtn).zIndex,
              position: window.getComputedStyle(rightBtn).position,
              transform: window.getComputedStyle(rightBtn).transform,
              color: window.getComputedStyle(rightBtn).color,
              backgroundColor: window.getComputedStyle(rightBtn).backgroundColor,
            } : null
          };
        })()
      `,
      returnByValue: true,
    });

    console.log("Evaluation result:", JSON.stringify(evalResult.result.value, null, 2));

    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('.group\\\\/hscroll').scrollIntoView({ block: 'center' });`
    });
    await sleep(500);

    console.log("Clicking right scroll button...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const btn = document.querySelector('.group\\\\/hscroll button[aria-label*="right"]');
          if (btn) btn.click();
        })()
      `
    });
    await sleep(600);

    const afterScrollResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const c = document.querySelector('.group\\\\/hscroll');
          const track = c ? c.querySelector('div[class*="overflow-x-auto"]') : null;
          const leftBtn = c ? c.querySelector('button[aria-label*="left"]') : null;
          const rightBtn = c ? c.querySelector('button[aria-label*="right"]') : null;
          return {
            trackScrollLeft: track ? track.scrollLeft : null,
            hasLeftBtn: !!leftBtn,
            hasRightBtn: !!rightBtn,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("After scroll right:", JSON.stringify(afterScrollResult.result.value, null, 2));

    const shotScrolled = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("docs/screenshots/test-horizontal-scrolled.png", Buffer.from(shotScrolled.data, "base64"));
    console.log("Saved screenshot to docs/screenshots/test-horizontal-scrolled.png");

    console.log("Opening search modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('button[aria-label="Search product catalogue"]').click();`
    });
    await sleep(1500);

    const modalResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return { error: "No dialog found" };
          const hscroll = dialog.querySelector('.group\\\\/hscroll');
          if (!hscroll) return { error: "No hscroll in dialog" };
          const track = hscroll.querySelector('div[class*="overflow-x-auto"]');
          const leftBtn = hscroll.querySelector('button[aria-label*="left"]');
          const rightBtn = hscroll.querySelector('button[aria-label*="right"]');
          const toObj = (r) => r ? ({ x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom }) : null;
          return {
            containerWidth: hscroll.offsetWidth,
            trackClientWidth: track ? track.clientWidth : null,
            trackScrollWidth: track ? track.scrollWidth : null,
            trackScrollLeft: track ? track.scrollLeft : null,
            hasLeftBtn: !!leftBtn,
            hasRightBtn: !!rightBtn,
            containerRect: toObj(hscroll.getBoundingClientRect()),
            rightBtnRect: toObj(rightBtn ? rightBtn.getBoundingClientRect() : null),
          };
        })()
      `,
      returnByValue: true,
    });

    console.log("Modal search scroll evaluation:", JSON.stringify(modalResult.result.value, null, 2));

    console.log("Clicking right arrow in search modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const btn = dialog ? dialog.querySelector('.group\\\\/hscroll button[aria-label*="right"]') : null;
          if (btn) btn.click();
        })()
      `
    });
    await sleep(600);

    const modalScrolledResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const hscroll = dialog.querySelector('.group\\\\/hscroll');
          const track = hscroll.querySelector('div[class*="overflow-x-auto"]');
          const leftBtn = hscroll.querySelector('button[aria-label*="left"]');
          const rightBtn = hscroll.querySelector('button[aria-label*="right"]');
          return {
            trackScrollLeft: track ? track.scrollLeft : null,
            hasLeftBtn: !!leftBtn,
            hasRightBtn: !!rightBtn,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Modal search after scroll right:", JSON.stringify(modalScrolledResult.result.value, null, 2));

    console.log("Clicking left arrow in search modal...");
    await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const btn = dialog ? dialog.querySelector('.group\\\\/hscroll button[aria-label*="left"]') : null;
          if (btn) btn.click();
        })()
      `
    });
    await sleep(600);

    const modalBackResult = await cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const dialog = document.querySelector('[role="dialog"]');
          const hscroll = dialog.querySelector('.group\\\\/hscroll');
          const track = hscroll.querySelector('div[class*="overflow-x-auto"]');
          const leftBtn = hscroll.querySelector('button[aria-label*="left"]');
          const rightBtn = hscroll.querySelector('button[aria-label*="right"]');
          return {
            trackScrollLeft: track ? track.scrollLeft : null,
            hasLeftBtn: !!leftBtn,
            hasRightBtn: !!rightBtn,
          };
        })()
      `,
      returnByValue: true,
    });
    console.log("Modal search after scroll left:", JSON.stringify(modalBackResult.result.value, null, 2));

    console.log("Evaluation result:", JSON.stringify(evalResult.result.value, null, 2));
  } catch (err) {
    console.error("Main error:", err);
  } finally {
    chrome.kill();
  }
}

main();
