import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);

try {
  const sharp = require("sharp");
  console.log("sharp available at root");
} catch (e1) {
  try {
    const sharp = require(path.resolve(process.cwd(), "apps/storefront/node_modules/sharp"));
    console.log("sharp available in storefront");
  } catch (e2) {
    console.log("sharp not in storefront:", e2.message);
  }
}
