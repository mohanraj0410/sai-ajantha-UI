import fs from "node:fs";
import path from "node:path";

function list(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) results = results.concat(list(f));
    else results.push(f);
  }
  return results;
}

// Target files for Groups A, B, C
const groupA = [
  "apps/storefront/public/design-shop/banner-lighting-edit.jpg",
  "apps/storefront/public/design-shop/banner-quickship.jpg",
  "apps/storefront/public/design-shop/hero-nordic-living.jpg",
  "apps/storefront/public/design-shop/prod-bar-stool.jpg",
  "apps/storefront/public/design-shop/prod-ceramic-vase.jpg",
  "apps/storefront/public/design-shop/prod-dining-table.jpg",
  "apps/storefront/public/design-shop/prod-lounge-chair.jpg",
  "apps/storefront/public/design-shop/prod-pendant-lamp.jpg",
  "apps/storefront/public/design-shop/prod-table-lamp.jpg",
  "apps/storefront/public/design-shop/prod-wall-shelf.jpg",
  "apps/storefront/public/design-shop/story-architecture.jpg",
  "apps/storefront/public/design-shop/story-atelier.jpg",
];

const groupB = [
  "apps/storefront/public/Modern Glass Architecture Hero Banner-1.png",
  "apps/storefront/public/login-architecture-bg.jpg",
  "apps/storefront/public/Architectural Blueprints Meet Modern Skylines-4.png",
  "apps/storefront/public/Architectural Blueprints Meet Modern Skylines-4.webp",
  "apps/storefront/public/Futuristic Blue-Tinted Corporate Lobby-2.png",
  "apps/storefront/public/Futuristic Blue-Tinted Corporate Lobby-2.webp",
  "apps/storefront/public/Futuristic Glass Corporate Skyline-3.png",
  "apps/storefront/public/Futuristic Glass Corporate Skyline-3.webp",
  "apps/storefront/public/sai ajantha image.webp",
];

const groupC = [
  "apps/storefront/components/AboutSection.tsx",
  "apps/storefront/components/Architectural3DShowcase.tsx",
  "apps/storefront/components/FeaturedProductsSection.tsx",
  "apps/storefront/components/FeaturedProjectsGallery.tsx",
  "apps/storefront/components/LoginModal.tsx",
  "apps/storefront/components/non-home/StorefrontFooter.tsx",
  "apps/storefront/components/OurSolutionsSection.tsx",
  "apps/storefront/components/ProductCatalogue.tsx",
  "apps/storefront/components/ProductCategoriesSection.tsx",
  "apps/storefront/components/ProjectsShowcaseSection.tsx",
  "apps/storefront/components/SolutionsShowcaseSection.tsx",
  "apps/storefront/components/TrustHighlightsSection.tsx",
  "apps/storefront/components/ui/accordion.tsx",
  "apps/storefront/components/ui/dropdown-menu.tsx",
  "apps/storefront/components/VisionSection.tsx",
];

const allCandidates = [...groupA, ...groupB, ...groupC];

// Scan all source files in the entire project
const searchDirs = [
  "apps/storefront/app",
  "apps/storefront/components",
  "apps/storefront/lib",
  "apps/admin/src",
  "apps/backend/src",
  "packages",
  "deploy",
  "scripts"
];

let allSources = [];
for (const d of searchDirs) {
  allSources = allSources.concat(list(d));
}

// Add root configs
["package.json", "docker-compose.yaml", "turbo.json", "apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx"].forEach(f => {
  if (fs.existsSync(f)) allSources.push(f);
});

console.log(`Deep scanning ${allSources.length} project files for references to 36 candidates...\n`);

const sourceFilesContent = allSources
  .filter(f => !f.endsWith(".xlsx"))
  .map(f => ({
    file: f.replaceAll("\\", "/"),
    text: fs.readFileSync(f, "utf8")
  }));

const verificationResults = [];

for (const target of allCandidates) {
  const filename = path.basename(target);
  const baseNameNoExt = path.basename(target, path.extname(target));
  const webPath = "/" + path.relative("apps/storefront/public", target).replaceAll("\\", "/");

  const hits = [];

  for (const src of sourceFilesContent) {
    if (src.file === target) continue;

    // Check filename, webPath, baseNameNoExt, relative import
    if (
      src.text.includes(filename) ||
      (webPath.startsWith("/") && src.text.includes(webPath)) ||
      (target.endsWith(".tsx") && src.text.includes(baseNameNoExt))
    ) {
      hits.push(src.file);
    }
  }

  verificationResults.push({
    target,
    filename,
    type: target.endsWith(".tsx") ? "Component" : "Public Asset",
    size: fs.statSync(target).size,
    hits,
    isReferenced: hits.length > 0
  });
}

console.log("===============================================================================");
console.log("DEEP DEPENDENCY AUDIT RESULTS FOR 36 CANDIDATES");
console.log("===============================================================================\n");

let referencedCount = 0;
for (const res of verificationResults) {
  const status = res.isReferenced ? `REFERENCED in ${res.hits.length} files: ${res.hits.join(", ")}` : "ZERO REFERENCES (Confirmed Unused)";
  console.log(`[${res.type}] ${res.target} (${(res.size / 1024).toFixed(1)} KB) -> ${status}`);
  if (res.isReferenced) referencedCount++;
}

console.log(`\nSummary: 36 candidates checked. Referenced: ${referencedCount}, Completely Unreferenced: ${36 - referencedCount}`);
