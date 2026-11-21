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

let a11yPass = 0;
let a11yFail = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    a11yPass++;
  } else {
    console.error(`  [FAIL] ${message}`);
    a11yFail++;
  }
}

async function runA11y() {
  console.log("=== RUNNING HOMEPAGE ACCESSIBILITY (A11Y) AUDIT ===");
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

    const evaluate = async (expression) => {
      const res = await client.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    };

    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log("Navigating to homepage for a11y audit...");
    await client.send("Page.navigate", { url: BASE_URL });
    await sleep(2500);

    // 1. Heading Hierarchy
    console.log("\n--- 1. Heading Hierarchy ---");
    const headings = await evaluate(`
      (() => {
        const hElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return hElements.map(h => ({
          tag: h.tagName.toLowerCase(),
          text: h.innerText.replace(/\\s+/g, ' ').trim()
        }));
      })()
    `);
    const h1s = headings.filter(h => h.tag === 'h1');
    check(h1s.length >= 1, `Page has at least one <h1> element (found ${h1s.length}: "${h1s[0]?.text}")`);
    const h2s = headings.filter(h => h.tag === 'h2');
    check(h2s.length >= 4, `Page has major section <h2> headings (found ${h2s.length})`);
    console.log(`  Total headings found: ${headings.length} (H1: ${h1s.length}, H2: ${h2s.length}, H3: ${headings.filter(h => h.tag === 'h3').length})`);

    // 2. Images and Alt text
    console.log("\n--- 2. Images & Accessible Names ---");
    const imageReport = await evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const missingAlt = imgs.filter(img => !img.hasAttribute('alt'));
        const emptyAltNonDecorative = imgs.filter(img => img.getAttribute('alt') === '' && img.getAttribute('aria-hidden') !== 'true' && !img.closest('[aria-hidden="true"]'));
        return {
          total: imgs.length,
          missingAltCount: missingAlt.length,
          emptyAltNonDecorativeCount: emptyAltNonDecorative.length,
          samples: imgs.slice(0, 5).map(img => ({ src: img.src.split('/').pop(), alt: img.alt }))
        };
      })()
    `);
    check(imageReport.missingAltCount === 0, `All ${imageReport.total} images have 'alt' attribute defined`);
    console.log(`  Sample image alt tags:`, imageReport.samples);

    // 3. Landmark Structure
    console.log("\n--- 3. Landmark & Semantic Landmarks ---");
    const landmarks = await evaluate(`
      (() => {
        return {
          header: Boolean(document.querySelector('header')),
          main: Boolean(document.querySelector('main')),
          footer: Boolean(document.querySelector('footer')),
          navCount: document.querySelectorAll('nav').length,
          sectionsWithAriaLabelledBy: document.querySelectorAll('section[aria-labelledby]').length
        };
      })()
    `);
    check(landmarks.header, "<header> landmark is present");
    check(landmarks.main, "<main> landmark is present");
    check(landmarks.footer, "<footer> landmark is present");
    check(landmarks.sectionsWithAriaLabelledBy >= 5, `Sections with aria-labelledby landmark labeling (found ${landmarks.sectionsWithAriaLabelledBy})`);

    // 4. Buttons and Links Accessible Names
    console.log("\n--- 4. Interactive Elements Accessible Names ---");
    const interactiveReport = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const namelessButtons = buttons.filter(b => {
          const name = b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title');
          return !name;
        });
        const links = Array.from(document.querySelectorAll('a'));
        const namelessLinks = links.filter(a => {
          const name = a.innerText.trim() || a.getAttribute('aria-label') || a.getAttribute('title') || a.querySelector('img[alt]');
          return !name;
        });
        return {
          totalButtons: buttons.length,
          namelessButtons: namelessButtons.length,
          totalLinks: links.length,
          namelessLinks: namelessLinks.length
        };
      })()
    `);
    check(interactiveReport.namelessButtons === 0, `All ${interactiveReport.totalButtons} buttons have accessible names (0 nameless)`);
    check(interactiveReport.namelessLinks === 0, `All ${interactiveReport.totalLinks} links have accessible names (0 nameless)`);

    // 5. Form Field Label Associations
    console.log("\n--- 5. Form Field & Label Association ---");
    const formReport = await evaluate(`
      (() => {
        const inputs = Array.from(
          document.querySelectorAll('input:not([type="hidden"]):not([aria-hidden="true"]), textarea:not([aria-hidden="true"]), select:not([aria-hidden="true"])')
        );
        const unlabelled = inputs.filter(inp => {
          const id = inp.id;
          const hasLabel = id && document.querySelector('label[for="' + id + '"]');
          const hasAriaLabel = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
          return !hasLabel && !hasAriaLabel;
        });
        return {
          totalInputs: inputs.length,
          unlabelledCount: unlabelled.length,
          unlabelledDetails: unlabelled.map(u => ({ tag: u.tagName, id: u.id, name: u.name, html: u.outerHTML.slice(0, 100) }))
        };
      })()
    `);
    if (formReport.unlabelledCount > 0) {
      console.log("  [DEBUG Unlabelled inputs]:", formReport.unlabelledDetails);
    }
    check(formReport.unlabelledCount === 0, `All ${formReport.totalInputs} visible form inputs have associated labels or aria-labels`);

    // 6. Focus Visibility
    console.log("\n--- 6. Keyboard Focus & Reduced Motion ---");
    const focusStyles = await evaluate(`
      (() => {
        const focusable = document.querySelector('a, button, input');
        if (!focusable) return false;
        focusable.focus();
        const active = document.activeElement;
        return active === focusable;
      })()
    `);
    check(focusStyles, "Interactive elements accept keyboard focus programmatically");

    client.close();
  } finally {
    chromeProc.kill();
  }

  console.log("\n========================================================");
  console.log(`A11Y AUDIT SUMMARY: ${a11yPass} Checks Passed, ${a11yFail} Failed.`);
  console.log("========================================================");
  if (a11yFail > 0) process.exit(1);
}

runA11y().catch((err) => {
  console.error("A11y audit aborted:", err);
  process.exit(1);
});
