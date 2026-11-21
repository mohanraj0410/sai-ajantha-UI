import fs from "node:fs";
import path from "node:path";

function list(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) res = res.concat(list(f));
    else res.push(f);
  }
  return res;
}

// 1. Audit Storefront Components
const sfComponents = list("apps/storefront/components").filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
const sfSourceFiles = [
  ...list("apps/storefront/app"),
  ...list("apps/storefront/components"),
  ...list("apps/storefront/lib")
].filter(f => f.endsWith(".tsx") || f.endsWith(".ts") || f.endsWith(".js"));

const sfSourceContents = sfSourceFiles.map(f => ({
  file: f,
  text: fs.readFileSync(f, "utf8")
}));

const unusedSfComponents = [];

for (const comp of sfComponents) {
  const compName = path.basename(comp, path.extname(comp));
  let isReferenced = false;
  for (const src of sfSourceContents) {
    if (src.file === comp) continue;
    if (src.text.includes(compName) || src.text.includes(path.basename(comp))) {
      isReferenced = true;
      break;
    }
  }
  if (!isReferenced) {
    unusedSfComponents.push(comp);
  }
}

console.log("Total Storefront components:", sfComponents.length);
console.log("Unreferenced Storefront components:", unusedSfComponents.length);
unusedSfComponents.forEach(c => console.log("  ->", c));

// 2. Audit Admin Components & Pages
const adminFiles = list("apps/admin/src").filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
const adminSourceContents = adminFiles.map(f => ({
  file: f,
  text: fs.readFileSync(f, "utf8")
}));

const unusedAdminFiles = [];
for (const af of adminFiles) {
  const base = path.basename(af, path.extname(af));
  if (["App", "main", "types", "vite-env.d", "index"].includes(base)) continue;
  let isReferenced = false;
  for (const src of adminSourceContents) {
    if (src.file === af) continue;
    if (src.text.includes(base) || src.text.includes(path.basename(af))) {
      isReferenced = true;
      break;
    }
  }
  if (!isReferenced) {
    unusedAdminFiles.push(af);
  }
}

console.log("\nTotal Admin source files:", adminFiles.length);
console.log("Unreferenced Admin source files:", unusedAdminFiles.length);
unusedAdminFiles.forEach(c => console.log("  ->", c));
