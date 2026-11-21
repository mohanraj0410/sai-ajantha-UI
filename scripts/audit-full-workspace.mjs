import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import cp from "node:child_process";

const tracked = new Set(
  cp.execSync("git ls-files", { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((l) => l.trim().replaceAll("\\", "/"))
    .filter(Boolean)
);

console.log("Total Git tracked files:", tracked.size);

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".turbo",
  ".medusa",
]);

function scan(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

const allFiles = scan(".");
console.log("Total scanned disk files:", allFiles.length);

const breakdown = {};
let totalBytes = 0;
const trackedByTop = {};
const untrackedByTop = {};

for (const f of allFiles) {
  const rel = path.relative(".", f).replaceAll("\\", "/");
  const top = rel.split("/")[0];
  const size = fs.statSync(f).size;
  totalBytes += size;

  if (!breakdown[top]) breakdown[top] = { count: 0, size: 0 };
  breakdown[top].count++;
  breakdown[top].size += size;

  if (tracked.has(rel)) {
    trackedByTop[top] = (trackedByTop[top] || 0) + 1;
  } else {
    untrackedByTop[top] = (untrackedByTop[top] || 0) + 1;
  }
}

console.log("\n--- Top-Level Directory Breakdown ---");
for (const [k, v] of Object.entries(breakdown).sort((a, b) => b[1].size - a[1].size)) {
  const mb = (v.size / (1024 * 1024)).toFixed(2);
  const tr = trackedByTop[k] || 0;
  const untr = untrackedByTop[k] || 0;
  console.log(`${k.padEnd(25)} | Files: ${v.count.toString().padStart(5)} (Tracked: ${tr.toString().padStart(4)}, Ignored/Untracked: ${untr.toString().padStart(4)}) | Size: ${mb.padStart(8)} MB`);
}
console.log(`\nTotal Monorepo Size (source + local): ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
