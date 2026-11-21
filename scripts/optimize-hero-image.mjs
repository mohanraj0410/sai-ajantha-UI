import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const sharp = require(path.resolve(process.cwd(), "apps/storefront/node_modules/sharp"));

async function inspectHero() {
  const heroPath = path.resolve(process.cwd(), "apps/storefront/public/hero-architecture.png");
  const meta = await sharp(heroPath).metadata();
  console.log("Original Hero Dimensions:", meta.width, "x", meta.height, "format:", meta.format, "size:", fs.statSync(heroPath).size);

  const webpPath = path.resolve(process.cwd(), "apps/storefront/public/hero-architecture.webp");
  await sharp(heroPath)
    .webp({ quality: 85, effort: 6 })
    .toFile(webpPath);

  const webpSize = fs.statSync(webpPath).size;
  console.log("Generated WebP Size:", webpSize, "bytes (", (webpSize / (1024 * 1024)).toFixed(2), "MB)");
  console.log("Compression ratio:", ((1 - (webpSize / fs.statSync(heroPath).size)) * 100).toFixed(1), "% savings!");
}

inspectHero().catch(console.error);
