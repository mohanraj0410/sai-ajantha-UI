const fs = require('fs');
const path = require('path');

const manifestPath = 'D:/Sai Ajanta/code/local-nas/catalog-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const headers = [
  'sku',
  'name',
  'category',
  'subcategory',
  'brand',
  'size',
  'material',
  'billing_unit',
  'customer_price_inr',
  'contractor_price_inr',
  'dealer_price_inr',
  'distributor_price_inr',
  'gst_rate',
  'stock_qty',
  'is_manufactured',
  'src',
  'description'
];

const rows = [headers.join(',')];

for (const p of manifest.products) {
  const category = p.category || 'Aluminium';
  const isMfg =
    category === 'Aluminium' ||
    category === 'Frames & Channels' ||
    (p.sku && p.sku.startsWith('SA-ALM')) ||
    (p.sheet && p.sheet.toLowerCase().includes('extrusion'));

  const customerPrice = p.customerPriceInr || 1500;
  const contractorPrice = p.contractorPriceInr || Math.round(customerPrice * 0.88);
  const dealerPrice = p.dealerPriceInr || Math.round(customerPrice * 0.80);
  const distributorPrice = p.distributorPriceInr || Math.round(customerPrice * 0.70);

  const cleanDescription = (p.description || p.name).replace(/[\r\n]+/g, ' ').trim();
  const cleanFeatures = (p.specificationSummary || p.size || '').replace(/[\r\n]+/g, ' ').trim();

  rows.push([
    escapeCsv(p.sku || p.id),
    escapeCsv(p.name),
    escapeCsv(category),
    escapeCsv(p.sheet || category),
    escapeCsv(p.brand || 'Sai Ajantha'),
    escapeCsv(p.size || 'Standard'),
    escapeCsv(p.material || 'Aluminium Alloy 6063-T5'),
    escapeCsv(p.billingUnit || '1 unit'),
    customerPrice,
    contractorPrice,
    dealerPrice,
    distributorPrice,
    18,
    50,
    isMfg ? 'true' : 'false',
    escapeCsv(p.nasUrl || ''),
    escapeCsv(cleanDescription || cleanFeatures || p.name)
  ].join(','));
}

const csvContent = rows.join('\r\n');

// 1. Root CSV for easy access
fs.writeFileSync('D:/Sai Ajanta/code/monorepo/sai-ajanta-products.csv', csvContent, 'utf8');

// 2. Admin public folder for direct browser download in the webapp
const adminPublic = 'D:/Sai Ajanta/code/monorepo/apps/admin/public';
fs.mkdirSync(adminPublic, { recursive: true });
fs.writeFileSync(path.join(adminPublic, 'sai-ajanta-products.csv'), csvContent, 'utf8');

console.log(`Successfully generated CSV with ${manifest.products.length} products!`);
console.log(`Saved to:\n- D:/Sai Ajanta/code/monorepo/sai-ajanta-products.csv\n- D:/Sai Ajanta/code/monorepo/apps/admin/public/sai-ajanta-products.csv`);
