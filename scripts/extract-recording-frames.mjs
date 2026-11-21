import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9235;
const HTTP_PORT = 9876;
const VIDEO_FILE = "C:\\Users\\Admin\\Downloads\\Recording 2026-11-18 094636.mp4";
const OUT_DIR = path.resolve("docs/screenshots/video-frames");

fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start HTTP server with Range request support for HTML5 video
const server = http.createServer((req, res) => {
  if (req.url === "/video.mp4") {
    const stat = fs.statSync(VIDEO_FILE);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(VIDEO_FILE, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": stat.size,
        "Content-Type": "video/mp4",
      };
      res.writeHead(200, head);
      fs.createReadStream(VIDEO_FILE).pipe(res);
    }
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <style>
    body, html { margin: 0; padding: 0; background: #000; overflow: hidden; width: 100vw; height: 100vh; }
    video { width: 100%; height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video id="v" src="/video.mp4" playsinline muted controls></video>
</body>
</html>`);
  }
});

server.listen(HTTP_PORT);

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
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await res.json();
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        return list[0].webSocketDebuggerUrl;
      }
    } catch {
      await sleep(400);
    }
  }
  throw new Error("Could not connect to Chrome debugging port");
}

async function extract() {
  console.log("Launching headless Chrome for video frame extraction...");
  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `http://127.0.0.1:${HTTP_PORT}/`,
  ]);

  try {
    const wsUrl = await getDebuggerUrl();
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log("Navigating to video player...");
    await client.send("Page.navigate", { url: `http://127.0.0.1:${HTTP_PORT}/` });
    await sleep(2000);

    // Wait until video metadata is loaded
    await client.send("Runtime.evaluate", {
      expression: `new Promise((resolve) => {
        const v = document.getElementById('v');
        if (v.readyState >= 1) resolve(true);
        v.onloadedmetadata = () => resolve(true);
        setTimeout(() => resolve(false), 5000);
      })`,
      awaitPromise: true,
    });

    const timestamps = [
      { sec: 2.5, name: "01-dashboard-02s.png" },
      { sec: 7.5, name: "02-orders-07s.png" },
      { sec: 12.5, name: "03-quotes-12s.png" },
      { sec: 17.5, name: "04-enquiries-17s.png" },
      { sec: 25.0, name: "05-products-25s.png" },
      { sec: 38.0, name: "06-product-new-sku-38s.png" },
      { sec: 49.0, name: "07-categories-49s.png" },
      { sec: 57.5, name: "08-reports-57s.png" },
      { sec: 62.5, name: "09-import-62s.png" },
      { sec: 67.5, name: "10-pricing-67s.png" },
      { sec: 72.5, name: "11-customer-detail-72s.png" },
      { sec: 77.5, name: "12-dealers-77s.png" },
      { sec: 82.5, name: "13-seller-coverage-82s.png" },
      { sec: 87.5, name: "14-settings-87s.png" },
    ];

    for (const item of timestamps) {
      console.log(`Seeking video to ${item.sec}s...`);
      await client.send("Runtime.evaluate", {
        expression: `new Promise((resolve) => {
          const v = document.getElementById('v');
          v.currentTime = ${item.sec};
          v.onseeked = () => resolve(true);
          setTimeout(() => resolve(false), 3000);
        })`,
        awaitPromise: true,
      });

      await sleep(400);

      const { data } = await client.send("Page.captureScreenshot", { format: "png" });
      const outPath = path.join(OUT_DIR, item.name);
      fs.writeFileSync(outPath, Buffer.from(data, "base64"));
      const sz = fs.statSync(outPath).size;
      console.log(`Saved frame ${item.name} (${sz} bytes)`);
    }

    console.log("All frames extracted successfully.");
    client.close();
  } finally {
    try {
      chromeProc.kill("SIGKILL");
    } catch {}
    server.close();
  }
}

extract().catch((e) => {
  console.error("Extraction error:", e);
  server.close();
  process.exit(1);
});
