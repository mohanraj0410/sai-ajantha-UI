import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import cp from "node:child_process";

const QUARANTINE_ROOT = "D:/Sai_Ajantha_Archive/quarantine_candidates_groups_a_b_c";

const approved36 = [
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
  "apps/storefront/components/VisionSection.tsx"
];

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function md5(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

async function verifySafety() {
  console.log("===============================================================================");
  console.log("TASK 01: PRE-DELETION SAFETY & HASH VERIFICATION");
  console.log("===============================================================================\n");

  // 1. Verify candidate count
  if (approved36.length !== 36) {
    throw new Error(`Candidate count mismatch: expected 36, got ${approved36.length}`);
  }
  console.log("  [PASS] Approved deletion list contains exactly 36 files.");

  // 2. Check quarantine folder exists
  if (!fs.existsSync(QUARANTINE_ROOT)) {
    throw new Error(`Quarantine archive root missing: ${QUARANTINE_ROOT}`);
  }
  console.log(`  [PASS] Quarantine archive root verified at: ${QUARANTINE_ROOT}`);

  // 3. Verify restore manifest and script
  const manifestFile = path.join(QUARANTINE_ROOT, "QUARANTINE_MANIFEST.json");
  const restoreScriptFile = path.join(QUARANTINE_ROOT, "restore-quarantine.mjs");

  if (!fs.existsSync(manifestFile)) throw new Error("QUARANTINE_MANIFEST.json missing!");
  if (!fs.existsSync(restoreScriptFile)) throw new Error("restore-quarantine.mjs missing!");

  const manifestData = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (manifestData.manifest.length !== 36) {
    throw new Error(`Manifest entry count mismatch: expected 36, got ${manifestData.manifest.length}`);
  }
  console.log("  [PASS] QUARANTINE_MANIFEST.json verified with exactly 36 entries.");
  console.log("  [PASS] restore-quarantine.mjs restore script verified present.");

  // 4. Verify Git tracking status of all 36 originals
  const trackedFiles = new Set(
    cp.execSync("git ls-files", { encoding: "utf8" })
      .trim()
      .split("\n")
      .map(l => l.trim().replaceAll("\\", "/"))
      .filter(Boolean)
  );

  for (const f of approved36) {
    if (!trackedFiles.has(f)) {
      throw new Error(`File is not Git-tracked: ${f}`);
    }
  }
  console.log("  [PASS] All 36 approved original files are confirmed actively Git-tracked.");

  // 5. Compare SHA-256 and MD5 hashes of original workspace files vs quarantine backup
  console.log("\n--- Computing and Cross-Checking SHA-256 & MD5 Hashes ---");
  let verifiedFiles = 0;

  for (const rel of approved36) {
    const origPath = path.resolve(rel);
    const quarPath = path.join(QUARANTINE_ROOT, rel);

    if (!fs.existsSync(origPath)) throw new Error(`Original file missing: ${origPath}`);
    if (!fs.existsSync(quarPath)) throw new Error(`Quarantine copy missing: ${quarPath}`);

    const origStat = fs.statSync(origPath);
    const quarStat = fs.statSync(quarPath);

    if (origStat.size !== quarStat.size) {
      throw new Error(`Size mismatch for ${rel}: orig ${origStat.size} vs quar ${quarStat.size}`);
    }

    const origSha = sha256(origPath);
    const quarSha = sha256(quarPath);
    if (origSha !== quarSha) {
      throw new Error(`SHA-256 mismatch for ${rel}! orig: ${origSha} vs quar: ${quarSha}`);
    }

    const origMd5 = md5(origPath);
    const quarMd5 = md5(quarPath);
    if (origMd5 !== quarMd5) {
      throw new Error(`MD5 mismatch for ${rel}! orig: ${origMd5} vs quar: ${quarMd5}`);
    }

    verifiedFiles++;
    console.log(`  [VERIFIED] ${rel} (${(origStat.size / 1024).toFixed(1)} KB) SHA-256: ${origSha.slice(0, 16)}...`);
  }

  console.log(`\n[SUCCESS] All 36 original files match quarantine backup with 100% SHA-256 & MD5 hash identity!`);
}

verifySafety().catch(err => {
  console.error("Safety verification failed:", err);
  process.exit(1);
});
