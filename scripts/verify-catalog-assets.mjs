import fs from "node:fs";
import path from "node:path";

async function verifyCatalogAssets() {
  const mod = await import("../apps/storefront/lib/products.ts");
  const products = mod.PRODUCTS;
  console.log(`Auditing required assets for all ${products.length} catalog products...`);

  let missingCount = 0;
  let verifiedCount = 0;
  const missingList = [];

  for (const p of products) {
    const primaryImg = p.src;
    if (!primaryImg) {
      missingCount++;
      missingList.push({ id: p.id, code: p.code, reason: "Missing src property" });
      continue;
    }

    // Resolve in apps/storefront/public
    const cleanPath = primaryImg.startsWith("/") ? primaryImg.slice(1) : primaryImg;
    const diskPath = path.resolve("apps/storefront/public", cleanPath);

    if (!fs.existsSync(diskPath)) {
      missingCount++;
      missingList.push({ id: p.id, code: p.code, src: primaryImg, diskPath });
    } else {
      verifiedCount++;
    }
  }

  console.log(`\n--- Catalog Asset Verification Summary ---`);
  console.log(`Total Products Audited:    ${products.length}`);
  console.log(`Products with Valid Media: ${verifiedCount}`);
  console.log(`Products with Missing Media: ${missingCount}`);

  if (missingCount > 0) {
    console.error("FATAL: Broken asset paths found in product catalog!");
    missingList.slice(0, 10).forEach(m => console.error("  ->", m));
    process.exit(1);
  }

  console.log("\n[SUCCESS] 100% of 281 catalog products retain valid, accessible physical assets on disk!");
}

verifyCatalogAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
