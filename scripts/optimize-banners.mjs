import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const sharp = require(path.resolve(process.cwd(), "apps/storefront/node_modules/sharp"));

async function optimizeBanners() {
  const banners = [
    "Modern Glass Architecture Hero Banner-1.png",
    "Architectural Blueprints Meet Modern Skylines-4.png",
    "Futuristic Glass Corporate Skyline-3.png",
    "Futuristic Blue-Tinted Corporate Lobby-2.png",
  ];

  for (const b of banners) {
    const origPath = path.resolve(process.cwd(), "apps/storefront/public", b);
    if (!fs.existsSync(origPath)) continue;
    const baseName = b.replace(/\.png$/, "");
    const webpPath = path.resolve(process.cwd(), "apps/storefront/public", `${baseName}.webp`);

    const origSize = fs.statSync(origPath).size;
    await sharp(origPath).webp({ quality: 85, effort: 6 }).toFile(webpPath);
    const webpSize = fs.statSync(webpPath).size;
    console.log(`${b}: ${(origSize / (1024 * 1024)).toFixed(2)} MB -> ${(webpSize / 1024).toFixed(1)} KB (${((1 - webpSize / origSize) * 100).toFixed(1)}% savings)`);
  }
}

optimizeBanners().catch(console.error);
