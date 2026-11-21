import cp from "node:child_process";
import fs from "node:fs";

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

console.log("===============================================================================");
console.log("TASK 03: EXECUTING TARGETED GIT RM FOR EXACT 36 APPROVED FILES");
console.log("===============================================================================\n");

let removedCount = 0;
const errors = [];

for (const target of approved36) {
  try {
    // Run git rm -- "<path>"
    const res = cp.execFileSync("git", ["rm", "--", target], { encoding: "utf8" });
    removedCount++;
    console.log(`  [GIT RM SUCCESS] ${target.padEnd(72)} -> ${res.trim()}`);
  } catch (err) {
    errors.push(`Failed git rm for ${target}: ${err.message}`);
    console.error(`  [GIT RM FAILED] ${target}: ${err.message}`);
  }
}

console.log(`\n--- Execution Summary ---`);
console.log(`Total Approved: ${approved36.length}`);
console.log(`Successfully Removed from Git & Working Tree: ${removedCount}`);
console.log(`Errors: ${errors.length}`);

if (errors.length > 0 || removedCount !== 36) {
  console.error("FATAL: Targeted git rm did not remove exactly 36 files!");
  process.exit(1);
}

console.log("\n[SUCCESS] Exactly 36 approved files removed via targeted git rm!");
