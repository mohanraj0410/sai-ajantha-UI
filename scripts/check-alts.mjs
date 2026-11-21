import fs from 'fs';
import path from 'path';

function checkAlts(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(e.name)) continue;
      checkAlts(full);
    } else if (/\.(tsx|jsx)$/.test(e.name)) {
      const text = fs.readFileSync(full, 'utf8');
      const altMatches = text.matchAll(/alt=["'{]([^"'}]+)["'}]/g);
      for (const m of altMatches) {
        const altText = m[1];
        if (/health|hospital|clinic|patient|medical/i.test(altText)) {
          console.log(`[VIOLATION] ${full}: alt="${altText}"`);
        }
      }
    }
  }
}

console.log('Checking all image alt attributes in storefront:');
checkAlts('apps/storefront');
console.log('Alt audit completed.');
