import fs from "node:fs";
import path from "node:path";

const pairs = [
  {
    name: "Hero 01 Overview Desktop (1440x900)",
    base: "docs/screenshots/baseline/hero-overview-desktop.png",
    mod: "docs/screenshots/modernized/hero-overview-desktop.png",
  },
  {
    name: "Hero 02 Promise Desktop (1440x900)",
    base: "docs/screenshots/baseline/hero-promise-desktop.png",
    mod: "docs/screenshots/modernized/hero-promise-desktop.png",
  },
  {
    name: "Hero 01 Overview Mobile (390x844)",
    base: "docs/screenshots/baseline/hero-overview-mobile.png",
    mod: "docs/screenshots/modernized/hero-overview-mobile.png",
  },
  {
    name: "Hero 02 Promise Mobile (390x844)",
    base: "docs/screenshots/baseline/hero-promise-mobile.png",
    mod: "docs/screenshots/modernized/hero-promise-mobile.png",
  },
];

console.log("=== HERO SCREENSHOT PIXEL/BUFFER PARITY AUDIT ===");
let allMatch = true;

for (const pair of pairs) {
  if (!fs.existsSync(pair.base) || !fs.existsSync(pair.mod)) {
    console.log(`[FAIL] Missing file for ${pair.name}`);
    allMatch = false;
    continue;
  }
  const baseBuf = fs.readFileSync(pair.base);
  const modBuf = fs.readFileSync(pair.mod);

  const baseSize = baseBuf.length;
  const modSize = modBuf.length;
  const sizeDiff = Math.abs(baseSize - modSize);
  const sizeDiffPct = ((sizeDiff / baseSize) * 100).toFixed(2);

  // Compare buffers
  let diffBytes = 0;
  const minLen = Math.min(baseSize, modSize);
  for (let i = 0; i < minLen; i++) {
    if (baseBuf[i] !== modBuf[i]) {
      diffBytes++;
    }
  }
  diffBytes += Math.abs(baseSize - modSize);
  const byteDiffPct = ((diffBytes / Math.max(baseSize, modSize)) * 100).toFixed(2);

  console.log(`\nItem: ${pair.name}`);
  console.log(`  Baseline Size:   ${baseSize} bytes`);
  console.log(`  Modernized Size: ${modSize} bytes`);
  console.log(`  Size Delta:      ${sizeDiff} bytes (${sizeDiffPct}%)`);
  console.log(`  Buffer Byte Diff: ${diffBytes} / ${Math.max(baseSize, modSize)} bytes (${byteDiffPct}%)`);
}
