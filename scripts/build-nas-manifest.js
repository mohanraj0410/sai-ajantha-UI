import fs from "node:fs";
import path from "node:path";
import { parseCsvContent } from "../apps/backend/src/services/import-parser.service.ts";

const rootDir = process.cwd();
const csvPath = path.resolve(rootDir, "apps/admin/public/sai-ajantha-products.csv");
const localNasDir = path.resolve(rootDir, "local-nas");
if (!fs.existsSync(localNasDir)) fs.mkdirSync(localNasDir, { recursive: true });

const text = fs.readFileSync(csvPath, "utf8");
const rawRows = parseCsvContent(text);
const header = rawRows[0];
const dataRows = rawRows.slice(1);

const products = dataRows.map((r, idx) => {
  const sku = (r[0] || "").trim();
  const name = (r[1] || "").trim();
  const category = (r[2] || "Hardware").trim();
  const subcategory = (r[3] || "").trim();
  const brand = (r[4] || "Sai Ajantha").trim();
  const size = (r[5] || "").trim();
  const material = (r[6] || "").trim();
  const billingUnit = (r[7] || "1 unit").trim();
  const customerPrice = r[8] ? parseFloat(r[8]) : null;
  const dealerPrice = r[9] ? parseFloat(r[9]) : null;
  const distributorPrice = r[11] ? parseFloat(r[11]) : null;
  const gstRate = r[12] ? parseFloat(r[12]) : 18;
  const stockQty = r[13] ? parseInt(r[13], 10) : 50;
  const src = (r[15] || "").trim();
  const description = (r[16] || "").trim();

  return {
    id: `prod-${String(idx + 1).padStart(3, "0")}`,
    productNumber: String(idx + 1),
    sku,
    name,
    category,
    categorySlug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sheet: subcategory,
    brand,
    model: "",
    size,
    measurements: size,
    material,
    variantsNote: "",
    description,
    buyingHighlights: "",
    features: "",
    customerBenefits: "",
    specificationSummary: "",
    billingUnit,
    gstRate,
    gstMode: "Excluded",
    moq: "1 unit",
    availability: "In Stock",
    deliveryTime: "3-5 business days",
    warranty: "1 Year Standard",
    buyingOption: "DIRECT",
    approvalStatus: "APPROVED",
    approved: true,
    customerPriceInr: customerPrice,
    contractorPriceInr: dealerPrice,
    dealerPriceInr: dealerPrice,
    distributorPriceInr: distributorPrice,
    publicSrc: src,
    nasRelativePath: src.replace(/^https?:\/\/[^/]+\/(static\/)?/, ""),
    nasUrl: src || `http://localhost:9000/static/products/${sku.toLowerCase()}.jpg`,
    matchMethod: "SKU_EXACT",
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceWorkbook: "apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx",
  nasRoot: localNasDir,
  medusaStaticBaseUrl: "http://localhost:9000/static",
  totalProducts: products.length,
  matchedImagesCount: products.filter((p) => Boolean(p.publicSrc)).length,
  missingImagesCount: products.filter((p) => !p.publicSrc).length,
  categories: Array.from(new Set(products.map((p) => p.category))),
  products,
};

fs.writeFileSync(
  path.resolve(localNasDir, "catalog-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log(`Generated local-nas/catalog-manifest.json with ${products.length} products.`);
