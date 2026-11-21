import fs from "node:fs";
import path from "node:path";

const BEFORE_DIR = path.resolve("docs/screenshots/admin-v25-before");
const AFTER_DIR = path.resolve("docs/screenshots/admin-v25-after");
const DOCS_DIR = path.resolve("docs/admin-ant-design");

// Generate portable HTML contact sheet with side-by-side key before/after comparisons + full 70-shot grid
const PAIRS = [
  { label: "Dashboard (Desktop 1440px — 153 Direct / 120 Dist. Cat. / 8 Quote-Only + Sidebar Counts)", before: "01-dashboard-desktop-antd.png", after: "01-dashboard-desktop-v25.png" },
  { label: "Dashboard Dark Mode (Desktop 1440px)", before: null, after: "01-dashboard-desktop-dark-v25.png" },
  { label: "Dashboard Dark Mode (Mobile 390px)", before: null, after: "01-dashboard-mobile-dark-v25.png" },
  { label: "Dashboard (Tablet 768px)", before: "01-dashboard-tablet-antd.png", after: "01-dashboard-tablet-v25.png" },
  { label: "Dashboard (Mobile 390px)", before: "01-dashboard-mobile-antd.png", after: "01-dashboard-mobile-v25.png" },
  { label: "Orders (Desktop 1440px)", before: "02-orders-desktop-antd.png", after: "02-orders-desktop-v25.png" },
  { label: "Products Catalogue with Floor Spring Quote-Only Guards (Desktop 1440px)", before: "05-products-desktop-antd.png", after: "05-products-desktop-v25.png" },
  { label: "Floor Spring Detail Route — Quote-Only Guard (Desktop 1440px)", before: null, after: "18-floor-spring-detail-desktop-v25.png" },
  { label: "Add New Product 5-Step Wizard + Live Summary (Desktop 1440px)", before: "06-product-new-desktop-antd.png", after: "06-product-new-desktop-v25.png" },
  { label: "Add New Product Mobile Breadcrumb (Mobile 390px)", before: "06-product-new-mobile-antd.png", after: "06-product-new-mobile-v25.png" },
  { label: "Categories — 9 Direct / 2 Distributor Group / 8 FS Quote-Only (Desktop 1440px)", before: "07-categories-desktop-antd.png", after: "07-categories-desktop-v25.png" },
  { label: "Reports Analytics (Desktop 1440px)", before: "14-reports-desktop-antd.png", after: "14-reports-desktop-v25.png" },
  { label: "Settings (Desktop 1440px)", before: "15-settings-desktop-antd.png", after: "15-settings-desktop-v25.png" },
  { label: "Access Denied /403 (Desktop 1440px)", before: null, after: "22-access-denied-403-desktop-v25.png" },
  { label: "Page Not Found /404 (Desktop 1440px)", before: null, after: "23-not-found-404-desktop-v25.png" },
];

const compareRows = PAIRS.map((p) => {
  const beforeCell =
    p.before && fs.existsSync(path.join(BEFORE_DIR, p.before))
      ? `<a href="../screenshots/admin-v25-before/${p.before}" target="_blank"><img src="../screenshots/admin-v25-before/${p.before}" loading="lazy" alt="Before ${p.label}" /></a>`
      : `<div class="na">New in V2.5</div>`;
  const afterCell = `<a href="../screenshots/admin-v25-after/${p.after}" target="_blank"><img src="../screenshots/admin-v25-after/${p.after}" loading="lazy" alt="After ${p.label}" /></a>`;
  return `
  <div class="pair">
    <div class="cap">${p.label}</div>
    <div class="cols">
      <div><div class="tag">Before (AntD v1)</div>${beforeCell}</div>
      <div><div class="tag after">After (V2.5 Refined)</div>${afterCell}</div>
    </div>
  </div>`;
}).join("\n");

// Generate portable HTML contact sheet
const afterFiles = fs.readdirSync(AFTER_DIR).filter((f) => f.endsWith(".png")).sort();
const htmlCards = afterFiles
  .map(
    (file) => `
    <div class="card">
      <div class="cap">${file.replace(/-v25\.png$/, "")}</div>
      <a href="../screenshots/admin-v25-after/${file}" target="_blank">
        <img src="../screenshots/admin-v25-after/${file}" loading="lazy" alt="${file}" />
      </a>
    </div>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sai Ajantha Admin V2.5 — Visual QA Contact Sheet</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #f4f7fa; color: #0f172a; }
  h1 { color: #001c3f; margin: 0 0 6px; }
  p { color: #475569; margin: 0 0 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
  .card, .pair { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.05); margin-bottom: 16px; }
  .cap { padding: 10px 14px; font-weight: 700; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; color: #001c3f; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; }
  .tag { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
  .tag.after { color: #079d9a; }
  .na { height: 240px; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #64748b; border-radius: 8px; }
  img { width: 100%; height: 240px; object-fit: cover; object-position: top left; display: block; border-radius: 6px; border: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <h1>Sai Ajantha Admin Portal — V2.5 Visual QA Contact Sheet</h1>
  <p>Total live screenshots captured: ${afterFiles.length} across 320px, 390px, 768px, 1024px, 1440px, and 1920px viewports (Light &amp; Dark Mode).</p>
  <h2>Key Before vs. After Comparisons</h2>
  ${compareRows}
  <h2>Full ${afterFiles.length}-Screenshot Archive</h2>
  <div class="grid">${htmlCards}</div>
</body>
</html>`;

fs.writeFileSync(path.join(DOCS_DIR, "contact-sheet.html"), html, "utf8");
console.log(`Bundled ${afterFiles.length} V2.5 screenshots into docs/admin-ant-design/contact-sheet.html`);
