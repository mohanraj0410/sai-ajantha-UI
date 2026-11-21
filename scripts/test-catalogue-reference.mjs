import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.STOREFRONT_URL || "http://localhost:3000";
const catalogueURL = `${baseURL}/products`;
const outDir = path.resolve("evidence/catalogue-reference");
fs.mkdirSync(outDir, { recursive: true });
const catalogResponse = await fetch(`${baseURL}/api/products`);
if (!catalogResponse.ok) throw new Error(`Live catalogue unavailable (${catalogResponse.status})`);
const liveCatalog = await catalogResponse.json();
const products = liveCatalog.products;
const productMap = new Map(products.map((product) => [product.id, product]));
const report = {
  startedAt: new Date().toISOString(),
  catalogueURL,
  safety: "Fresh browser context. All non-GET API requests are intercepted and blocked. Product GET responses are read live or mocked for loading/error/empty coverage. No checkout or production mutation is performed.",
  liveProductCount: products.length,
  checks: [],
  viewports: [],
  blockedMutations: [],
  pageErrors: [],
  consoleErrors: [],
  networkErrors: [],
  mediaAudits: [],
};
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
let catalogMode = "live";
await context.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    report.blockedMutations.push({ url: request.url(), method: request.method() });
    return route.fulfill({ status: 409, json: { error: "QA blocks all API mutations" } });
  }
  if (url.pathname === "/api/products") {
    if (catalogMode === "error") return route.fulfill({ status: 503, json: { error: "QA catalogue unavailable" } });
    if (catalogMode === "empty") return route.fulfill({ json: { ...liveCatalog, count: 0, products: [] } });
    if (catalogMode === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return route.fulfill({ json: liveCatalog });
    }
  }
  return route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on("pageerror", (error) => report.pageErrors.push({ url: page.url(), message: error.message }));
page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
page.on("response", (response) => {
  if (response.status() >= 400) report.networkErrors.push({ url: response.url(), status: response.status(), resourceType: response.request().resourceType() });
});
const root = page.locator(".sa-catalogue:visible");
const cards = root.locator(".sa-product-card");
const search = root.getByRole("searchbox", { name: "Filter product catalogue", exact: true });
const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem("sai-ajanta-ui-prefs-v3:guest") || "{}"));
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value);
async function check(name, action) {
  try {
    const detail = await action();
    report.checks.push({ name, status: "passed", ...(detail === undefined ? {} : { detail }) });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: "failed", error: error.message });
    console.error(`FAIL ${name}: ${error.message.split("\n")[0]}`);
    await page.screenshot({ path: path.join(outDir, `failure-${report.checks.length}.png`), fullPage: true }).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }
}
async function load(query = "") {
  await page.goto(`${catalogueURL}${query}`, { waitUntil: "networkidle", timeout: 60000 });
  await expect(root).toBeVisible();
  if (catalogMode === "live") await expect(cards.first()).toBeVisible();
}
async function ids() {
  return cards.evaluateAll((elements) => elements.map((element) => {
    const href = element.querySelector("a[href^='/products/']")?.getAttribute("href") || "";
    return decodeURIComponent(href.split("/").at(-1));
  }));
}
async function auditPhotos(label, requireAll = false) {
  const photos = [];
  const renderedIds = await ids();
  for (let index = 0; index < await cards.count(); index++) {
    const stage = cards.nth(index).locator(".sa-card-photo");
    await stage.scrollIntoViewIfNeeded();
    await expect.poll(() => stage.evaluate((element) => {
      const image = element.querySelector("img");
      return image ? image.complete && image.naturalWidth > 0 : element.textContent.includes("Photo unavailable");
    }), { timeout: 10000 }).toBe(true);
    const photo = await stage.evaluate((element) => {
      const image = element.querySelector("img");
      return { loaded: !!image && image.complete && image.naturalWidth > 0, currentUrl: image?.currentSrc || image?.src || null };
    });
    const product = productMap.get(renderedIds[index]);
    const requestedUrl = photo.currentUrl ? new URL(photo.currentUrl).searchParams.get("url") || photo.currentUrl : null;
    photos.push({ sku: product.code, originalUrl: product.src, ...photo, requestedUrl, status: !photo.loaded ? "unavailable" : requestedUrl === product.src ? "loaded-original" : "loaded-fallback" });
  }
  const summary = { label, total: photos.length, loaded: photos.filter((photo) => photo.loaded).length, unavailable: photos.filter((photo) => !photo.loaded), fallbacks: photos.filter((photo) => photo.status === "loaded-fallback") };
  report.mediaAudits.push(summary);
  if (requireAll) expect(summary.unavailable).toEqual([]);
  return summary;
}
async function choose(label, optionName) {
  await expandFilter(label);
  await root.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: optionName }).click();
}
async function chooseFirstSpecific(label) {
  await expandFilter(label);
  await root.getByRole("combobox", { name: label, exact: true }).click();
  const options = page.getByRole("option");
  if (await options.count() === 1) { await page.keyboard.press("Escape"); return null; }
  const labelText = await options.nth(1).innerText();
  await options.nth(1).click();
  return labelText.trim();
}
async function expandFilter(label) {
  const group = root.locator("details").filter({ has: page.locator(`[aria-label="${label}"]`) }).first();
  if (await group.count() && await group.getAttribute("open") === null) await group.locator("summary").click();
}
async function selectCategory(category) {
  let option = root.getByRole("checkbox", { name: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`) });
  if (await option.count() === 0) {
    await root.getByRole("button", { name: /View more/ }).first().click();
    option = root.getByRole("checkbox", { name: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`) });
  }
  await option.first().check();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe(category === "All" ? null : category);
}
async function confirmQuery(key, value) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value);
}

try {
  await load();
  await check("Live catalogue renders actual products, prices, images and total", async () => {
    expect(products.length).toBeGreaterThan(18);
    expect(await cards.count()).toBe(18);
    const renderedIds = await ids();
    expect(new Set(renderedIds).size).toBe(18);
    for (let index = 0; index < renderedIds.length; index++) {
      const product = productMap.get(renderedIds[index]);
      expect(product).toBeTruthy();
      await expect(cards.nth(index)).toContainText(product.name);
      if (product.unitPriceInr !== null && !product.isQuoteOnly && !/floor spring/i.test(product.name)) await expect(cards.nth(index)).toContainText(money(product.unitPriceInr));
    }
    await expect(root.locator(".catalogue-result-count")).toContainText(String(products.length));
    const media = await auditPhotos("Initial first 18 products", true);
    return { rendered: renderedIds.length, total: products.length, loadedPhotos: media.loaded, fallbackPhotos: media.fallbacks.length };
  });
  await check("Desktop Resources menu retains all destinations", async () => {
    const trigger = page.locator("[data-header-resources]").getByRole("button", { name: "Resources", exact: true });
    await trigger.click();
    for (const [name, href] of [["Guides & Articles", "/blogs"], ["Solutions", "/solutions"], ["Projects", "/projects"]]) {
      await expect(page.getByRole("link", { name, exact: true }).filter({ visible: true }).first()).toHaveAttribute("href", href);
    }
    await page.keyboard.press("Escape");
  });
  await check("Pagination advances and restores first page", async () => {
    const firstPage = await ids();
    await expect(root.getByRole("button", { name: "Go to previous page", exact: true })).toBeDisabled();
    await root.getByRole("button", { name: "Go to next page", exact: true }).click();
    await expect.poll(async () => (await ids())[0]).not.toBe(firstPage[0]);
    expect((await ids()).some((id) => firstPage.includes(id))).toBe(false);
    await root.getByRole("button", { name: "Go to previous page", exact: true }).click();
    expect(await ids()).toEqual(firstPage);
  });
  await check("SKU search updates URL and survives reload", async () => {
    await search.fill("SA-M-DC-60-001");
    await confirmQuery("q", "SA-M-DC-60-001");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("SA-M-DC-60-001");
    await page.reload({ waitUntil: "networkidle" });
    await expect(search).toHaveValue("SA-M-DC-60-001");
    await expect(cards).toHaveCount(1);
    await root.getByRole("button", { name: "Clear search query", exact: true }).click();
    await confirmQuery("q", null);
    await expect(cards).toHaveCount(18);
  });
  await check("Search empty state resets filters", async () => {
    await search.fill("qa-no-catalogue-match-9f873");
    await expect(root).toContainText("No matching products");
    await expect(cards).toHaveCount(0);
    await root.getByRole("button", { name: "Reset All Filters", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(cards).toHaveCount(18);
    await expect.poll(() => new URL(page.url()).search).toBe("");
  });
  await check("Category filtering uses real category count and URL", async () => {
    await selectCategory("Aluminium");
    const expectedCount = products.filter((product) => product.category === "Aluminium").length;
    await expect(root.locator(".catalogue-result-count")).toContainText(String(expectedCount));
    expect((await ids()).every((id) => productMap.get(id).category === "Aluminium")).toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    expect((await ids()).every((id) => productMap.get(id).category === "Aluminium")).toBe(true);
    await auditPhotos("Aluminium category");
  });
  await check("Category browser history restores prior selection", async () => {
    await selectCategory("Hardware");
    await page.goBack({ waitUntil: "networkidle" });
    await confirmQuery("category", "Aluminium");
    expect((await ids()).every((id) => productMap.get(id).category === "Aluminium")).toBe(true);
    await page.goForward({ waitUntil: "networkidle" });
    await confirmQuery("category", "Hardware");
    expect((await ids()).every((id) => productMap.get(id).category === "Hardware")).toBe(true);
    await auditPhotos("Hardware category");
  });
  await check("Size, material and finish filters synchronize URL", async () => {
    const unavailableFilters = [];
    for (const [label, key] of [["Filter by size", "size"], ["Filter by material", "material"], ["Filter by finish", "finish"]]) {
      await load();
      const option = await chooseFirstSpecific(label);
      if (option === null) { unavailableFilters.push(key); continue; }
      await confirmQuery(key, option);
      expect(await cards.count()).toBeGreaterThan(0);
      await page.reload({ waitUntil: "networkidle" });
      await expect(root.getByRole("combobox", { name: label, exact: true })).toContainText(option);
      await auditPhotos(`${key}: ${option}`);
    }
    await selectCategory("Aluminium");
    for (const key of ["size", "material", "finish"]) await confirmQuery(key, null);
    return { unavailableFilters, note: "Filters without any catalogued values are recorded instead of inventing product data." };
  });
  await check("Approval and public-price filters work", async () => {
    await load();
    await choose("Filter by specification status", "Approved Spec Only");
    expect((await ids()).every((id) => productMap.get(id).approved)).toBe(true);
    await choose("Filter by specification status", "With Listed Public Price");
    expect((await ids()).every((id) => productMap.get(id).unitPriceInr !== null)).toBe(true);
  });
  await check("Brand filter uses live brand values and URL", async () => {
    await load();
    const brand = products.find((product) => product.brand?.trim())?.brand.trim();
    expect(brand).toBeTruthy();
    const group = root.locator("details").filter({ has: page.locator("summary", { hasText: /^Brand$/ }) }).first();
    const checkbox = group.getByRole("checkbox").filter({ visible: true }).first();
    await checkbox.check();
    const selectedBrand = new URL(page.url()).searchParams.get("brand");
    await expect.poll(() => new URL(page.url()).searchParams.get("brand")).not.toBe(null);
    const currentBrand = new URL(page.url()).searchParams.get("brand") || selectedBrand;
    expect((await ids()).every((id) => productMap.get(id).brand?.trim() === currentBrand)).toBe(true);
    await page.reload({ waitUntil: "networkidle" });
    expect((await ids()).every((id) => productMap.get(id).brand?.trim() === currentBrand)).toBe(true);
  });
  await check("Sort by name and price follows live data and URL", async () => {
    await load();
    const options = [[/Name \(A–Z\)/, "name-asc"], [/Price: Low to High/, "price-asc"], [/Price: High to Low/, "price-desc"]];
    for (const [option, value] of options) {
      await choose("Sort products", option);
      await confirmQuery("sort", value);
      const rendered = (await ids()).map((id) => productMap.get(id));
      for (let index = 1; index < rendered.length; index++) {
        if (value === "name-asc") expect(rendered[index - 1].name.localeCompare(rendered[index].name)).toBeLessThanOrEqual(0);
        else if (value === "price-asc") expect(rendered[index - 1].unitPriceInr ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(rendered[index].unitPriceInr ?? Number.MAX_SAFE_INTEGER);
        else expect(rendered[index - 1].unitPriceInr ?? -1).toBeGreaterThanOrEqual(rendered[index].unitPriceInr ?? -1);
      }
    }
  });
  await check("Price slider filters and reset restores catalogue", async () => {
    await load();
    const slider = root.getByRole("slider");
    await slider.focus(); await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", "500");
    expect((await ids()).every((id) => productMap.get(id).unitPriceInr === null || productMap.get(id).unitPriceInr <= 500)).toBe(true);
    await root.getByRole("button", { name: "Reset filters", exact: true }).click();
    await expect(cards).toHaveCount(18);
  });
  await check("Kitchen subcollections remain functional", async () => {
    await load(); await selectCategory("Kitchen Basket");
    for (const subcategory of ["Kitchen Baskets", "Trolleys With Slides", "Cabinet Accessories", "Vegetable Baskets"]) {
      await root.getByRole("button", { name: new RegExp(`^${subcategory}`) }).click();
      expect(await cards.count()).toBeGreaterThan(0);
      expect((await ids()).every((id) => productMap.get(id).category === "Kitchen Basket")).toBe(true);
      await auditPhotos(`Kitchen Basket: ${subcategory}`);
    }
  });
  await check("Wishlist persists and can be removed", async () => {
    await load();
    const card = cards.first();
    const id = (await ids())[0];
    await card.getByRole("button", { name: /^Save .+ to shortlist$/ }).click();
    await expect(card.getByRole("button", { name: /^Remove .+ from shortlist$/ })).toHaveAttribute("aria-pressed", "true");
    await page.reload({ waitUntil: "networkidle" });
    expect((await prefs()).wishlistIds).toContain(id);
    await cards.first().getByRole("button", { name: /^Remove .+ from shortlist$/ }).click();
    await expect.poll(async () => (await prefs()).wishlistIds.includes(id)).toBe(false);
  });
  await check("Compare enforces four-product limit and opens technical table", async () => {
    for (let index = 0; index < 5; index++) await cards.nth(index).getByRole("button", { name: "Compare", exact: true }).click();
    expect((await prefs()).compareIds).toHaveLength(4);
    await expect(root).toContainText("Compare (4/4)");
    await root.getByRole("button", { name: "Compare Specs", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Side-by-Side Technical Comparison");
    await expect(dialog.getByRole("table")).toBeVisible();
    await expect(dialog).toContainText("Material");
    await page.keyboard.press("Escape");
    await root.getByRole("button", { name: "Clear", exact: true }).click();
    await expect.poll(async () => (await prefs()).compareIds.length).toBe(0);
  });
  await check("Quick view displays product and restores focus on Escape", async () => {
    const trigger = cards.first().getByRole("button", { name: /^Quick view / });
    const product = productMap.get((await ids())[0]);
    await cards.first().hover();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(product.name);
    await expect(dialog).toContainText(product.code);
    await expect(dialog.getByRole("link", { name: /Open Complete Specification/ })).toHaveAttribute("href", `/products/${product.id}`);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
  await check("Quick view pack cart preserves local item details", async () => {
    const product = productMap.get((await ids())[0]);
    await cards.first().hover();
    await cards.first().getByRole("button", { name: /^Quick view / }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Standard Lot \(10 Units\)/ }).click();
    await dialog.getByRole("button", { name: "Add to BOQ Cart", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Project Cart (1)");
    expect((await prefs()).cart[0]).toMatchObject({ productId: product.id, quantity: 1, packMultiplier: 10 });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    expect((await prefs()).cart[0]).toMatchObject({ productId: product.id, quantity: 1, packMultiplier: 10 });
  });
  await check("Card add-to-cart stays local and quote-only cards retain quote links", async () => {
    await search.fill("SA-M-DC-60-001");
    await expect(cards).toHaveCount(1);
    await cards.first().getByRole("button", { name: "Add to cart", exact: true }).click();
    expect((await prefs()).cart.some((line) => line.sku === "SA-M-DC-60-001")).toBe(true);
    await search.fill("SA-I-FS-TON90-007");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("data-quote-only", "true");
    await expect(cards.first().getByRole("button", { name: "Add to cart", exact: true })).toHaveCount(0);
    await expect(cards.first().getByRole("link", { name: /Get a quote/ })).toHaveAttribute("href", /^\/products\//);
  });
  await check("Grid and list controls preserve results when present", async () => {
    await load();
    const list = root.getByRole("button", { name: /^(List view|View as list)$/i });
    if (await list.count() === 0) return "No grid/list controls exposed; existing catalogue uses grid only.";
    const before = await ids();
    await list.click(); await expect(list).toHaveAttribute("aria-pressed", "true");
    expect(await ids()).toEqual(before);
    const grid = root.getByRole("button", { name: /^(Grid view|View as grid)$/i });
    await grid.click(); await expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(await ids()).toEqual(before);
  });
  await check("Mobile filter drawer updates finish and can reset", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await load();
    const trigger = root.getByRole("button", { name: "Open category filters", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Filter Products");
    const finishGroup = dialog.locator("details").filter({ has: page.locator("#catalogue-mobile-finish") });
    if (await finishGroup.getAttribute("open") === null) await finishGroup.locator("summary").click();
    await dialog.locator("#catalogue-mobile-finish").click();
    const option = await page.getByRole("option").nth(1).innerText();
    await page.getByRole("option").nth(1).click();
    await confirmQuery("finish", option.trim());
    await dialog.getByRole("button", { name: "Clear all", exact: true }).click();
    await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await confirmQuery("finish", null);
    await expect(cards).toHaveCount(18);
  });
  await check("Mobile Resources navigation retains all destinations", async () => {
    await page.getByRole("button", { name: "Toggle navigation menu", exact: true }).click();
    const resources = page.locator("[data-mobile-resources]");
    for (const [name, href] of [["Guides & Articles", "/blogs"], ["Solutions", "/solutions"], ["Projects", "/projects"]]) await expect(resources.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    await page.keyboard.press("Escape");
  });
  await check("Catalogue error response offers working retry", async () => {
    catalogMode = "error";
    await load();
    await expect(root).toContainText("Products could not load");
    await expect(root).toContainText("QA catalogue unavailable");
    await expect(cards).toHaveCount(0);
    catalogMode = "live";
    await root.getByRole("button", { name: /Retry|Try again/i }).click();
    await expect(cards).toHaveCount(18);
  });
  await check("Empty catalogue state links to enquiry and contact", async () => {
    catalogMode = "empty"; await load();
    await expect(root).toContainText("No products are available right now");
    await expect(root.locator("#catalogue-results").getByRole("link", { name: "Request a Quote", exact: true })).toHaveAttribute("href", "/quotes");
    await expect(root.getByRole("link", { name: "Contact Desk", exact: true })).toHaveAttribute("href", "/contact");
    catalogMode = "live";
  });
  await check("Loading state recovers to catalogue", async () => {
    catalogMode = "loading";
    await page.goto(catalogueURL, { waitUntil: "domcontentloaded" });
    await expect(root).toContainText("Loading products");
    await expect(cards).toHaveCount(18);
    catalogMode = "live";
  });
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await check(`Responsive catalogue ${width}px has no page overflow`, async () => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      report.viewports.push({ width, ...metrics });
      expect(metrics.document).toBeLessThanOrEqual(width + 1);
      expect(metrics.body).toBeLessThanOrEqual(width + 1);
      await expect(cards.first()).toBeVisible();
      const clippedActions = await cards.locator(".sa-card-actions :is(button,a)").evaluateAll((actions) => actions.flatMap((action) => {
        const rect = action.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return [];
        return action.scrollWidth > action.clientWidth + 1 ? [{ text: action.textContent.trim(), width: rect.width, contentWidth: action.scrollWidth }] : [];
      }));
      expect(clippedActions).toEqual([]);
      if ([1440, 768, 390, 320].includes(width)) await page.screenshot({ path: path.join(outDir, `responsive-${width}.png`), fullPage: true });
      return metrics;
    });
  }
  await check("No uncaught application errors or API mutations; media errors recorded separately", async () => {
    expect(report.pageErrors).toEqual([]);
    expect(report.blockedMutations).toEqual([]);
    const unexpectedResponses = report.networkErrors.filter((response) => !(response.resourceType === "image" || response.status === 503 && new URL(response.url).pathname === "/api/products"));
    expect(unexpectedResponses).toEqual([]);
    const unexpected = report.consoleErrors.filter((message) => !/Failed to load resource: the server responded with a status of (503|404|400)/.test(message));
    expect(unexpected).toEqual([]);
  });
} catch (error) {
  report.checks.push({ name: "Test setup or execution", status: "failed", error: error.stack });
} finally {
  report.finishedAt = new Date().toISOString();
  report.networkErrors = [...new Map(report.networkErrors.map((response) => [`${response.status} ${response.url}`, response])).values()];
  report.assetFailures = report.networkErrors.filter((response) => response.resourceType === "image");
  report.unavailablePhotos = [...new Map(report.mediaAudits.flatMap((audit) => audit.unavailable).map((photo) => [photo.sku, photo])).values()];
  report.consoleErrors = [...new Set(report.consoleErrors)];
  report.summary = { passed: report.checks.filter((check) => check.status === "passed").length, failed: report.checks.filter((check) => check.status === "failed").length };
  fs.writeFileSync(path.join(outDir, "functional-results.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}
