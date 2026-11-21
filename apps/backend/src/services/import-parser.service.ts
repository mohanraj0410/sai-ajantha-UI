/**
 * SAI AJANTHA — CONTROLLED CATALOG IMPORT PARSER SERVICE (Phase 06: P6.2)
 *
 * Provides real OpenXML (.xlsx) and RFC-4180 (.csv) parsing, schema validation,
 * sample/training row exclusion, price integrity enforcement, and detailed error reporting.
 */

import * as zlib from "zlib";
import type {
  CanonicalSellerRoute,
  Excel34ColumnHeader,
  FieldVerificationStatus,
  ImportRowSeverity,
  StagedImportRowDto,
} from "@sai-ajanta/types";
import {
  EXCEL_34_COLUMNS,
  resolveProductSellerRoute,
} from "@sai-ajanta/types";

export interface ParseImportOptions {
  fileName: string;
  buffer: Buffer;
  sheetIndexOrName?: number | string;
  jobId?: string;
}

export interface ParseImportResult {
  fileName: string;
  fileFormat: "XLSX" | "CSV";
  totalRows: number;
  candidateRows: number;
  validRows: number;
  warningRows: number;
  blockedRows: number;
  duplicateRows: number;
  excludedSampleRows: number;
  rows: StagedImportRowDto[];
  globalErrors: string[];
}

const SAMPLE_ROW_PATTERN =
  /(^|\b)(sample|training|test[-_ ]?row|demo[-_ ]?sku|do not publish|illustrative)(\b|$)|^DEMO-/i;

// ============================================================================
// 1. RFC-4180 CSV Parsing
// ============================================================================

export function parseCsvContent(text: string): string[][] {
  // Strip UTF-8 BOM if present
  let clean = text;
  if (clean.charCodeAt(0) === 0xfeff) {
    clean = clean.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && clean[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      // Only push non-empty rows
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// ============================================================================
// 2. OpenXML XLSX Parsing (PKZip + XML Decompression)
// ============================================================================

const MAX_ZIP_ENTRIES = 1000;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB per XML entry
const MAX_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB cumulative

function extractZipEntries(buffer: Buffer): {
  getEntryText: (name: string) => string | null;
  getEntryBuffer: (name: string) => Buffer | null;
  getFileNames: () => string[];
} {
  // Find End of Central Directory Record (EOCD)
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP / XLSX: EOCD signature not found.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`Suspicious archive: entry count (${totalEntries}) exceeds maximum safe limit (${MAX_ZIP_ENTRIES}).`);
  }

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map<
    string,
    { compression: number; compressedSize: number; uncompressedSize: number; dataOffset: number }
  >();

  let cur = cdOffset;
  let cumulativeUncompressed = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (cur + 46 > buffer.length || buffer.readUInt32LE(cur) !== 0x02014b50) break;
    const compression = buffer.readUInt16LE(cur + 10);
    const compressedSize = buffer.readUInt32LE(cur + 20);
    const uncompressedSize = buffer.readUInt32LE(cur + 24);
    const fileNameLen = buffer.readUInt16LE(cur + 28);
    const extraLen = buffer.readUInt16LE(cur + 30);
    const commentLen = buffer.readUInt16LE(cur + 32);
    const localHeaderOffset = buffer.readUInt32LE(cur + 42);

    const fileName = buffer.toString("utf8", cur + 46, cur + 46 + fileNameLen);
    cur += 46 + fileNameLen + extraLen + commentLen;

    // Path traversal check
    if (fileName.includes("..") || fileName.startsWith("/") || fileName.startsWith("\\")) {
      throw new Error(`Suspicious entry path '${fileName}': potential path traversal detected.`);
    }

    // Zip bomb / size guards
    if (uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error(`Entry '${fileName}' exceeds single-entry uncompressed size limit (${uncompressedSize} bytes).`);
    }

    cumulativeUncompressed += uncompressedSize;
    if (cumulativeUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`Archive exceeds total cumulative uncompressed size limit (${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes).`);
    }

    const localFileNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

    entries.set(fileName, {
      compression,
      compressedSize,
      uncompressedSize,
      dataOffset,
    });
  }

  const getEntryBuffer = (name: string): Buffer | null => {
    const entry = entries.get(name);
    if (!entry) return null;
    const raw = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compression === 0) {
      return raw;
    } else if (entry.compression === 8) {
      return zlib.inflateRawSync(raw);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${entry.compression}`);
    }
  };

  const getEntryText = (name: string): string | null => {
    const buf = getEntryBuffer(name);
    if (!buf) return null;
    let str = buf.toString("utf8");
    // Strip XML DTD/Entity definitions to prevent XXE
    if (str.includes("<!DOCTYPE") || str.includes("<!ENTITY")) {
      str = str.replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<!ENTITY[^>]*>/gi, "");
    }
    return str;
  };

  return {
    getEntryText,
    getEntryBuffer,
    getFileNames: () => Array.from(entries.keys()),
  };
}

export function parseXlsxContent(
  buffer: Buffer,
  sheetIndexOrName?: number | string
): { sheetName: string; rows: string[][] }[] {
  const zip = extractZipEntries(buffer);

  // 1. Shared Strings Table
  const sharedStrings: string[] = [];
  const sstXml = zip.getEntryText("xl/sharedStrings.xml");
  if (sstXml) {
    const siMatches = sstXml.match(/<si>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = Array.from(si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) => m[1]);
      sharedStrings.push(
        tMatches
          .join("")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
  }

  // 2. Workbook sheet metadata
  const wbXml = zip.getEntryText("xl/workbook.xml");
  const sheets: { name: string; sheetId: string; rId: string }[] = [];
  if (wbXml) {
    const sheetTagMatches = Array.from(
      wbXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+sheetId="([^"]+)"[^>]+r:id="([^"]+)"/g)
    );
    for (const m of sheetTagMatches) {
      sheets.push({ name: m[1], sheetId: m[2], rId: m[3] });
    }
  }

  // 3. Parse each sheet
  const results: { sheetName: string; rows: string[][] }[] = [];

  const targetSheetFiles = zip
    .getFileNames()
    .filter((f) => f.startsWith("xl/worksheets/sheet") && f.endsWith(".xml"))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    });

  for (let sIdx = 0; sIdx < targetSheetFiles.length; sIdx++) {
    const sFile = targetSheetFiles[sIdx];
    const sheetMeta = sheets[sIdx] || { name: `Sheet ${sIdx + 1}` };

    if (
      sheetIndexOrName !== undefined &&
      typeof sheetIndexOrName === "number" &&
      sheetIndexOrName !== sIdx
    ) {
      continue;
    }
    if (
      sheetIndexOrName !== undefined &&
      typeof sheetIndexOrName === "string" &&
      sheetMeta.name.toLowerCase() !== sheetIndexOrName.toLowerCase()
    ) {
      continue;
    }

    const xml = zip.getEntryText(sFile);
    if (!xml) continue;

    const rowMatches = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
    const sheetRows: string[][] = [];

    for (const rXml of rowMatches) {
      const cMatches = rXml.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || [];
      const colMap = new Map<number, string>();
      let maxCol = 0;

      for (const c of cMatches) {
        const rAttrMatch = c.match(/r="([A-Z]+)(\d+)"/);
        if (!rAttrMatch) continue;
        const colLetters = rAttrMatch[1];
        let colNum = 0;
        for (let i = 0; i < colLetters.length; i++) {
          colNum = colNum * 26 + (colLetters.charCodeAt(i) - 64);
        }
        colNum -= 1; // 0-indexed
        if (colNum > maxCol) maxCol = colNum;

        const isShared = c.includes('t="s"');
        const vMatch = c.match(/<v>([\s\S]*?)<\/v>/);
        const isMatch = c.match(/<is><t[^>]*>([\s\S]*?)<\/t><\/is>/);

        let cellVal = "";
        if (isShared && vMatch) {
          const sIndex = parseInt(vMatch[1], 10);
          cellVal = sharedStrings[sIndex] || "";
        } else if (vMatch) {
          cellVal = vMatch[1];
        } else if (isMatch) {
          cellVal = isMatch[1];
        }

        cellVal = cellVal
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");

        colMap.set(colNum, cellVal.trim());
      }

      if (colMap.size > 0) {
        const rowArr: string[] = [];
        for (let c = 0; c <= maxCol; c++) {
          rowArr.push(colMap.get(c) || "");
        }
        // Exclude completely blank rows
        if (rowArr.some((v) => v.length > 0)) {
          sheetRows.push(rowArr);
        }
      }
    }

    results.push({ sheetName: sheetMeta.name, rows: sheetRows });
  }

  return results;
}

// ============================================================================
// 3. Schema Normalization & Validation Engine
// ============================================================================

export function parseAndValidateImportBuffer(options: ParseImportOptions): ParseImportResult {
  const { fileName, buffer, jobId = `job_${Date.now()}` } = options;
  const globalErrors: string[] = [];

  if (!buffer || buffer.length === 0) {
    return {
      fileName,
      fileFormat: "CSV",
      totalRows: 0,
      candidateRows: 0,
      validRows: 0,
      warningRows: 0,
      blockedRows: 0,
      duplicateRows: 0,
      excludedSampleRows: 0,
      rows: [],
      globalErrors: ["File is empty (0 bytes)."],
    };
  }

  // Detect file magic
  const magic = buffer.subarray(0, 4).toString("hex").toUpperCase();
  const isZip = magic === "504B0304";
  const isXlsx = isZip || fileName.toLowerCase().endsWith(".xlsx");
  const isCsv = !isZip && (fileName.toLowerCase().endsWith(".csv") || fileName.toLowerCase().endsWith(".txt"));

  if (!isXlsx && !isCsv) {
    return {
      fileName,
      fileFormat: isZip ? "XLSX" : "CSV",
      totalRows: 0,
      candidateRows: 0,
      validRows: 0,
      warningRows: 0,
      blockedRows: 0,
      duplicateRows: 0,
      excludedSampleRows: 0,
      rows: [],
      globalErrors: [
        `Unsupported file format for '${fileName}'. Only genuine .xlsx and RFC-4180 .csv files are supported.`,
      ],
    };
  }

  let rawTableRows: string[][] = [];

  if (isXlsx) {
    try {
      const sheets = parseXlsxContent(buffer, options.sheetIndexOrName);
      if (sheets.length === 0) {
        throw new Error("No worksheets found in XLSX file.");
      }

      // If workbook has category sheets (e.g. 02 Door Closers, 03 Kitchen Baskets), aggregate data rows
      const categorySheets = sheets.filter(
        (s) => s.sheetName !== "01 Categories" && s.rows.length >= 2
      );

      if (categorySheets.length > 0) {
        // Collect rows across category sheets
        for (const sheet of categorySheets) {
          // Identify header row (typically row 4 or first row with SKU/Product header)
          let headerIdx = -1;
          for (let r = 0; r < Math.min(6, sheet.rows.length); r++) {
            const rowStr = sheet.rows[r].join(" ").toLowerCase();
            if (rowStr.includes("sku") || rowStr.includes("product code") || rowStr.includes("product name")) {
              headerIdx = r;
              break;
            }
          }
          if (headerIdx !== -1 && headerIdx < sheet.rows.length - 1) {
            const headers = sheet.rows[headerIdx];
            for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
              const rVals = sheet.rows[r];
              // Attach category name if missing
              if (!rVals[5] || rVals[5] === "") {
                rVals[5] = sheet.sheetName.replace(/^\d+\s*/, "");
              }
              // Add header on first row
              if (rawTableRows.length === 0) {
                rawTableRows.push(headers);
              }
              rawTableRows.push(rVals);
            }
          }
        }
      } else {
        rawTableRows = sheets[0].rows;
      }
    } catch (err: any) {
      return {
        fileName,
        fileFormat: "XLSX",
        totalRows: 0,
        candidateRows: 0,
        validRows: 0,
        warningRows: 0,
        blockedRows: 0,
        duplicateRows: 0,
        excludedSampleRows: 0,
        rows: [],
        globalErrors: [`XLSX parsing failed: ${err.message || String(err)}`],
      };
    }
  } else {
    // CSV parsing
    try {
      const text = buffer.toString("utf8");
      rawTableRows = parseCsvContent(text);
    } catch (err: any) {
      return {
        fileName,
        fileFormat: "CSV",
        totalRows: 0,
        candidateRows: 0,
        validRows: 0,
        warningRows: 0,
        blockedRows: 0,
        duplicateRows: 0,
        excludedSampleRows: 0,
        rows: [],
        globalErrors: [`CSV parsing failed: ${err.message || String(err)}`],
      };
    }
  }

  if (rawTableRows.length < 2) {
    return {
      fileName,
      fileFormat: isXlsx ? "XLSX" : "CSV",
      totalRows: rawTableRows.length,
      candidateRows: 0,
      validRows: 0,
      warningRows: 0,
      blockedRows: 0,
      duplicateRows: 0,
      excludedSampleRows: 0,
      rows: [],
      globalErrors: ["File contains no data rows (header only or empty)."],
    };
  }

  // Normalize headers
  const rawHeaders = rawTableRows[0];
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    const norm = h
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "");
    headerMap.set(norm, idx);
    // Common aliases across 34-column workbook and legacy 16-17 column CSV
    if (norm.includes("sku") || norm.includes("productcode")) headerMap.set("sku", idx);
    if (norm === "productname" || norm === "title") headerMap.set("name", idx);
    if (norm === "productnumber") headerMap.set("product_number", idx);
    if (norm === "model") headerMap.set("model", idx);
    if (norm === "category" || norm === "cat") headerMap.set("category", idx);
    if (norm === "subcategory" || norm === "subcat") headerMap.set("subcategory", idx);
    if (norm === "features") headerMap.set("features", idx);
    if (norm === "customerbenefits") headerMap.set("customer_benefits", idx);
    if (norm === "measurementsandunits") headerMap.set("measurements_and_units", idx);
    if (norm === "variants") headerMap.set("variants", idx);
    if (norm === "customerprice" || norm === "mrp") headerMap.set("customer_price_inr", idx);
    if (norm === "contractorprice") headerMap.set("contractor_price_inr", idx);
    if (norm === "dealerprice") headerMap.set("dealer_price_inr", idx);
    if (norm === "distributorprice") headerMap.set("distributor_price_inr", idx);
    if (norm === "gstrate" || norm === "gst") headerMap.set("gst_rate", idx);
    if (norm === "stock" || norm === "stockqty" || norm === "quantity") headerMap.set("stock_qty", idx);
    if (norm === "billingunit" || norm === "unit") headerMap.set("billing_unit", idx);
    if (norm === "deliveryinfo") headerMap.set("delivery_info", idx);
    if (norm === "images" || norm === "src") headerMap.set("images", idx);
    if (norm === "otherdocumentlinks") headerMap.set("other_document_links", idx);
    if (norm === "warrantyinfo") headerMap.set("warranty_info", idx);
    if (norm === "referencesellingprice") headerMap.set("reference_selling_price", idx);
    if (norm === "faq") headerMap.set("faq", idx);
    if (norm === "productspecification") headerMap.set("product_specification", idx);
    if (norm === "saleroute") headerMap.set("sale_route", idx);
    if (norm === "isquoteonly") headerMap.set("is_quote_only", idx);
    if (norm === "minorderqty") headerMap.set("min_order_qty", idx);
    if (norm === "maxorderqty") headerMap.set("max_order_qty", idx);
    if (norm === "installationeligible") headerMap.set("installation_eligible", idx);
    if (norm === "hsncode") headerMap.set("hsn_code", idx);
    if (norm === "deliveryprice") headerMap.set("delivery_price", idx);
  });

  const getCol = (row: string[], key: string): string => {
    const idx = headerMap.get(key);
    return idx !== undefined && row[idx] !== undefined ? row[idx].trim() : "";
  };

  const safeParseJsonArray = (str: string): string[] => {
    if (!str || str === "" || str === "Null" || str === "null") return [];
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return str.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean);
    }
    return [str.trim()];
  };

  const safeParseJsonObject = (str: string): Record<string, unknown> => {
    if (!str || str === "" || str === "Null" || str === "null") return {};
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return { raw: str };
    }
    return {};
  };

  const parsedRows: StagedImportRowDto[] = [];
  const skuCounts = new Map<string, number>();

  for (let rIdx = 1; rIdx < rawTableRows.length; rIdx++) {
    const row = rawTableRows[rIdx];
    const sourceRowNumber = rIdx + 1;

    const rawSku = getCol(row, "sku") || getCol(row, "productcode") || row[0] || "";
    const rawName = getCol(row, "name") || getCol(row, "productname") || row[1] || "";
    const rawCategory = getCol(row, "category") || row[2] || "";
    const subcategory = getCol(row, "subcategory") || null;
    const brand = getCol(row, "brand") || "Sai Ajantha";
    const model = getCol(row, "model") || null;
    const productNumber = getCol(row, "product_number") || null;
    const size = getCol(row, "size") || null;
    const measurementsAndUnits = getCol(row, "measurements_and_units") || null;
    const material = getCol(row, "material") || null;
    const billingUnit = getCol(row, "billing_unit") || "1 unit";
    const description = getCol(row, "description") || rawName;
    const src = getCol(row, "images") || getCol(row, "src") || null;
    const deliveryInfo = getCol(row, "delivery_info") || null;
    const warrantyInfo = getCol(row, "warranty_info") || null;
    const hsnCode = getCol(row, "hsn_code") || null;

    // Structured JSON Fields
    const features = safeParseJsonArray(getCol(row, "features"));
    const customerBenefits = safeParseJsonArray(getCol(row, "customer_benefits"));
    const variants = safeParseJsonArray(getCol(row, "variants"));
    const faq = safeParseJsonArray(getCol(row, "faq"));
    const otherDocumentLinks = safeParseJsonArray(getCol(row, "other_document_links"));
    const productSpecification = safeParseJsonObject(getCol(row, "product_specification"));

    // Strict numerical parsing (guarding NaN, Infinity, negative)
    const errors: string[] = [];
    const warnings: string[] = [];

    const parsePrice = (rawStr: string): { val: number | null; error?: string } => {
      if (!rawStr || rawStr === "" || rawStr === "Null" || rawStr === "null") return { val: null };
      const n = Number(rawStr.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(n)) return { val: null, error: `Invalid numerical price '${rawStr}'` };
      if (n < 0) return { val: null, error: `Price cannot be negative (${n})` };
      return { val: Math.round(n * 100) / 100 };
    };

    const cPrice = parsePrice(getCol(row, "customer_price_inr"));
    const contractorPrice = parsePrice(getCol(row, "contractor_price_inr"));
    const dPrice = parsePrice(getCol(row, "dealer_price_inr"));
    const distPrice = parsePrice(getCol(row, "distributor_price_inr"));
    const refPrice = parsePrice(getCol(row, "reference_selling_price"));
    const deliveryPrice = parsePrice(getCol(row, "delivery_price"));

    if (cPrice.val === 0) {
      cPrice.val = null;
      warnings.push("₹0 price prohibited for payable checkout; converted to QUOTE_ONLY.");
    }

    const rawGst = getCol(row, "gst_rate");
    let gstRate: number | null = null;
    let taxStatus: "VERIFIED" | "UNVERIFIED" = "UNVERIFIED";
    if (rawGst && rawGst !== "" && rawGst !== "Null" && rawGst !== "null") {
      const parsedGst = Number(rawGst);
      if (Number.isFinite(parsedGst) && parsedGst >= 0) {
        // Normalize fraction 0.05 -> 5, 0.18 -> 18, or direct percentage 5/18
        gstRate = parsedGst <= 1 && parsedGst > 0 ? Math.round(parsedGst * 100) : Math.round(parsedGst);
        taxStatus = "VERIFIED";
      } else {
        errors.push(`Invalid GST rate value '${rawGst}'`);
      }
    } else {
      gstRate = null;
      taxStatus = "UNVERIFIED";
      warnings.push("Missing GST rate: tax status is UNVERIFIED; financial checkout blocked to QUOTE_ONLY.");
    }

    const rawStock = getCol(row, "stock_qty");
    let stockQty: number | null = null;
    let stockStatus: "VERIFIED" | "UNVERIFIED" = "UNVERIFIED";
    if (rawStock && rawStock !== "" && rawStock !== "Null" && rawStock !== "null") {
      const parsedStock = Number(rawStock);
      if (Number.isFinite(parsedStock) && Number.isInteger(parsedStock) && parsedStock >= 0) {
        stockQty = parsedStock;
        stockStatus = "VERIFIED";
      } else {
        errors.push(`Invalid stock quantity '${rawStock}'`);
      }
    } else {
      stockQty = null;
      stockStatus = "UNVERIFIED";
      warnings.push("Missing stock quantity: inventory status is UNVERIFIED; direct stock deduction blocked.");
    }

    const isManufRaw = getCol(row, "is_manufactured").toLowerCase();
    const isManufactured = isManufRaw === "true" || isManufRaw === "1" || isManufRaw === "yes";

    const rawInstall = getCol(row, "installation_eligible").toLowerCase();
    const installationEligible = rawInstall === "true" || rawInstall === "1" || rawInstall === "yes";

    const rawMinOrder = getCol(row, "min_order_qty");
    const rawMaxOrder = getCol(row, "max_order_qty");
    const maxOrderQty = rawMaxOrder ? Number(rawMaxOrder) : null;

    if (!rawSku) errors.push("Missing SKU code.");
    if (!rawName) errors.push("Missing Product Name/Title.");
    if (!rawCategory) errors.push("Missing Category.");

    if (cPrice.error) errors.push(cPrice.error);
    if (contractorPrice.error) errors.push(contractorPrice.error);
    if (dPrice.error) errors.push(dPrice.error);
    if (distPrice.error) errors.push(distPrice.error);

    // Floor springs and routing resolution
    const routeInfo = resolveProductSellerRoute(rawCategory, rawSku, rawName);
    const rawQuoteOnly = getCol(row, "is_quote_only").toLowerCase();
    const isQuoteOnlyExplicit = rawQuoteOnly === "true" || rawQuoteOnly === "1";
    const isQuoteOnly =
      routeInfo.isQuoteOnly ||
      isQuoteOnlyExplicit ||
      cPrice.val === null ||
      gstRate === null;

    if (cPrice.val === null) {
      warnings.push("No customer list price provided; item will be set to QUOTE_ONLY.");
    }

    if (routeInfo.reason === "FLOOR_SPRINGS_ENQUIRY_ONLY_BLOCKED") {
      warnings.push("Floor spring SKU: checkout is strictly ENQUIRY_ONLY per DEC-002 policy.");
    }

    // Technical Verification Check (illustrative claims, mesh material conflict)
    let technicalVerificationStatus: FieldVerificationStatus = "VERIFIED";
    const specRawStr = JSON.stringify(productSpecification);
    if (specRawStr.toLowerCase().includes("illustrative specification")) {
      technicalVerificationStatus = "PENDING_TECHNICAL_VERIFICATION";
      warnings.push("Specification contains unverified illustrative claims; flagged for technical review.");
    }

    const isMesh = rawCategory.toLowerCase().includes("mesh");
    const titleHasSS304 = rawName.toUpperCase().includes("SS 304") || rawName.toUpperCase().includes("SS304");
    const descOrSpecHasFiber =
      description.toLowerCase().includes("fiberglass") ||
      description.toLowerCase().includes("fibreglass") ||
      specRawStr.toLowerCase().includes("fiberglass") ||
      specRawStr.toLowerCase().includes("fibreglass");

    if (isMesh && titleHasSS304 && descOrSpecHasFiber) {
      technicalVerificationStatus = "PENDING_TECHNICAL_VERIFICATION";
      warnings.push("Conflicting material: title states SS 304 while description/spec states Fiberglass.");
    }

    // Content Verification Check (unanswered FAQ)
    let contentVerificationStatus: FieldVerificationStatus = "VERIFIED";
    if (faq.length > 0) {
      contentVerificationStatus = "PENDING_CONTENT_VERIFICATION";
    }

    // Insect screen area MOQ reminder
    if (rawMinOrder === "50sqt" || rawCategory.toLowerCase().includes("finished frame insect")) {
      warnings.push("Insect Screen order MOQ: combined minimum order area of 50 sq.ft required.");
    }

    // Sample row identification
    const rawProdNum = row[0] || "";
    const isSample =
      SAMPLE_ROW_PATTERN.test(rawSku) ||
      SAMPLE_ROW_PATTERN.test(rawName) ||
      SAMPLE_ROW_PATTERN.test(rawProdNum) ||
      rawSku.toUpperCase().startsWith("DEMO-");

    if (isSample) {
      warnings.push("Identified illustrative/training sample row (excluded from catalog import).");
    }

    // Track SKU duplicate counts
    const cleanSku = rawSku.toUpperCase().trim();
    if (cleanSku && !isSample) {
      skuCounts.set(cleanSku, (skuCounts.get(cleanSku) || 0) + 1);
    }

    let severity: ImportRowSeverity = "VALID";
    if (isSample) {
      severity = "EXCLUDED_SAMPLE";
    } else if (errors.length > 0) {
      severity = "BLOCKED";
    } else if (warnings.length > 0) {
      severity = "WARNING";
    }

    const proposedAction =
      errors.length > 0
        ? "BLOCKED_NEEDS_REVIEW"
        : technicalVerificationStatus !== "VERIFIED"
        ? "BLOCKED_NEEDS_REVIEW"
        : warnings.length > 0
        ? "PROPOSE_UPDATE"
        : "PROPOSE_UPDATE";

    parsedRows.push({
      id: `imp_row_${jobId}_${sourceRowNumber}`,
      jobId,
      sourceRowNumber,
      sku: rawSku,
      name: rawName,
      category: rawCategory,
      subcategory,
      brand,
      size,
      material,
      billingUnit,
      customerPriceInr: cPrice.val,
      dealerPriceInr: dPrice.val,
      distributorPriceInr: distPrice.val,
      contractorPriceInr: contractorPrice.val,
      gstRate,
      stockQty,
      taxStatus,
      stockStatus,
      reviewStatus: "DRAFT",
      reviewedBy: null,
      reviewedAt: null,
      isManufactured,
      src,
      description,
      isSampleRow: isSample,
      severity,
      route: routeInfo.route,
      isQuoteOnly,
      errors,
      warnings,

      // Extended 34-column attributes
      productNumber,
      model,
      features,
      customerBenefits,
      measurementsAndUnits,
      variants,
      deliveryInfo,
      images: src ? [src] : [],
      otherDocumentLinks,
      warrantyInfo,
      referenceSellingPriceInr: refPrice.val,
      faq,
      productSpecification,
      saleRoute: getCol(row, "sale_route") || (routeInfo.route === "SAI_AJANTHA_DIRECT" ? "DIRECT_SAI_AJANTHA" : "DISTRIBUTOR_CHANNEL"),
      minOrderQty: rawMinOrder || null,
      maxOrderQty,
      installationEligible,
      hsnCode,
      deliveryPriceInr: deliveryPrice.val,
      technicalVerificationStatus,
      contentVerificationStatus,
      proposedAction,
    });
  }

  // Second pass: Mark duplicates
  let duplicateCount = 0;
  for (const r of parsedRows) {
    if (!r.isSampleRow && r.sku) {
      const cleanSku = r.sku.toUpperCase().trim();
      if ((skuCounts.get(cleanSku) || 0) > 1) {
        r.errors.push(`Duplicate SKU '${r.sku}' found within imported file.`);
        r.severity = "DUPLICATE";
        duplicateCount++;
      }
    }
  }

  const validRows = parsedRows.filter((r) => r.severity === "VALID").length;
  const warningRows = parsedRows.filter((r) => r.severity === "WARNING").length;
  const blockedRows = parsedRows.filter((r) => r.severity === "BLOCKED").length;
  const excludedSampleRows = parsedRows.filter((r) => r.severity === "EXCLUDED_SAMPLE").length;

  return {
    fileName,
    fileFormat: isXlsx ? "XLSX" : "CSV",
    totalRows: parsedRows.length,
    candidateRows: parsedRows.length - excludedSampleRows,
    validRows,
    warningRows,
    blockedRows,
    duplicateRows: duplicateCount,
    excludedSampleRows,
    rows: parsedRows,
    globalErrors,
  };
}

// ============================================================================
// 4. Downloadable Error Report CSV Generator
// ============================================================================

export function generateErrorReportCsv(rows: StagedImportRowDto[]): string {
  const header = [
    "SourceRowNumber",
    "SKU",
    "ProductName",
    "Category",
    "Severity",
    "Route",
    "Errors",
    "Warnings",
  ];

  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return "";
    let str = String(val);
    // Neutralize spreadsheet formula injection (=, +, -, @, \t, \r)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [header.join(",")];
  for (const r of rows) {
    const line = [
      escapeCell(r.sourceRowNumber),
      escapeCell(r.sku),
      escapeCell(r.name),
      escapeCell(r.category),
      escapeCell(r.severity),
      escapeCell(r.route),
      escapeCell(r.errors.join(" | ")),
      escapeCell(r.warnings.join(" | ")),
    ];
    lines.push(line.join(","));
  }

  return lines.join("\r\n");
}

// ============================================================================
// 5. Authoritative 34-Column Template & Export Generators
// ============================================================================

export function generateExact34ColumnTemplateCsv(): string {
  const header = EXCEL_34_COLUMNS.join(",");
  const sampleRow = [
    "1",
    '"Door Closer - 60 kg Half Round (Silver) with Scissor Arm"',
    '"House of Ajantha"',
    '"DC-60-HR"',
    '"SA-M-DC-60-001"',
    '"Door Closers"',
    '"High performance rack and pinion hydraulic door closer with scissor arm"',
    '"[""60 kg door weight capacity"",""Rack and pinion mechanism"",""Adjustable closing speed""]"',
    '"[""Smooth silent closing"",""Tested for 100000 cycles""]"',
    '"60 kg capacity"',
    '"Max door width 950mm"',
    '"Die-Cast Aluminium Body"',
    '"[""Silver"",""Charcoal""]"',
    "950",
    "1100",
    "1200",
    "1450",
    '"1 Unit"',
    "0.18",
    "",
    '"Dispatched within 24-48 hours via surface transport"',
    '"/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg"',
    "",
    '"2 Years manufacturer warranty against hydraulic leakage"',
    "1650",
    '"[""Can this be fitted on exterior doors?"",""Is closing speed adjustable?""]"',
    '"{""Arm Type"":""Scissor Arm"",""Max Door Weight"":""60 kg"",""Closing Speed"":""Dual Valve Adjustable""}"',
    '"DISTRIBUTOR_CHANNEL"',
    "false",
    "1",
    "50",
    "true",
    "",
    "",
  ];
  return header + "\r\n" + sampleRow.join(",") + "\r\n";
}

export const ImportParserService = {
  parseFile: (buffer: Buffer, fileName: string): ParseImportResult =>
    parseAndValidateImportBuffer({ buffer, fileName }),
  parseCsv: parseCsvContent,
  parseXlsx: parseXlsxContent,
  generateErrorReportCsv,
  generateExact34ColumnTemplateCsv,
};
