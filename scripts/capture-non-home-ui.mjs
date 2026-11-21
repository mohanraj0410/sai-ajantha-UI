import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw new Error("Use before or after");
const origin = process.env.STOREFRONT_URL ?? "http://localhost:3000";
const out = path.resolve(process.env.STOREFRONT_EVIDENCE ?? "docs/ui-redesign/evidence", phase);
await fs.mkdir(out, { recursive: true });
const ports = await fs.mkdtemp(path.join(path.dirname(out), ".storefront-qa-"));
const browser = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--remote-debugging-port=0", "--hide-scrollbars", "--no-first-run",
  "--disable-background-networking", "--user-data-dir=" + ports, "about:blank",
], { stdio: "ignore", windowsHide: true });
let socket;
let serial = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + " timed out")); }, 25000);
    pending.set(id, (msg) => { clearTimeout(timeout); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  return (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
}
async function record(name, full) {
  const clip = full ? await evaluate("({x:0,y:0,width:innerWidth,height:document.documentElement.scrollHeight,scale:1})") : undefined;
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!clip, clip });
  await fs.writeFile(path.join(out, name + ".png"), Buffer.from(data, "base64"));
}
async function checkInteractions(name) {
  const click = (selector) => evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true; })()`);
  const textContains = text => evaluate(`document.querySelector('main')?.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) ?? false`);
  const checks = {};
  if (name === "products") {
    const input = 'input[aria-label="Filter product catalogue"]';
    const trigger = 'button[aria-label="Open category filters"]';
    checks["filter drawer opens"] = await click(trigger) && (await wait(280), await evaluate("!!document.querySelector('[role=dialog]')"));
    if (checks["filter drawer opens"]) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await wait(300);
      checks["escape closes filter drawer"] = await evaluate("!document.querySelector('[role=dialog]')");
    }
    const selected = await evaluate(`(() => { const button = [...document.querySelectorAll('.sa-category-rail button[aria-pressed]')].find(el => el.textContent.trim().startsWith('Aluminium (')); if (!button) return false; button.click(); return true; })()`);
    await wait(750);
    checks["category selection updates heading and URL"] = selected && await evaluate("new URLSearchParams(location.search).get('category') === 'Aluminium' && document.querySelector('h1')?.textContent === 'Aluminium'");
    if (checks["category selection updates heading and URL"]) {
      await evaluate("history.back(); true");
      await wait(750);
      checks["back restores catalogue"] = await evaluate("!new URLSearchParams(location.search).has('category') && document.querySelector('h1')?.textContent === 'Product catalogue'");
    }
    await evaluate(`document.querySelector(${JSON.stringify(input)})?.focus()`);
    await send("Input.insertText", { text: "no-matching-sku-000000" });
    await wait(500);
    checks["no matching products state"] = await textContains("no matching products");
  }
  if (name === "login" || name === "register") {
    const password = name === "login" ? "login-password" : "reg-password";
    const toggle = 'button[aria-label="Show password"]';
    const hasPassword = await evaluate(`!!document.getElementById(${JSON.stringify(password)})`);
    checks["password is masked by default"] = hasPassword && await evaluate(`document.getElementById(${JSON.stringify(password)})?.type === 'password'`);
    checks["password visibility toggle works"] = await click(toggle) && (await wait(200), await evaluate(`document.getElementById(${JSON.stringify(password)})?.type === 'text'`));
  }
  if (name === "quotes") {
    checks["optional quote fields expand"] = await click(".sa-form-details summary") && (await wait(220), await evaluate("document.querySelector('.sa-form-details')?.open && document.getElementById('q-sku')?.getClientRects().length > 0"));
  }
  if (name === "dealer" || name === "distributor") {
    const role = name.toUpperCase();
    checks["signed-out user sees trade sign-in link"] = await evaluate(`!!document.querySelector('main a[href="/login?role=' + ${JSON.stringify(role)} + '"]')`);
  }
  if (name === "home") {
    for (const beat of ["02 Promise", "01 Overview"]) {
      const found = await evaluate(`(() => {const el=[...document.querySelectorAll('main button')].find(node=>node.textContent.trim()===${JSON.stringify(beat)}); if(!el)return false; el.click();return true;})()`);
      await wait(750);
      checks[beat + " selects the hero view"] = found && await evaluate(`[...document.querySelectorAll('main button')].find(node=>node.textContent.trim()===${JSON.stringify(beat)})?.classList.contains('bg-gradient-to-r') ?? false`);
    }
  }
  const crumb = await evaluate("document.querySelector('main nav[aria-label=Breadcrumb] a') ? true : false");
  if (crumb) {
    await evaluate("document.querySelector('main nav[aria-label=Breadcrumb] a').focus(); true");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    checks["keyboard moves focus to a visible control"] = await evaluate("document.activeElement !== document.body && document.activeElement?.matches(':focus-visible') && document.activeElement?.getClientRects().length > 0");
  }
  return checks;
}
const lib = "apps/storefront/lib/";
const slugs = async file => [...(await fs.readFile(lib + file, "utf8")).matchAll(/^    slug: "([^"]+)"/gm)].map(match => match[1]);
const entries = await fs.readdir("apps/storefront/app", { withFileTypes: true });
const targets = [["home", "/"]];
for (const entry of entries.filter(e => e.isDirectory() && e.name !== "admin")) {
  if (await fs.stat("apps/storefront/app/" + entry.name + "/page.tsx").then(() => true, () => false)) targets.push([entry.name, "/" + entry.name]);
}
const content = await slugs("solutionsAndProjects.ts");
for (const slug of content.slice(0, 6)) targets.push(["solution-" + slug, "/solutions/" + slug]);
for (const slug of content.slice(6)) targets.push(["project-" + slug, "/projects/" + slug]);
for (const slug of await slugs("articles.ts")) targets.push(["guide-" + slug, "/blogs/" + slug]);
const categorySource = (await fs.readFile(lib + "products.ts", "utf8")).split("export const PRODUCT_CATEGORIES")[1].split("];")[0];
for (const [, category] of categorySource.matchAll(/"([^"]+)"/g)) {
  targets.push(["category-" + category.toLowerCase().replace(/[^a-z]+/g, "-"), "/products?category=" + encodeURIComponent(category)]);
}
targets.push(["search-hardware", "/search?q=hardware"], ["order-detail-guest", "/orders/unavailable"], ["404", "/products/unavailable"]);
const products = await fetch(origin + "/api/products").then(r => r.json()).catch(() => ({}));
console.log("Public catalogue at capture start:", products.count ?? products.error ?? "unavailable");
const firstByCategory = new Map();
for (const product of products.products ?? []) if (product.id && !firstByCategory.has(product.category)) firstByCategory.set(product.category, product.id);
for (const id of firstByCategory.values()) targets.splice(1, 0, ["product-" + id, "/products/" + encodeURIComponent(id)]);
if (firstByCategory.size === 0) targets.splice(1, 0, ["product-prod-001", "/products/prod-001"]);
const requestedWidths = process.env.STOREFRONT_WIDTHS?.split(",").map(Number);
const widths = { 320:640, 375:812, 390:844, 768:1024, 1024:768, 1440:900, 1920:1080 };
const prior = process.env.STOREFRONT_TARGET ? await fs.readFile(path.join(out, "results.json"), "utf8").then(JSON.parse).catch(() => []) : [];
const results = prior.filter(item => !new RegExp(process.env.STOREFRONT_TARGET).test(item.name));
try {
  let port;
  for (let i = 0; i < 50 && !port; i++) {
    port = (await fs.readFile(path.join(ports, "DevToolsActivePort"), "utf8").catch(() => "")).split("\n")[0];
    if (!port) await wait(100);
  }
  const [tab] = await fetch("http://127.0.0.1:" + port + "/json/list").then(r => r.json());
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => { const msg = JSON.parse(data); pending.get(msg.id)?.(msg); pending.delete(msg.id); };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: "history.scrollRestoration = 'manual';" });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (const [name, url] of targets) {
    const mode = process.env.STOREFRONT_TARGET;
    if (mode && !new RegExp(mode).test(name)) continue;
    let navigated = false;
    for (const width of (requestedWidths ?? (name === "home" ? [320, 390, 768, 1024, 1440] : phase === "after" ? [320, 375, 390, 768, 1024, 1440, 1920] : [390, 768, 1440]))) {
      try {
        await send("Emulation.setDeviceMetricsOverride", { width, height: widths[width], deviceScaleFactor: 1, mobile: false });
        if (!navigated || name === "home") {
          const navigation = await send("Page.navigate", { url: origin + url });
          if (navigation.errorText) throw new Error(navigation.errorText);
          navigated = true;
          await wait(150);
          for (let i = 0; i < 90; i++) {
            const ready = await evaluate(`location.host === ${JSON.stringify(new URL(origin).host)} && !!document.querySelector('main h1, main h2, main h3')`).catch(() => false);
            if (ready) break;
            await wait(120);
          }
          // Give hydration and the public catalogue request time to settle. A single navigation per route avoids repeated API calls across widths.
          await wait(2200);
        }
        await evaluate("Promise.race([document.fonts.ready.then(()=>true),new Promise(r=>setTimeout(r,1200))])").catch(() => {});
        await evaluate("document.querySelector('nextjs-portal')?.style.setProperty('display','none'); window.scrollTo({top:0,behavior:'instant'}); true").catch(() => {});
        await wait(name === "home" ? 500 : 170);
        const info = await evaluate(`({
          path: location.pathname + location.search,
          heading: document.querySelector('main h1,main h2')?.textContent.trim(),
          overflow: document.documentElement.scrollWidth - innerWidth,
          scrollTop: window.scrollY,
          overflowElements: document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll("main *")].filter(el=>el.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(el).position !== "fixed").slice(0,15).map(el=>({tag:el.localName,classes:el.getAttribute("class")?.slice(0,125),text:el.textContent.trim().slice(0,64)})) : [],
          nameless: [...document.querySelectorAll('main button,main a')].filter(el => el.getClientRects().length && !el.closest('[aria-hidden=true]') && !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.labels?.length || el.title || el.textContent.trim() || el.querySelector('img[alt]:not([alt=""])'))).length,
          main: document.querySelector('main')?.innerText.slice(0,240),
          catalogCards: document.querySelectorAll('.sa-product-card,.product-image-container').length,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          styledHeading: document.querySelector('.sa-page-banner') ? getComputedStyle(document.querySelector('.sa-page-banner')).borderRadius : null
        })`);
        const screenshot = [390,768,1440].includes(width) || name === "home";
        const file = name + "-" + width;
        if (screenshot) await record(file, false);
        if (name === "home") {
          for (const beat of ["02 Promise", "01 Overview", "Shop by Category"]) {
            await evaluate(`(() => {const element=[...document.querySelectorAll('main *')].find(el=>el.childElementCount===0 && el.textContent.trim().toLowerCase()===${JSON.stringify(beat.toLowerCase())}); if(!element)return false; const button=element.closest('button'); if(button)button.click(); else element.scrollIntoView({block:'center',behavior:'instant'}); return true})()`).then(async found => { if (found) { await wait(650); await record(file + "-" + beat.replaceAll(" ", "-").toLowerCase(), false); } });
          }
        }
        const interactions = process.env.STOREFRONT_INTERACTIONS && width === 390 ? await checkInteractions(name) : undefined;
        results.push({ name, url, width, ...info, interactions, ...(screenshot && { file: file + ".png" }) });
      } catch (err) { results.push({ name, url, width, error: String(err) }); }
    }
    await fs.writeFile(path.join(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
    console.log(phase, name);
  }
} finally {
  socket?.close();
  const closed = new Promise(resolve => browser.once("exit", resolve));
  browser.kill();
  await Promise.race([closed, wait(2000)]);
  await fs.rm(ports, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
}
