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

async function archive() {
  console.log("===============================================================================");
  console.log("SAI AJANTHA — GROUP D ARCHIVAL & VERIFICATION PIPELINE");
  console.log(`Destination Archive Root: ${ARCHIVE_ROOT}`);
  console.log("===============================================================================\n");

  const sources = [
    { dir: "docs/ui-redesign", name: "UI Redesign Frame Captures" },
    { dir: "docs/screenshots", name: "Automated QA Screenshots" }
  ];

  let totalFiles = 0;
  let totalCopied = 0;
  let totalVerified = 0;
  let totalBytes = 0;
  const verificationErrors = [];
  const fileManifest = [];

  for (const s of sources) {
    const files = scan(s.dir);
    console.log(`[Scanning] ${s.name} (${s.dir}): ${files.length} files found.`);

    for (const srcFile of files) {
      totalFiles++;
      const relPath = path.relative(".", srcFile).replaceAll("\\", "/");
      const destFile = path.join(ARCHIVE_ROOT, relPath);
      const destDir = path.dirname(destFile);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const stat = fs.statSync(srcFile);
      totalBytes += stat.size;

      // Copy file preserving timestamps
      fs.copyFileSync(srcFile, destFile);
      totalCopied++;

      // Verify immediately
      if (!fs.existsSync(destFile)) {
        verificationErrors.push(`Missing destination file: ${destFile}`);
        continue;
      }

      const destStat = fs.statSync(destFile);
      if (destStat.size !== stat.size) {
        verificationErrors.push(`Size mismatch for ${relPath}: src ${stat.size} vs dest ${destStat.size}`);
        continue;
      }

      const srcHash = md5File(srcFile);
      const destHash = md5File(destFile);
      if (srcHash !== destHash) {
        verificationErrors.push(`MD5 hash mismatch for ${relPath}: src ${srcHash} vs dest ${destHash}`);
        continue;
      }

      totalVerified++;
      fileManifest.push({
        file: relPath,
        size: stat.size,
        hash: srcHash,
        verified: true
      });
    }
  }

  console.log(`\n--- Verification Results ---`);
  console.log(`Total Source Files Scanned: ${totalFiles}`);
  console.log(`Total Files Copied:         ${totalCopied}`);
  console.log(`Total Files MD5 Verified:   ${totalVerified}`);
  console.log(`Total Bytes Archived:       ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Verification Errors:        ${verificationErrors.length}`);

  if (verificationErrors.length > 0) {
    console.error("FATAL: Archival verification failed!");
    verificationErrors.forEach(err => console.error("  ->", err));
    process.exit(1);
  }

  console.log("\n[SUCCESS] 100% of Group D files copied and cryptographically verified in D:/Sai_Ajantha_Archive!");

  // Write manifest to archive
  fs.writeFileSync(
    path.join(ARCHIVE_ROOT, "ARCHIVE_VERIFICATION_MANIFEST.json"),
    JSON.stringify({ totalFiles, totalBytes, fileManifest }, null, 2),
    "utf8"
  );
  console.log(`Wrote verification manifest to ${ARCHIVE_ROOT}/ARCHIVE_VERIFICATION_MANIFEST.json`);
}

archive().catch(err => {
  console.error("Archive failed:", err);
  process.exit(1);
});
