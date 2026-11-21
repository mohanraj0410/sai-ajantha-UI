import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const QUARANTINE_ROOT = "D:/Sai_Ajantha_Archive/quarantine_candidates_groups_a_b_c";

function md5File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

const candidates = [
  // Group A (12 files)
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

  // Group B (9 files)
  "apps/storefront/public/Modern Glass Architecture Hero Banner-1.png",
  "apps/storefront/public/login-architecture-bg.jpg",
  "apps/storefront/public/Architectural Blueprints Meet Modern Skylines-4.png",
  "apps/storefront/public/Architectural Blueprints Meet Modern Skylines-4.webp",
  "apps/storefront/public/Futuristic Blue-Tinted Corporate Lobby-2.png",
  "apps/storefront/public/Futuristic Blue-Tinted Corporate Lobby-2.webp",
  "apps/storefront/public/Futuristic Glass Corporate Skyline-3.png",
  "apps/storefront/public/Futuristic Glass Corporate Skyline-3.webp",
  "apps/storefront/public/sai ajantha image.webp",

  // Group C (15 files)
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

async function runQuarantine() {
  console.log("===============================================================================");
  console.log("CREATING REVERSIBLE QUARANTINE BACKUP FOR 36 CANDIDATES");
  console.log(`Destination: ${QUARANTINE_ROOT}`);
  console.log("===============================================================================\n");

  if (!fs.existsSync(QUARANTINE_ROOT)) {
    fs.mkdirSync(QUARANTINE_ROOT, { recursive: true });
  }

  let totalCopied = 0;
  let totalBytes = 0;
  const manifest = [];
  const errors = [];

  for (const rel of candidates) {
    if (!fs.existsSync(rel)) {
      errors.push(`Candidate file not found: ${rel}`);
      continue;
    }

    const dest = path.join(QUARANTINE_ROOT, rel);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const stat = fs.statSync(rel);
    totalBytes += stat.size;

    fs.copyFileSync(rel, dest);
    totalCopied++;

    const srcHash = md5File(rel);
    const destHash = md5File(dest);

    if (srcHash !== destHash) {
      errors.push(`Hash mismatch for ${rel}: src ${srcHash} vs dest ${destHash}`);
      continue;
    }

    manifest.push({
      relativePath: rel,
      fileName: path.basename(rel),
      group: rel.includes("design-shop") ? "A" : rel.includes(".tsx") ? "C" : "B",
      size: stat.size,
      hash: srcHash,
      quarantinedAt: new Date().toISOString(),
      verified: true
    });
  }

  console.log(`Candidates Processed: ${candidates.length}`);
  console.log(`Files Copied & Verified: ${totalCopied}`);
  console.log(`Total Quarantine Size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.error("FATAL: Quarantine creation encountered errors:");
    errors.forEach(e => console.error("  ->", e));
    process.exit(1);
  }

  // Write quarantine manifest
  const manifestPath = path.join(QUARANTINE_ROOT, "QUARANTINE_MANIFEST.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ totalCandidates: candidates.length, totalBytes, manifest }, null, 2),
    "utf8"
  );
  console.log(`\nWrote authoritative quarantine manifest to: ${manifestPath}`);

  // Create single-command restore script in the quarantine folder
  const restoreScript = `// Auto-generated 1-command restore script for Groups A, B, and C
import fs from "node:fs";
import path from "node:path";

const targetRepo = "${process.cwd().replaceAll("\\", "/")}";
const quarantineRoot = "${QUARANTINE_ROOT.replaceAll("\\", "/")}";
const manifest = JSON.parse(fs.readFileSync(path.join(quarantineRoot, "QUARANTINE_MANIFEST.json"), "utf8")).manifest;

console.log("Restoring " + manifest.length + " quarantined files to " + targetRepo + "...");
let restored = 0;
for (const item of manifest) {
  const src = path.join(quarantineRoot, item.relativePath);
  const dest = path.join(targetRepo, item.relativePath);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  restored++;
  console.log("  [RESTORED] " + item.relativePath);
}
console.log("Restore complete: " + restored + " files restored successfully.");
`;

  fs.writeFileSync(path.join(QUARANTINE_ROOT, "restore-quarantine.mjs"), restoreScript, "utf8");
  console.log(`Wrote reversible restore script to: ${QUARANTINE_ROOT}/restore-quarantine.mjs`);
  console.log("\n[SUCCESS] Reversible quarantine backup created with 100% cryptographic integrity!");
}

runQuarantine().catch(err => {
  console.error("Quarantine failed:", err);
  process.exit(1);
});
