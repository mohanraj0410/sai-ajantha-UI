const fs = require('fs');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const content = fs.readFileSync('apps/admin/public/sai-ajantha-products.csv', 'utf8').trim();
const lines = content.split(/\r?\n/);
const header = parseCsvLine(lines[0]);
console.log('Columns (' + header.length + '):', header);

const catIndex = header.indexOf('category');
const subcatIndex = header.indexOf('subcategory');
const skuIndex = header.indexOf('sku');
const nameIndex = header.indexOf('name');
const custPriceIndex = header.indexOf('customer_price_inr');

const counts = {};
const subcatCounts = {};
let emptyPrices = 0;
let zeroPrices = 0;
const skus = new Set();
const duplicateSkus = [];

lines.slice(1).forEach((l, idx) => {
  const parts = parseCsvLine(l);
  const cat = parts[catIndex] || 'EMPTY';
  const subcat = parts[subcatIndex] || 'EMPTY';
  const sku = parts[skuIndex] || '';
  const price = parts[custPriceIndex];

  counts[cat] = (counts[cat] || 0) + 1;
  subcatCounts[cat + ' > ' + subcat] = (subcatCounts[cat + ' > ' + subcat] || 0) + 1;

  if (!price || price.trim() === '') emptyPrices++;
  else if (Number(price) === 0) zeroPrices++;

  if (skus.has(sku)) duplicateSkus.push({ row: idx + 2, sku });
  else skus.add(sku);
});

console.log('\n=== CATEGORY BREAKDOWN (' + (lines.length - 1) + ' ROWS) ===');
console.table(counts);

console.log('\n=== PRICE CHECKS ===');
console.log('Empty customer prices:', emptyPrices);
console.log('Zero customer prices:', zeroPrices);
console.log('Unique SKUs:', skus.size);
console.log('Duplicate SKUs:', duplicateSkus.length);
if (duplicateSkus.length > 0) console.log(duplicateSkus);
