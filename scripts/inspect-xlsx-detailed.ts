import fs from "fs";
import { parseXlsxContent } from "../apps/backend/src/services/import-parser.service.ts";

const buffer = fs.readFileSync("apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx");
const sheets = parseXlsxContent(buffer);
console.log("Total worksheets:", sheets.length);

let totalRawAcrossSheets = 0;
let totalRealRows = 0;
let totalSampleRows = 0;
let totalBlankOrTemplateRows = 0;

for (let s = 0; s < sheets.length; s++) {
  const sheet = sheets[s];
  console.log(`\n--- Sheet ${s + 1}: ${sheet.sheetName} (${sheet.rows.length} raw rows) ---`);
  totalRawAcrossSheets += sheet.rows.length;

  if (s === 0) {
    console.log(`  [INDEX SHEET] skipping index/directory sheet.`);
    continue;
  }

  // Find header
  let headerIdx = -1;
  for (let r = 0; r < Math.min(6, sheet.rows.length); r++) {
    const rowStr = sheet.rows[r].join(" ").toLowerCase();
    if (rowStr.includes("sku") || rowStr.includes("product code") || rowStr.includes("product name")) {
      headerIdx = r;
      break;
    }
  }

  if (headerIdx === -1) {
    console.log(`  [NO HEADER FOUND]`);
    continue;
  }

  const headers = sheet.rows[headerIdx];
  const skuCol = headers.findIndex((h) => h.toLowerCase().includes("sku") || h.toLowerCase().includes("product code"));
  const nameCol = headers.findIndex((h) => h.toLowerCase().includes("product name") || h.toLowerCase().includes("title"));

  console.log(`  Header row: ${headerIdx + 1}, SKU col: ${skuCol}, Name col: ${nameCol}`);

  let realInSheet = 0;
  let sampleInSheet = 0;
  let blankInSheet = 0;

  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    const sku = (skuCol >= 0 ? row[skuCol] : row[1] || "").trim();
    const name = (nameCol >= 0 ? row[nameCol] : row[2] || "").trim();

    if (!sku && !name) {
      blankInSheet++;
      totalBlankOrTemplateRows++;
    } else if (sku.startsWith("DEMO-") || name.toLowerCase().includes("demo") || name.toLowerCase().includes("sample")) {
      sampleInSheet++;
      totalSampleRows++;
    } else {
      realInSheet++;
      totalRealRows++;
    }
  }

  console.log(`  Counts -> Real: ${realInSheet}, Sample: ${sampleInSheet}, Blank/Template: ${blankInSheet}, Total data rows: ${sheet.rows.length - headerIdx - 1}`);
}

console.log("\n=======================================================");
console.log(`SUMMARY ACROSS ALL SHEETS:`);
console.log(`Total raw rows across all sheets: ${totalRawAcrossSheets}`);
console.log(`Real product candidate rows: ${totalRealRows}`);
console.log(`Sample rows (DEMO-*): ${totalSampleRows}`);
console.log(`Blank / Template rows: ${totalBlankOrTemplateRows}`);
console.log(`Real + Sample + Blank: ${totalRealRows + totalSampleRows + totalBlankOrTemplateRows}`);
console.log("=======================================================");
