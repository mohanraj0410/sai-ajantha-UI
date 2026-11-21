import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ARCHIVE_ROOT = "D:/Sai_Ajantha_Archive";

function md5File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

function scan(dir) {
  let list = [];
  if (!fs.existsSync(dir)) return list;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) list = list.concat(scan(f));
    else list.push(f);
  }
  return list;
}

// 1. Identify active reference screenshots in docs/screenshots
const docsMd = scan("docs").filter(f => f.endsWith(".md") && !f.includes("ui-redesign") && !f.includes("screenshots"));
const mdTexts = docsMd.map(f => fs.readFileSync(f, "utf8"));
const allScreenshots = scan("docs/screenshots");

const preservedScreenshots = new Set();
for (const sc of allScreenshots) {
  const base = path.basename(sc);
  for (const text of mdTexts) {
    if (text.includes(base)) {
      preservedScreenshots.add(sc.replaceAll("\\", "/"));
      break;
    }
  }
}

console.log(`Identified ${preservedScreenshots.size} active reference screenshots to PRESERVE in docs/screenshots/`);

// 2. Scan files to safely remove from local workspace
const uiRedesignFiles = scan("docs/ui-redesign");
const unreferencedScreenshots = allScreenshots.filter(f => !preservedScreenshots.has(f.replaceAll("\\", "/")));

console.log(`Candidate frame files in docs/ui-redesign to remove: ${uiRedesignFiles.length}`);
console.log(`Unreferenced screenshot files in docs/screenshots to remove: ${unreferencedScreenshots.length}`);

const filesToRemove = [...uiRedesignFiles, ...unreferencedScreenshots];
let bytesRecovered = 0;
let removedCount = 0;

for (const f of filesToRemove) {
  const rel = path.relative(".", f).replaceAll("\\", "/");
  const archivePath = path.join(ARCHIVE_ROOT, rel);

  // Safety Gate: Ensure file exists in archive and hash matches before unlinking
  if (!fs.existsSync(archivePath)) {
    throw new Error(`ABORT: Archive file missing for ${rel} at ${archivePath}`);
  }

  const srcHash = md5File(f);
  const archHash = md5File(archivePath);
  if (srcHash !== archHash) {
    throw new Error(`ABORT: Hash mismatch for ${rel} between workspace and archive!`);
  }

  const stat = fs.statSync(f);
  bytesRecovered += stat.size;
  fs.unlinkSync(f);
  removedCount++;
}

console.log(`\n--- Execution Summary ---`);
console.log(`Files safely removed from local workspace: ${removedCount}`);
console.log(`Active reference screenshots preserved locally: ${preservedScreenshots.size}`);
console.log(`Total local disk space recovered: ${(bytesRecovered / (1024 * 1024)).toFixed(2)} MB`);
console.log(`100% of removed files verified present in ${ARCHIVE_ROOT}`);
