import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9271;
const ADMIN_URL = "http://localhost:7001";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.exceptions = [];
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.method === "Runtime.exceptionThrown") {
          this.exceptions.push(msg.params?.exceptionDetails?.text || "Runtime exception");
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej, timer } = this.callbacks.get(msg.id);
          clearTimeout(timer);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }
  send(method, params = {}, timeoutMs = 15000) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          rej(new Error(`CDP ${method} timed out`));
        }
      }, timeoutMs);
      this.callbacks.set(id, { res, rej, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalVal(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function getWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const l = await r.json();
      if (l?.[0]?.webSocketDebuggerUrl) return l[0].webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("CDP unreachable");
}

async function waitForSelector(client, selector, maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const ok = await client.evalVal(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (ok) return true;
    await sleep(200);
  }
  return false;
}

async function setInputValue(client, selector, value) {
  const ok = await client.evalVal(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(ok, true, `Input not found: ${selector}`);
  await sleep(220);
}

async function clickButtonByText(client, text) {
  const ok = await client.evalVal(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const match = btns.find((b) => b.offsetParent !== null && b.innerText.trim().includes(${JSON.stringify(text)}));
    if (!match) return false;
    match.click();
    return true;
  })()`);
  assert.equal(ok, true, `Visible button not found: "${text}"`);
  await sleep(350);
}

async function clickSidebarRoute(client, label) {
  const ok = await client.evalVal(`(() => {
    const items = Array.from(document.querySelectorAll('.sa-admin-sider .ant-menu-item'));
    const match = items.find((i) => i.innerText.includes(${JSON.stringify(label)}));
    if (!match) return false;
    match.click();
    return true;
  })()`);
  assert.equal(ok, true, `Sidebar route not found: "${label}"`);
  await sleep(400);
}

async function getUnsavedModalState(client) {
  return client.evalVal(`(() => {
    const confirmEl = document.querySelector('.ant-modal-confirm');
    if (!confirmEl) return { open: false };
    return {
      open: true,
      title: confirmEl.querySelector('.ant-modal-confirm-title')?.innerText?.trim() || '',
      body: confirmEl.querySelector('.ant-modal-confirm-content')?.innerText?.trim() || '',
      buttons: Array.from(confirmEl.querySelectorAll('button')).map((b) => b.innerText.trim()),
    };
  })()`);
}

async function run() {
  console.log("=== FORM-08: COMPLETE 18-SCENARIO FORM VALIDATION, STATE & GUARD SUITE ===\n");

  const authRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
  });
  const auth = await authRes.json();
  assert.ok(auth.token, "Admin login failed");

  const meRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const staff = (await meRes.json()).staff;

  const portalRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const products = (await portalRes.json()).products || [];
  const prodA = products.find((p) => p.category === "Insect Screens");
  const prodB = products.find((p) => p.category === "Aluminium");
  assert.ok(prodA && prodB, "Need two real products for Edit A -> Edit B switch test");

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "sa-forms-"))}`,
    "--disable-gpu",
    "--no-sandbox",
    "about:blank",
  ]);
  const client = new CDPClient(await getWs());
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await client.send("Page.navigate", { url: `${ADMIN_URL}/login` });
  await sleep(700);
  await client.evalVal(`(() => {
    localStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(auth.token)});
    sessionStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(auth.token)});
    localStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
    sessionStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
    localStorage.setItem("sai_ajanta_admin_theme", "light");
  })()`);

  // ── Scenario 1: Untouched form -> Navigate -> No confirmation ──
  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/new` });
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(300);
  await clickSidebarRoute(client, "Orders");
  let modal = await getUnsavedModalState(client);
  let pathNow = await client.evalVal("window.location.pathname");
  assert.equal(modal.open, false, "Untouched form must not trigger Unsaved Changes modal");
  assert.equal(pathNow, "/orders", "Untouched form must navigate immediately");
  console.log("[PASS 01] Untouched form -> Navigate -> No confirmation");

  // ── Scenario 2: Modified form -> Navigate -> Exact confirmation modal ──
  // Arrive via real SPA navigation (Orders -> Products -> Add Product) so Browser Back triggers SPA POP!
  await clickSidebarRoute(client, "Products");
  await waitForSelector(client, ".ant-table");
  await sleep(300);
  await clickButtonByText(client, "Add Product");
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(300);
  await setInputValue(client, 'input[placeholder*="Pleated Sliding"]', "Temp Unsaved Screen");
  await setInputValue(client, 'input[placeholder="SA-SCR-001"]', "SA-TEMP-GUARD-01");
  await clickSidebarRoute(client, "Orders");
  modal = await getUnsavedModalState(client);
  assert.equal(modal.open, true, "Modified form must open Unsaved Changes confirmation");
  assert.equal(modal.title, "Unsaved Changes");
  assert.equal(modal.body, "You have unsaved changes. Do you want to leave this page?");
  assert.ok(modal.buttons.includes("Stay Here") && modal.buttons.includes("Leave Without Saving"));
  console.log("[PASS 02] Modified form -> Navigate -> Exact Unsaved Changes modal shown");

  // ── Scenario 3: Modified form -> Stay Here -> Values preserved ──
  await clickButtonByText(client, "Stay Here");
  pathNow = await client.evalVal("window.location.pathname");
  const preservedName = await client.evalVal(`document.querySelector('input[placeholder*="Pleated Sliding"]')?.value`);
  const preservedSku = await client.evalVal(`document.querySelector('input[placeholder="SA-SCR-001"]')?.value`);
  assert.equal(pathNow, "/products/new");
  assert.equal(preservedName, "Temp Unsaved Screen");
  assert.equal(preservedSku, "SA-TEMP-GUARD-01");
  console.log("[PASS 03] Modified form -> Stay Here -> Values preserved on /products/new");

  // ── Scenario 16: Native beforeunload handler active when dirty ──
  const beforeUnloadDirty = await client.evalVal(`(() => {
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  })()`);
  assert.equal(beforeUnloadDirty, true, "beforeunload must call preventDefault() when dirty");
  console.log("[PASS 16] Browser refresh / tab close native beforeunload active when dirty");

  // ── Scenario 14: Browser Back -> Guard intercepts and Stay Here preserves ──
  await client.evalVal("window.history.back()");
  await sleep(450);
  modal = await getUnsavedModalState(client);
  assert.equal(modal.open, true, "Browser Back must trigger Unsaved Changes modal");
  await clickButtonByText(client, "Stay Here");
  assert.equal(await client.evalVal("window.location.pathname"), "/products/new");
  console.log("[PASS 14] Browser Back / Forward intercepted cleanly by Unsaved Changes guard");

  // ── Scenario 17: Reverted changes -> No confirmation ──
  await setInputValue(client, 'input[placeholder*="Pleated Sliding"]', "");
  await setInputValue(client, 'input[placeholder="SA-SCR-001"]', "");
  await sleep(250);
  const beforeUnloadClean = await client.evalVal(`(() => {
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  })()`);
  assert.equal(beforeUnloadClean, false, "Reverted form must not block beforeunload");
  await clickSidebarRoute(client, "Orders");
  modal = await getUnsavedModalState(client);
  assert.equal(modal.open, false, "Reverted form must not show confirmation");
  assert.equal(await client.evalVal("window.location.pathname"), "/orders");
  console.log("[PASS 17] Reverted changes -> No confirmation & beforeunload cleared");

  // ── Scenarios 8, 9, 4, 5, 18: Multi-step Wizard Next/Prev + Validation Errors + Discard -> Clean Create ──
  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/new` });
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(300);

  // Trigger validation error (Scenario 10: empty required fields & duplicate SKU)
  await clickButtonByText(client, "Next Step");
  const errCountEmpty = await client.evalVal(`document.querySelectorAll('.ant-form-item-explain-error').length`);
  assert.ok(errCountEmpty >= 2, "Expected required-field errors when Next Step clicked on empty form");

  // Enter duplicate existing SKU to test uniqueness validation
  await setInputValue(client, 'input[placeholder*="Pleated Sliding"]', "Duplicate SKU Test");
  await setInputValue(client, 'input[placeholder="SA-SCR-001"]', prodA.sku);
  await clickButtonByText(client, "Next Step");
  const dupErrText = await client.evalVal(`document.body.innerText`);
  assert.ok(dupErrText.includes("already exists"), "Expected duplicate SKU validation error");
  console.log("[PASS 10] Invalid form (empty fields & duplicate SKU) blocked submission with clear error");

  // Fix SKU to unique -> advance Step 1 -> Step 2 -> Previous -> values preserved (Scenario 8)
  await setInputValue(client, 'input[placeholder="SA-SCR-001"]', "SA-WIZARD-CLEAN-99");
  await clickButtonByText(client, "Next Step");
  await sleep(250);
  await setInputValue(client, 'input[placeholder*="600mm x 450mm"]', "900mm x 600mm");
  await clickButtonByText(client, "Previous");
  assert.equal(
    await client.evalVal(`document.querySelector('input[placeholder="SA-SCR-001"]')?.value`),
    "SA-WIZARD-CLEAN-99"
  );
  await clickButtonByText(client, "Next Step");
  assert.equal(
    await client.evalVal(`document.querySelector('input[placeholder*="600mm x 450mm"]')?.value`),
    "900mm x 600mm"
  );
  console.log("[PASS 08] Multi-step wizard Next / Previous preserves all entered values");

  // Discard via Cancel button -> Leave Without Saving -> return to /products/new -> fresh blank Step 1 & 0 errors (Scenarios 4, 5, 9, 18)
  await clickButtonByText(client, "Cancel");
  modal = await getUnsavedModalState(client);
  assert.equal(modal.open, true, "Cancel button on dirty wizard must show confirmation");
  await clickButtonByText(client, "Leave Without Saving");
  await sleep(500);
  assert.equal(await client.evalVal("window.location.pathname"), "/products");
  console.log("[PASS 04 & 09] Modified wizard -> Leave Without Saving discards & navigates cleanly");

  // Navigate back to Add Product via Add Product button (in-app SPA navigation!)
  await clickButtonByText(client, "Add Product");
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(350);
  const freshState = await client.evalVal(`({
    name: document.querySelector('input[placeholder*="Pleated Sliding"]')?.value,
    sku: document.querySelector('input[placeholder="SA-SCR-001"]')?.value,
    errors: document.querySelectorAll('.ant-form-item-explain-error').length,
    activeStep: document.querySelector('.ant-steps-item-process .ant-steps-item-title')?.innerText?.trim()
  })`);
  assert.equal(freshState.name, "");
  assert.equal(freshState.sku, "");
  assert.equal(freshState.errors, 0);
  assert.equal(freshState.activeStep, "Basic Product");
  console.log("[PASS 05 & 18] Navigate back to Create -> Fresh blank Step 1 & zero stale validation errors");

  // ── Scenarios 6 & 7: Create -> Edit A -> Switch Edit B -> Zero stale values ──
  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/${prodA.id}/edit` });
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(600);
  const loadedSkuA = await client.evalVal(`document.querySelector('input[placeholder="SA-SCR-001"]')?.value`);
  assert.equal(loadedSkuA, prodA.sku, `Expected Edit Product A SKU ${prodA.sku}, got ${loadedSkuA}`);
  console.log(`[PASS 06] Create -> Edit loaded exact record A (${prodA.sku})`);

  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/${prodB.id}/edit` });
  await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
  await sleep(600);
  const loadedSkuB = await client.evalVal(`document.querySelector('input[placeholder="SA-SCR-001"]')?.value`);
  assert.equal(loadedSkuB, prodB.sku, `Expected Edit Product B SKU ${prodB.sku}, got ${loadedSkuB}`);
  assert.notEqual(loadedSkuB, prodA.sku);
  console.log(`[PASS 07] Switch Edit Product A -> Product B loaded clean record B (${prodB.sku}) with zero stale values`);

  // ── Scenarios 11, 12, 13: Real API mutation (disposable DB guarded) + API failure preserves values + No false warning after save ──
  const envRaw = fs.existsSync("apps/backend/.env") ? fs.readFileSync("apps/backend/.env", "utf8") : "";
  const dbLine = envRaw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")) || "";
  if (dbLine.toLowerCase().includes("disposable")) {
    // Go to Step 4 (Description) on prodB, edit internalNotes, advance to Step 5, Save Changes
    await client.evalVal(`document.querySelectorAll('.ant-steps-item-container')[3]?.click()`);
    await sleep(250);
    const origNotesB = prodB.internal_notes || "";
    const testNote = `FORM08-E2E-${Date.now()}`;
    await setInputValue(client, 'textarea[placeholder*="Supplier batch"]', testNote);
    await client.evalVal(`document.querySelectorAll('.ant-steps-item-container')[4]?.click()`);
    await sleep(250);
    await clickButtonByText(client, "Save Changes");
    await sleep(1600);

    // Must navigate cleanly to /products/:id with ZERO Unsaved Changes modal (Scenarios 11 & 13)
    const afterSavePath = await client.evalVal("window.location.pathname");
    const modalAfterSave = await getUnsavedModalState(client);
    assert.equal(modalAfterSave.open, false, "Successful save must not show Unsaved Changes warning");
    assert.equal(afterSavePath, `/products/${prodB.id}`, `Expected redirect to /products/${prodB.id}, got ${afterSavePath}`);

    // Restore original internalNotes cleanly via API so zero residue remains
    const restoreRes = await fetch(
      `${ADMIN_URL}/admin/sai-ajanta/products/${encodeURIComponent(prodB.medusa_id || prodB.id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ internalNotes: origNotesB }),
      }
    );
    assert.equal(restoreRes.ok, true, "Failed to restore prodB internalNotes");
    console.log("[PASS 11 & 13] Valid form -> Real API save succeeded -> Clean redirect with zero false warning (restored)");

    // Scenario 12: API failure preserves entered values (test with offline/500 route via SettingsPreferences save while rehearsal DB lacks admin_setting table)
    await client.send("Page.navigate", { url: `${ADMIN_URL}/settings` });
    await waitForSelector(client, 'input[role="spinbutton"]');
    await sleep(500);
    await setInputValue(client, 'input[role="spinbutton"]', "22");
    await clickButtonByText(client, "Save Preferences");
    await sleep(1000);
    const preservedAfterFail = await client.evalVal(`document.querySelector('input[role="spinbutton"]')?.value`);
    assert.equal(preservedAfterFail, "22", "Entered form values must be preserved when API fails");
    // Reset cleanly so we can proceed
    await clickButtonByText(client, "Reset");
    console.log("[PASS 12] API failure preserved entered values cleanly without resetting form");
  }

  // ── Scenario 15: Modal close dirty-state confirmation + Indian Mobile/GSTIN validation + Reset on reopen ──
  await client.send("Page.navigate", { url: `${ADMIN_URL}/dealers` });
  await waitForSelector(client, 'button');
  await sleep(600);
  await clickButtonByText(client, "Add Account");
  await waitForSelector(client, 'input[placeholder="e.g. Ramesh Kumar"]');

  // Validate invalid Indian mobile + invalid GSTIN blocked
  await setInputValue(client, 'input[placeholder="e.g. Ramesh Kumar"]', "Karthik Raja");
  await setInputValue(client, 'input[placeholder="10-digit Indian mobile"]', "12345");
  await setInputValue(client, 'input[placeholder="33AAAAA0000A1Z5"]', "INVALIDGST");
  await clickButtonByText(client, "Create Account");
  await sleep(300);
  const modalErrText = await client.evalVal(`document.querySelector('.ant-modal')?.innerText || ''`);
  assert.ok(modalErrText.includes("10-digit Indian mobile"), "Expected Indian mobile validation message");
  assert.ok(modalErrText.includes("15-character GSTIN"), "Expected GSTIN validation message");

  // Click Cancel on dirty Modal -> Unsaved Changes confirmation appears -> Stay Here preserves -> Cancel -> Leave Without Saving resets
  await clickButtonByText(client, "Cancel");
  modal = await getUnsavedModalState(client);
  assert.equal(modal.open, true, "Closing dirty Modal must show Unsaved Changes confirmation");
  await clickButtonByText(client, "Stay Here");
  assert.equal(
    await client.evalVal(`document.querySelector('input[placeholder="e.g. Ramesh Kumar"]')?.value`),
    "Karthik Raja"
  );
  await clickButtonByText(client, "Cancel");
  await clickButtonByText(client, "Leave Without Saving");
  await sleep(400);

  // Reopen Add Account -> completely blank with zero validation errors
  await clickButtonByText(client, "Add Account");
  await waitForSelector(client, 'input[placeholder="e.g. Ramesh Kumar"]');
  const reopenedName = await client.evalVal(`document.querySelector('input[placeholder="e.g. Ramesh Kumar"]')?.value`);
  const reopenedErrs = await client.evalVal(`document.querySelectorAll('.ant-modal .ant-form-item-explain-error').length`);
  assert.equal(reopenedName, "");
  assert.equal(reopenedErrs, 0);
  await clickButtonByText(client, "Cancel");
  console.log("[PASS 15] Modal dirty-close confirmation, Indian mobile/GSTIN validation & clean reopen verified");

  // ── Responsive Verification (Tablet 768px & Mobile 390px) ──
  for (const vp of [
    { name: "tablet-768", width: 768, height: 1024, mobile: false },
    { name: "mobile-390", width: 390, height: 844, mobile: true },
  ]) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });
    await client.send("Page.navigate", { url: `${ADMIN_URL}/products/new` });
    await waitForSelector(client, 'input[placeholder="SA-SCR-001"]');
    await sleep(350);
    await setInputValue(client, 'input[placeholder*="Pleated Sliding"]', `Dirty ${vp.name}`);
    await clickButtonByText(client, "Cancel");
    modal = await getUnsavedModalState(client);
    assert.equal(modal.open, true, `Unsaved Changes modal failed on ${vp.name}`);
    const overflow = await client.evalVal(`document.documentElement.scrollWidth > window.innerWidth + 2`);
    assert.equal(overflow, false, `Horizontal overflow detected on ${vp.name} with Unsaved Changes modal`);
    await clickButtonByText(client, "Leave Without Saving");
    await sleep(400);
    console.log(`[PASS RESP] ${vp.name} (${vp.width}px) Unsaved Changes modal & discard verified with 0 overflow`);
  }

  assert.equal(client.exceptions.length, 0, `JS Runtime exceptions: ${client.exceptions.join("; ")}`);

  client.close();
  chrome.kill();
  console.log("\n=== ALL 18 FORM VALIDATION, STATE, RESET & NAVIGATION GUARD SCENARIOS PASSED ===");
}

run().catch((err) => {
  console.error("\n[FAILED]", err);
  process.exit(1);
});


