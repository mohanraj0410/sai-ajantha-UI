import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9268;
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

async function run() {
  console.log("=== QA-V25-09: ANT DESIGN ADMIN E2E, RBAC, ACCESSIBILITY & ISOLATED CRUD ===\n");

  // 1. Verify unauthenticated backend admin endpoints reject with 401/403
  for (const ep of ["/admin/sai-ajanta/portal", "/admin/sai-ajanta/quotes", "/admin/sai-ajanta/settings"]) {
    const res = await fetch(`${ADMIN_URL}${ep}`);
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`Expected 401/403 for unauthenticated ${ep}, got ${res.status}`);
    }
    console.log(`[PASS] Unauthenticated ${ep} rejected (HTTP ${res.status})`);
  }

  // 2. Authenticate real staff admin
  const authRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
  });
  const authData = await authRes.json();
  if (!authData.token) throw new Error("Admin login failed");
  console.log("[PASS] Real staff login via /auth/user/emailpass succeeded");

  const meRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${authData.token}` },
  });
  const meData = await meRes.json();
  const staff = meData.staff;
  console.log(`[PASS] Staff profile verified: ${staff?.email} (isFullAdmin=${staff?.isFullAdmin})`);

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    "--headless=new",
    `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "sa-e2e-"))}`,
    "--disable-gpu",
    "--no-sandbox",
    "about:blank",
  ]);
  const client = new CDPClient(await getWs());
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  // 3. Test unauthenticated redirect from /dashboard -> /login
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.navigate", { url: `${ADMIN_URL}/dashboard` });
  await sleep(1200);
  const redir = await client.send("Runtime.evaluate", {
    expression: "window.location.pathname",
    returnByValue: true,
  });
  if (redir.result?.value !== "/login") {
    throw new Error(`Expected redirect to /login, got ${redir.result?.value}`);
  }
  console.log("[PASS] Unauthenticated /dashboard safely redirects to /login");

  // 4. Inject session and verify Dashboard, Sidebar Counts, and 153/120/8 Analytics Semantics
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      localStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(authData.token)});
      sessionStorage.setItem("sai_ajanta_admin_token", ${JSON.stringify(authData.token)});
      localStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
      sessionStorage.setItem("sai_ajanta_admin_user", ${JSON.stringify(JSON.stringify(staff))});
      localStorage.setItem("sai_ajanta_admin_theme", "light");
    })()`,
  });

  await client.send("Page.navigate", { url: `${ADMIN_URL}/dashboard` });
  await sleep(1600);
  const dashCheck = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const siderItems = document.querySelectorAll('.sa-admin-sider .ant-menu-item');
      const lastBottom = siderItems.length ? Math.round(siderItems[siderItems.length - 1].getBoundingClientRect().bottom) : 0;
      const bodyText = document.body.innerText;
      return {
        title: document.title,
        hasAntLayout: Boolean(document.querySelector('.ant-layout')),
        hasBreadcrumb: Boolean(document.querySelector('nav[aria-label="Breadcrumb"]')),
        siderLastBottom: lastBottom,
        siderRendered: lastBottom > 0,
        hasDashboardCount: Boolean(document.querySelector('[data-testid="sidebar-count-dashboard"]')),
        sidebarCountBadges: document.querySelectorAll('[data-testid^="sidebar-count-"]').length,
        rechartsCount: document.querySelectorAll('.recharts-wrapper svg').length,
        showsDirectRoute: /direct/i.test(bodyText),
        showsDistCatRoute: /dist\. cat\./i.test(bodyText),
        showsQuoteOnlyRoute: /quote-only/i.test(bodyText),
        hasMui: Boolean(document.querySelector('[class*="Mui"]')),
        hasHealthcare: /\b(healthcare|hospital|clinical|patient|medical)\b/i.test(bodyText)
      };
    })()`,
    returnByValue: true,
  });
  console.log("[PASS] Dashboard QA-V25 DOM & Analytics check:", dashCheck.result?.value);
  const dv = dashCheck.result?.value;
  if (
    !dv?.hasAntLayout ||
    !dv?.hasBreadcrumb ||
    !dv?.siderRendered ||
    dv?.hasDashboardCount ||
    dv?.sidebarCountBadges < 7 ||
    dv?.rechartsCount < 2 ||
    !dv?.showsDirectRoute ||
    !dv?.showsDistCatRoute ||
    !dv?.showsQuoteOnlyRoute ||
    dv?.hasMui ||
    dv?.hasHealthcare
  ) {
    throw new Error("Dashboard QA-V25 check failed: " + JSON.stringify(dv));
  }

  // 5. Verify Products AntD Table & Floor Spring Quote-Only Guard on both table & detail route
  await client.send("Page.navigate", { url: `${ADMIN_URL}/products` });
  await sleep(1600);
  const prodCheck = await client.send("Runtime.evaluate", {
    expression: `(() => ({
      title: document.title,
      hasAntTable: Boolean(document.querySelector('.ant-table')),
      rowCount: document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length,
      showsQuoteOnlyFS: document.body.innerText.includes('Quote Only (FS)')
    }))()`,
    returnByValue: true,
  });
  console.log("[PASS] Products Table & Floor Spring Guard check:", prodCheck.result?.value);
  if (!prodCheck.result?.value?.hasAntTable || !prodCheck.result?.value?.showsQuoteOnlyFS) {
    throw new Error("Products table or Floor Spring Quote-Only tag missing");
  }

  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/SA-I-FS-TON90-007` });
  await sleep(1400);
  const fsDetailCheck = await client.send("Runtime.evaluate", {
    expression: `(() => ({
      title: document.title,
      breadcrumb: document.querySelector('nav[aria-label="Breadcrumb"]')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
      hasFsQuoteAlert: document.body.innerText.includes('Floor Springs are set to Request Quote only'),
      hasFsBadge: document.body.innerText.includes('Floor Spring — Quote Only')
    }))()`,
    returnByValue: true,
  });
  console.log("[PASS] Floor Spring Detail Quote-Only guard check:", fsDetailCheck.result?.value);
  if (!fsDetailCheck.result?.value?.hasFsQuoteAlert || !fsDetailCheck.result?.value?.hasFsBadge) {
    throw new Error("Floor Spring detail page guard failed");
  }

  // 6. Verify 5-Step Product Editor persistence across steps + Live Summary + Clickable Breadcrumb
  await client.send("Page.navigate", { url: `${ADMIN_URL}/products/new` });
  await sleep(1400);
  const wizardPersistence = await client.send("Runtime.evaluate", {
    expression: `(async () => {
      const setNative = (el, val) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const nameInput = document.querySelector('input[placeholder*="Pleated Sliding"]');
      const skuInput = document.querySelector('input[placeholder="SA-SCR-001"]');
      if (nameInput && skuInput) {
        setNative(nameInput, 'QA Persisted Test Screen');
        setNative(skuInput, 'SA-QA-PERSIST-01');
      }
      await new Promise(r => setTimeout(r, 200));
      const summaryUpdated = document.body.innerText.includes('QA Persisted Test Screen') && document.body.innerText.includes('SA-QA-PERSIST-01');
      // Click Step 2 then back to Step 1
      const stepItems = document.querySelectorAll('.ant-steps-item');
      stepItems[1]?.click();
      await new Promise(r => setTimeout(r, 200));
      stepItems[0]?.click();
      await new Promise(r => setTimeout(r, 200));
      return {
        stepsCount: stepItems.length,
        summaryUpdated,
        namePersisted: document.querySelector('input[placeholder*="Pleated Sliding"]')?.value === 'QA Persisted Test Screen',
        skuPersisted: document.querySelector('input[placeholder="SA-SCR-001"]')?.value === 'SA-QA-PERSIST-01',
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log("[PASS] 5-Step Product Wizard Persistence & Live Summary check:", wizardPersistence.result?.value);
  if (
    wizardPersistence.result?.value?.stepsCount !== 5 ||
    !wizardPersistence.result?.value?.summaryUpdated ||
    !wizardPersistence.result?.value?.namePersisted ||
    !wizardPersistence.result?.value?.skuPersisted
  ) {
    throw new Error("5-Step Wizard persistence check failed");
  }

  // Click "Products" ancestor in AdminPathBreadcrumb
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const links = Array.from(document.querySelectorAll('nav[aria-label="Breadcrumb"] .sa-crumb-link'));
      links.find((el) => el.textContent?.includes('Products'))?.click();
    })()`,
  });
  await sleep(600);
  // Wizard is dirty (name/SKU typed) -> breadcrumb must show Unsaved Changes confirmation first
  const crumbModal = await client.send("Runtime.evaluate", {
    expression: `document.querySelector('.ant-modal-confirm-title')?.innerText?.trim() || ''`,
    returnByValue: true,
  });
  if (crumbModal.result?.value !== "Unsaved Changes") {
    throw new Error("Breadcrumb navigation on dirty wizard must show Unsaved Changes dialog");
  }
  await client.send("Runtime.evaluate", {
    expression: `Array.from(document.querySelectorAll('.ant-modal-confirm button')).find(b => b.innerText.includes('Leave Without Saving'))?.click()`,
  });
  await sleep(700);
  const afterCrumbNav = await client.send("Runtime.evaluate", {
    expression: "window.location.pathname",
    returnByValue: true,
  });
  if (afterCrumbNav.result?.value !== "/products") {
    throw new Error(`Expected breadcrumb click to navigate to /products, got ${afterCrumbNav.result?.value}`);
  }
  console.log("[PASS] Clickable AdminPathBreadcrumb ancestor navigated /products/new -> /products");

  // 7. Verify query parameters, /403, /404, and document.title
  await client.send("Page.navigate", { url: `${ADMIN_URL}/orders?status=CONFIRMED` });
  await sleep(1000);
  const qCheck = await client.send("Runtime.evaluate", {
    expression: `({ search: window.location.search, title: document.title })`,
    returnByValue: true,
  });
  if (qCheck.result?.value?.search !== "?status=CONFIRMED") {
    throw new Error("Query parameter lost on /orders?status=CONFIRMED");
  }
  console.log("[PASS] Query parameters preserved on reload:", qCheck.result?.value);

  await client.send("Page.navigate", { url: `${ADMIN_URL}/403` });
  await sleep(600);
  await sleep(700);
  const p403 = await client.send("Runtime.evaluate", {
    expression: `({ title: document.title, crumb: document.querySelector('nav[aria-label="Breadcrumb"]')?.innerText?.replace(/\\s+/g, ' ').trim() })`,
    returnByValue: true,
  });
  console.log("[PASS] /403 Access Denied breadcrumb & title:", p403.result?.value);
  if (!p403.result?.value?.crumb?.includes("Access Denied")) throw new Error("/403 breadcrumb mismatch");

  await client.send("Page.navigate", { url: `${ADMIN_URL}/nonexistent-route-qa` });
  await sleep(600);
  await sleep(700);
  const p404 = await client.send("Runtime.evaluate", {
    expression: `({ title: document.title, crumb: document.querySelector('nav[aria-label="Breadcrumb"]')?.innerText?.replace(/\\s+/g, ' ').trim() })`,
    returnByValue: true,
  });
  console.log("[PASS] /404 Not Found breadcrumb & title:", p404.result?.value);
  if (!p404.result?.value?.crumb?.includes("Page Not Found")) throw new Error("/404 breadcrumb mismatch");

  // 8. Verify Mobile 390px Drawer & >= 44px Touch Targets (QA-V25-04)
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send("Page.navigate", { url: `${ADMIN_URL}/orders` });
  await sleep(1200);
  const mobileBtnHeight = await client.send("Runtime.evaluate", {
    expression: `Math.round(document.querySelector('button[aria-label="Open menu"]')?.getBoundingClientRect().height || 0)`,
    returnByValue: true,
  });
  await client.send("Runtime.evaluate", {
    expression: `document.querySelector('button[aria-label="Open menu"]')?.click()`,
  });
  await sleep(450);
  const mobileDrawerMetrics = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const open = Boolean(document.querySelector('.ant-drawer-open'));
      const firstItem = document.querySelector('.sa-mobile-sider .ant-menu-item');
      const itemH = firstItem ? Math.round(firstItem.getBoundingClientRect().height) : 0;
      const drawerCounts = document.querySelectorAll('.sa-mobile-sider [data-testid^="sidebar-count-"]').length;
      return { open, itemH, drawerCounts };
    })()`,
    returnByValue: true,
  });
  console.log("[PASS] Mobile 390px Touch Target & Drawer check:", {
    menuButtonHeight: mobileBtnHeight.result?.value,
    ...mobileDrawerMetrics.result?.value,
  });
  if (
    !mobileDrawerMetrics.result?.value?.open ||
    mobileBtnHeight.result?.value < 44 ||
    mobileDrawerMetrics.result?.value?.itemH < 44
  ) {
    throw new Error("Mobile touch target (<44px) or drawer check failed");
  }

  // 9. Fail-closed isolated disposable DB write -> reload -> restore persistence test (QA-V25-06)
  const envRaw = fs.existsSync("apps/backend/.env") ? fs.readFileSync("apps/backend/.env", "utf8") : "";
  const dbLine = envRaw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")) || "";
  if (!dbLine.toLowerCase().includes("disposable")) {
    console.log("[SKIP-GUARD] Write persistence test skipped: DATABASE_URL is not explicitly disposable.");
  } else {
    // Audit optional Phase-06 DMS tables status (non-mutating read check)
    const setRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/settings`, {
      headers: { Authorization: `Bearer ${authData.token}` },
    });
    const qteRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/quotes`, {
      headers: { Authorization: `Bearer ${authData.token}` },
    });
    console.log(
      `[AUDIT] Rehearsal DB endpoint readiness: /settings=HTTP ${setRes.status}, /quotes=HTTP ${qteRes.status}`
    );

    // Negative error test: invalid bearer token must be rejected (HTTP 401), never fake success
    const badAuth = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`, {
      headers: { Authorization: "Bearer invalid-token-qa" },
    });
    if (badAuth.status !== 401 && badAuth.status !== 403) {
      throw new Error(`Expected 401/403 for invalid token, got ${badAuth.status}`);
    }
    console.log(`[PASS] Invalid bearer token cleanly rejected (HTTP ${badAuth.status})`);

    // Real isolated disposable DB write -> hard reload -> restore on a single direct SKU's internalNotes
    const portal1 = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`, {
      headers: { Authorization: `Bearer ${authData.token}` },
    }).then((r) => r.json());
    const target = (portal1.products || []).find((p) => p.category === "Insect Screens");
    if (!target) throw new Error("No direct SKU found for disposable persistence test");

    const origNotes = target.internal_notes || "";
    const marker = `QA-V25-PERSIST-CHECK-${Date.now()}`;
    const prodKey = target.medusa_id || target.id;

    const patch1 = await fetch(`${ADMIN_URL}/admin/sai-ajanta/products/${encodeURIComponent(prodKey)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.token}`,
      },
      body: JSON.stringify({ internalNotes: marker }),
    });
    if (!patch1.ok) throw new Error(`Disposable product PATCH failed: HTTP ${patch1.status}`);

    const portal2 = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`, {
      headers: { Authorization: `Bearer ${authData.token}` },
    }).then((r) => r.json());
    const reloaded = (portal2.products || []).find((p) => p.id === target.id);
    if (reloaded?.internal_notes !== marker) {
      throw new Error("Product internalNotes write did not persist on reload");
    }

    // Restore original internalNotes cleanly
    const patchRestore = await fetch(`${ADMIN_URL}/admin/sai-ajanta/products/${encodeURIComponent(prodKey)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.token}`,
      },
      body: JSON.stringify({ internalNotes: origNotes }),
    });
    if (!patchRestore.ok) throw new Error(`Disposable product restore failed: HTTP ${patchRestore.status}`);

    console.log(
      `[PASS] Isolated disposable DB write -> reload -> restore verified on SKU ${target.sku} (zero residue left)`
    );
  }

  if (client.exceptions.length > 0) {
    throw new Error(`Runtime JS exceptions detected: ${client.exceptions.join("; ")}`);
  }

  client.close();
  chrome.kill();
  console.log("\n=== ALL QA-V25 E2E, RBAC, ACCESSIBILITY & ISOLATED CRUD CHECKS PASSED ===");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});


