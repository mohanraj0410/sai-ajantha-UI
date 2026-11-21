import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function listFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(listFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function md5(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

// 1. Gather all codebase text files to check references
const codeFiles = [
  ...listFiles("apps/storefront/app"),
  ...listFiles("apps/storefront/components"),
  ...listFiles("apps/storefront/lib"),
  ...listFiles("apps/admin/src"),
  ...listFiles("apps/backend/src"),
  ...listFiles("packages"),
  "apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx",
].filter((f) => {
  const ext = path.extname(f).toLowerCase();
  return [".ts", ".tsx", ".js", ".mjs", ".jsx", ".json", ".css", ".html"].includes(ext);
});

console.log(`Scanning ${codeFiles.length} codebase source files for asset references...`);

// Pre-read all source contents
const sourceContents = codeFiles.map((f) => ({
  file: f,
  text: fs.readFileSync(f, "utf8"),
}));

// Also read lib/products.ts directly to extract all image paths referenced by the 281 catalog products
const productsTs = fs.readFileSync("apps/storefront/lib/products.ts", "utf8");

// 2. Audit all assets in apps/storefront/public
const publicAssets = listFiles("apps/storefront/public");
console.log(`Found ${publicAssets.length} public assets in apps/storefront/public`);

const hashMap = new Map();
const duplicates = [];
const assetAudit = [];

for (const asset of publicAssets) {
  const rel = path.relative("apps/storefront/public", asset).replaceAll("\\", "/");
  const stat = fs.statSync(asset);
  const hash = md5(asset);

  // Check duplicate hashes
  if (hashMap.has(hash)) {
    duplicates.push({
      original: hashMap.get(hash),
      duplicate: rel,
      hash,
      size: stat.size,
    });
  } else {
    hashMap.set(hash, rel);
  }

  // Check references:
  // Can be referenced by filename, or /rel, or rel, or encoded URI
  const filename = path.basename(asset);
  const webPath = `/${rel}`;
  const encodedPath = encodeURI(webPath);
  const encodedRel = encodeURI(rel);

  const matchedSources = [];

  for (const src of sourceContents) {
    if (
      src.text.includes(webPath) ||
      src.text.includes(rel) ||
      src.text.includes(filename) ||
      src.text.includes(encodedPath) ||
      src.text.includes(encodedRel)
    ) {
      matchedSources.push(path.relative(".", src.file).replaceAll("\\", "/"));
    }
  }

  const isCatalog = productsTs.includes(filename) || productsTs.includes(rel);

  assetAudit.push({
    file: rel,
    fullPath: asset,
    size: stat.size,
    hash,
    referencedIn: matchedSources,
    isCatalog,
    isUsed: matchedSources.length > 0 || isCatalog,
  });
}

console.log(`\n--- Duplicate File Summary ---`);
console.log(`Found ${duplicates.length} exact duplicate assets by MD5 hash.`);
duplicates.forEach((d) => {
  console.log(`Duplicate: ${d.duplicate} === Original: ${d.original} (${(d.size / 1024).toFixed(1)} KB)`);
});

const unusedAssets = assetAudit.filter((a) => !a.isUsed);
const usedAssets = assetAudit.filter((a) => a.isUsed);

console.log(`\n--- Asset Usage Summary ---`);
console.log(`Used assets: ${usedAssets.length}`);
console.log(`Unused assets (zero source references): ${unusedAssets.length}`);

let unusedBytes = 0;
unusedAssets.forEach((a) => {
  unusedBytes += a.size;
  console.log(`Unused candidate: ${a.file} (${(a.size / 1024).toFixed(1)} KB)`);
});
console.log(`Total unused assets potential recovery: ${(unusedBytes / (1024 * 1024)).toFixed(2)} MB`);

// Write audit result for subsequent steps
fs.writeFileSync(
  "scripts/asset-audit-data.json",
  JSON.stringify({ assetAudit, duplicates, unusedAssets }, null, 2),
  "utf8"
);
console.log("Wrote audit data to scripts/asset-audit-data.json");
