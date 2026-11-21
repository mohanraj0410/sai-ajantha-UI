import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.STOREFRONT_URL || "http://localhost:3000";
const sku = "SA-M-DC-60-001";
const productURL = `${baseURL}/products/${sku}`;
const outDir = path.resolve("evidence/product-reference");
fs.mkdirSync(outDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  productURL,
  safety: "Fresh browser context; all non-GET API requests are intercepted. Enquiry and seller responses are mocked. No checkout or production mutation is performed.",
  checks: [],
  viewports: [],
  blockedMutations: [],
  enquiryPayloads: [],
  pageErrors: [],
  consoleErrors: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
  reducedMotion: "reduce",
});
let enquiryMode = "error";
let sellerMode = "success";
let sellerRequestCount = 0;
await context.route("**/*", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === "/api/seller-resolution") {
    sellerRequestCount++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (sellerMode === "network") return route.abort("failed");
    if (sellerMode === "error") return route.fulfill({ status: 503, json: { message: "QA coverage service unavailable" } });
    return route.fulfill({ json: {
      resolution: {
        sellerName: "QA Regional Distributor",
        resolvedRoute: sellerMode === "unserved" ? "ENQUIRY_ONLY" : "DISTRIBUTOR_RESALE",
        serviceable: sellerMode !== "unserved",
        inStock: true,
        reason: sellerMode === "unserved" ? "QA PIN requires an availability enquiry" : "QA verified distributor coverage",
        allowedNextAction: "ENQUIRE",
      },
    } });
  }
  if (url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method())) {
    if (url.pathname === "/api/enquiries" && req.method() === "POST") {
      report.enquiryPayloads.push(req.postDataJSON());
      if (enquiryMode === "error") return route.fulfill({ status: 422, json: { error: "QA enquiry rejected for retry" } });
      return route.fulfill({ status: 201, json: { success: true, id: "qa-mocked-enquiry-no-database-write" } });
    }
    report.blockedMutations.push({ url: req.url(), method: req.method() });
    return route.fulfill({ status: 409, json: { error: "QA blocks all other mutations" } });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (error) => report.pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.consoleErrors.push(message.text());
});
page.setDefaultTimeout(10000);
async function check(name, action) {
  try {
    const detail = await action();
    report.checks.push({ name, status: "passed", ...(detail === undefined ? {} : { detail }) });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: "failed", error: error.message });
    console.error(`FAIL ${name}: ${error.message.split("\n")[0]}`);
    await page.screenshot({ path: path.join(outDir, `failure-${report.checks.length}.png`), fullPage: true }).catch(() => {});
  }
}
const buy = page.locator(".pdp-buy-card");
const tools = page.locator(".pdp-tools");
const pin = page.locator("#pdp-pincode");
const qty = page.locator("#procure-qty");
const pack = page.locator("#pdp-pack");
const subtotal = page.locator(".pdp-order-subtotal strong");

try {
  await page.goto(productURL, { waitUntil: "networkidle", timeout: 60000 });
  await expect(page.locator(".pdp-hero h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  await check("Live product and all reference sections render", async () => {
    await expect(page.locator("h1")).toContainText("Door closer");
    for (const section of [".pdp-hero", ".pdp-gallery", ".pdp-buy-card", ".pdp-overview-panel", ".pdp-specifications", ".pdp-project-banner", ".pdp-related"]) await expect(page.locator(section)).toHaveCount(1);
    await expect(page.locator(".pdp-price")).toContainText("₹1,148");
    await expect(buy).toContainText("Online payment is currently unavailable");
  });
  await check("Gallery thumbnails and previous/next controls", async () => {
    const thumbs = page.locator(".pdp-thumbnails button[aria-pressed]");
    expect(await thumbs.count()).toBeGreaterThan(0);
    await thumbs.last().click();
    await expect(thumbs.last()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next image", exact: true }).click();
    await expect(thumbs.first()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Previous image", exact: true }).click();
    await expect(thumbs.last()).toHaveAttribute("aria-pressed", "true");
    await thumbs.first().click();
  });
  await check("Photo zoom toggles accessibly", async () => {
    const photo = page.getByRole("button", { name: "Toggle photo zoom", exact: true });
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(photo).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect(photo).toHaveAttribute("aria-pressed", "false");
  });
  await check("Lightbox opens; Escape restores trigger focus", async () => {
    const trigger = page.getByRole("button", { name: "Expand photo in high-resolution lightbox" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").locator("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  await check("Finish selection and engineering table stay in sync", async () => {
    await buy.getByRole("button", { name: "Matte Black", exact: true }).click();
    await expect(buy.getByRole("button", { name: "Matte Black", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".pdp-specifications")).toContainText("Matte Black");
  });
  await check("Quantity controls update subtotal and enforce limits", async () => {
    await expect(qty).toHaveValue("1");
    await expect(buy.getByRole("button", { name: "Decrease quantity", exact: true })).toBeDisabled();
    await buy.getByRole("button", { name: "Increase quantity", exact: true }).click();
    await expect(qty).toHaveValue("2");
    await expect(subtotal).toHaveText("₹2,296");
    await qty.fill("0"); await expect(qty).toHaveValue("1");
    await qty.fill("1000"); await expect(qty).toHaveValue("999");
    await expect(buy.getByRole("button", { name: "Increase quantity", exact: true })).toBeDisabled();
    await qty.fill("2");
  });
  await check("Pack selection recalculates price and subtotal", async () => {
    await pack.click();
    await page.getByRole("option", { name: "Standard Lot (10 Units)", exact: true }).click();
    await expect(page.locator(".pdp-price")).toContainText("₹11,480");
    await expect(subtotal).toHaveText("₹22,960");
    await pack.click();
    await page.getByRole("option", { name: /^Single Unit/ }).click();
    await expect(subtotal).toHaveText("₹2,296");
  });
  await check("Wishlist toggles and persists across reload", async () => {
    await tools.getByRole("button", { name: "Save", exact: true }).click();
    await expect(tools.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.reload({ waitUntil: "networkidle" });
    await expect(tools.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
    await tools.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(tools.getByRole("button", { name: "Save", exact: true })).toHaveAttribute("aria-pressed", "false");
  });
  await check("Compare toggles", async () => {
    const button = tools.getByRole("button", { name: "Compare", exact: true });
    await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click(); await expect(button).toHaveAttribute("aria-pressed", "false");
  });
  await check("SKU and share buttons copy correct values", async () => {
    await page.getByRole("button", { name: `Copy SKU ${sku}`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Copied SKU ${sku}`, exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sku);
    await tools.getByRole("button", { name: "Share", exact: true }).click();
    await expect(tools.getByRole("button", { name: "Link copied", exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(productURL);
  });
  await check("PIN validation filters input and avoids invalid requests", async () => {
    const countBefore = sellerRequestCount;
    await pin.fill("12ab");
    await expect(pin).toHaveValue("12");
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy).toContainText("Enter a valid 6-digit delivery PIN code.");
    expect(sellerRequestCount).toBe(countBefore);
  });
  await check("PIN loading and success show resolved seller", async () => {
    sellerMode = "success";
    await pin.fill("620001");
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy.getByRole("button", { name: "Checking...", exact: true })).toBeDisabled();
    await expect(buy).toContainText("PIN 620001: Serviceable — Fulfilled by QA Regional Distributor");
    await expect(page.locator(".pdp-seller")).toContainText("QA Regional Distributor");
  });
  await check("Editing PIN clears prior resolved seller", async () => {
    await pin.fill("600001");
    await expect(buy).not.toContainText("PIN 620001:");
    await expect(page.locator(".pdp-seller")).not.toContainText("QA Regional Distributor");
  });
  await check("Unserved PIN displays enquiry response", async () => {
    sellerMode = "unserved";
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy).toContainText("PIN 600001: QA PIN requires an availability enquiry");
  });
  await check("Seller API error and network error remain recoverable", async () => {
    sellerMode = "error";
    await pin.fill("620002");
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy).toContainText("QA coverage service unavailable");
    sellerMode = "network";
    await pin.fill("620003");
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy).toContainText("Unable to verify PIN code serviceability right now.");
    sellerMode = "success";
    await pin.fill("620001");
    await buy.getByRole("button", { name: "Check PIN", exact: true }).click();
    await expect(buy).toContainText("PIN 620001: Serviceable");
  });
  await check("Quote opens, validates empty form, and returns keyboard focus", async () => {
    const trigger = buy.getByRole("button", { name: "Ask about availability", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Request Sample / Trade Quote");
    await dialog.getByRole("button", { name: "Send Trade Request", exact: true }).click();
    await expect(dialog).toContainText("Please enter your name and phone number or work email.");
    expect(report.enquiryPayloads).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
  await check("Quote mocked failure retries successfully with selected item payload", async () => {
    await buy.getByRole("button", { name: "Matte Black", exact: true }).click();
    await qty.fill("3");
    await pack.click(); await page.getByRole("option", { name: "Standard Lot (10 Units)", exact: true }).click();
    await buy.getByRole("button", { name: "Ask about availability", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#q-name").fill("QA Product Reference");
    await dialog.locator("#q-phone").fill("9876543210");
    await dialog.locator("#q-email").fill("qa-product-reference@example.invalid");
    await dialog.locator("#q-notes").fill("Intercepted UI regression; no production write.");
    enquiryMode = "error";
    await dialog.getByRole("button", { name: "Send Trade Request", exact: true }).click();
    await expect(dialog).toContainText("QA enquiry rejected for retry");
    enquiryMode = "success";
    await dialog.getByRole("button", { name: "Send Trade Request", exact: true }).click();
    await expect(dialog).toContainText("Request Logged Successfully");
    const payload = report.enquiryPayloads.at(-1);
    expect(payload.postal_code).toBe("620001");
    expect(payload.items[0]).toMatchObject({ sku, quantity: 3, pack: "Standard Lot (10 Units)", unitPriceInr: 11480 });
    expect(payload.notes).toContain("Matte Black");
    await dialog.getByRole("button", { name: "Close Dialog", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
  await check("Technical tabs work with pointer and keyboard", async () => {
    const section = page.locator(".pdp-specifications");
    for (const name of ["Supply & Tax", "Installation", "Warranty", "Engineering"]) {
      const tab = section.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(section.getByRole("tabpanel")).toBeVisible();
    }
    await section.getByRole("tab", { name: "Engineering", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(section.getByRole("tab", { name: "Supply & Tax", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(section.getByRole("tab", { name: "Supply & Tax", exact: true })).toHaveAttribute("aria-selected", "true");
    await section.getByRole("tab", { name: "Engineering", exact: true }).click();
  });
  await check("Print button invokes print", async () => {
    await page.evaluate(() => { window.__qaPrintCalls = 0; window.print = () => { window.__qaPrintCalls++; }; });
    await page.getByRole("button", { name: "Print specs", exact: true }).click();
    expect(await page.evaluate(() => window.__qaPrintCalls)).toBe(1);
  });
  await check("Technical jump and installation/contact links retain destinations", async () => {
    await page.getByRole("link", { name: "View technical specs", exact: true }).click();
    expect(new URL(page.url()).hash).toBe("#technical-specs");
    await expect(buy.getByRole("link", { name: /^Request installation$/i })).toHaveAttribute("href", `/installation?sku=${sku}&category=Door%20Closer%20%26%20Floor%20Spring`);
    await expect(buy.getByRole("link", { name: "WhatsApp Desk", exact: true })).toHaveAttribute("href", /^https:\/\/wa\.me\/919842406588\?text=/);
    await expect(page.locator(".pdp-project-banner a[href^='tel:']")).toHaveCount(1);
  });
  await check("Add to cart preserves selected variant and quantity locally", async () => {
    await buy.getByRole("button", { name: "Add to cart", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Project Cart (3)");
    await expect(dialog).toContainText("Matte Black");
    await expect(dialog).toContainText("Standard Lot (10 Units)");
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("sai-ajanta-ui-prefs-v3:guest")));
    expect(state.cart[0]).toMatchObject({ sku, quantity: 3, finish: "Matte Black", packMultiplier: 10 });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem("sai-ajanta-ui-prefs-v3:guest")));
    expect(afterReload.cart[0]).toMatchObject({ sku, quantity: 3 });
  });
  await check("Related products navigate to their actual product route", async () => {
    const target = page.locator(".pdp-related a[href^='/products/']").first();
    const href = await target.getAttribute("href");
    expect(href).not.toBe(`/products/${sku}`);
    await target.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\?.*)?$"));
    // Next preserves previously visited route trees hidden during client navigation.
    await expect(page.locator(".pdp-hero h1:visible")).toHaveCount(1);
    await page.goto(productURL, { waitUntil: "networkidle" });
  });
  await check("Floor springs retain enquiry-only behavior", async () => {
    await page.goto(`${baseURL}/products/SA-I-FS-TON90-007`, { waitUntil: "networkidle" });
    await expect(page.locator(".pdp-hero")).toContainText("Floor Spring — Request Quote / Enquiry Only");
    await expect(page.locator(".pdp-order-actions").getByRole("button", { name: "Request a quote", exact: true })).toBeVisible();
    await expect(page.locator(".pdp-order-actions").getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(0);
    await page.goto(productURL, { waitUntil: "networkidle" });
  });
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await check(`Responsive viewport ${width}px has no page overflow`, async () => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      const metrics = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        overflowingElements: [...document.querySelectorAll("body *")].filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.right > window.innerWidth + 1 && getComputedStyle(element).position !== "fixed";
        }).slice(0, 8).map((element) => ({ tag: element.tagName, className: String(element.className).slice(0, 150) })),
      }));
      report.viewports.push({ width, ...metrics });
      expect(metrics.document).toBeLessThanOrEqual(width + 1);
      expect(metrics.body).toBeLessThanOrEqual(width + 1);
      await expect(buy.getByRole("button", { name: "Add to cart", exact: true })).toBeVisible();
      await expect(page.locator(".pdp-specifications").getByRole("tab", { name: "Engineering", exact: true })).toBeVisible();
      if ([768, 390, 320].includes(width)) await page.screenshot({ path: path.join(outDir, `responsive-${width}.png`), fullPage: true });
      return metrics;
    });
  }
  await check("No uncaught page errors", async () => expect(report.pageErrors).toEqual([]));
  await check("No unexpected browser console errors", async () => {
    const unexpected = report.consoleErrors.filter((message) => !/Failed to load resource: (?:the server responded with a status of (?:503|422)|net::ERR_FAILED)/.test(message));
    expect(unexpected).toEqual([]);
    return "503, 422, and ERR_FAILED entries are intentionally mocked seller/enquiry failure coverage.";
  });
  await check("No unexpected API mutation attempts", async () => expect(report.blockedMutations).toEqual([]));
} catch (error) {
  report.checks.push({ name: "Test setup or execution", status: "failed", error: error.stack });
} finally {
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter((result) => result.status === "passed").length,
    failed: report.checks.filter((result) => result.status === "failed").length,
  };
  fs.writeFileSync(path.join(outDir, "functional-results.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}
