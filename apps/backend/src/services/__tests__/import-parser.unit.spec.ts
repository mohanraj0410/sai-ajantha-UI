import * as fs from "fs";
import * as path from "path";
import {
  parseCsvContent,
  parseAndValidateImportBuffer,
  generateErrorReportCsv,
} from "../import-parser.service";

describe("Phase 06 Work Unit P6.2: Import Parser Service", () => {
  it("should parse RFC-4180 CSV with quotes, commas, CRLF, and UTF-8 BOM", () => {
    const csvWithBom =
      "\uFEFFsku,name,customer_price_inr\r\n" +
      'SA-001,"Aluminium Profile, 12ft",1450\r\n' +
      'SA-002,"Special ""Heavy"" Bracket",250\r\n';

    const rows = parseCsvContent(csvWithBom);
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(["sku", "name", "customer_price_inr"]);
    expect(rows[1]).toEqual(["SA-001", "Aluminium Profile, 12ft", "1450"]);
    expect(rows[2]).toEqual(["SA-002", 'Special "Heavy" Bracket', "250"]);
  });

  it("should reject unsupported binary format (e.g. PDF/EXE)", () => {
    const fakePdf = Buffer.from("%PDF-1.4 Fake PDF Content", "utf8");
    const result = parseAndValidateImportBuffer({
      fileName: "catalog.pdf",
      buffer: fakePdf,
    });

    expect(result.globalErrors.length).toBeGreaterThan(0);
    expect(result.globalErrors[0]).toContain("Unsupported file format");
    expect(result.candidateRows).toBe(0);
  });

  it("should correctly exclude sample rows and preserve real candidate rows", () => {
    const csvContent =
      "sku,name,category,customer_price_inr,gst_rate,stock_qty\r\n" +
      "DEMO-DC60-SIL,Ajantha DC60 Adjustable Door Closer,Door Closer & Floor Spring,1148,18,50\r\n" +
      "SA-M-DC-60-001,Door closer -60-Half Round Silver,Door Closer & Floor Spring,1148,18,50\r\n" +
      "SA-TEST-SAMPLE,Training Test Row Example,Aluminium,500,18,50\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "products.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    expect(result.totalRows).toBe(3);
    expect(result.excludedSampleRows).toBe(2); // DEMO-DC60-SIL and SA-TEST-SAMPLE
    expect(result.candidateRows).toBe(1); // SA-M-DC-60-001

    const realRow = result.rows.find((r) => r.sku === "SA-M-DC-60-001");
    expect(realRow).toBeDefined();
    expect(realRow?.severity).toBe("VALID");
    expect(realRow?.customerPriceInr).toBe(1148);
    expect(realRow?.gstRate).toBe(18);
    expect(realRow?.stockQty).toBe(50);
  });

  it("should preserve null/missing prices as QUOTE_ONLY rather than ₹0", () => {
    const csvContent =
      "sku,name,category,customer_price_inr\r\n" +
      "SA-M-DC-UNPRICED,Concealed Door Closer DC-60,Door Closer & Floor Spring,\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "unpriced.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    const row = result.rows[0];
    expect(row.customerPriceInr).toBeNull();
    expect(row.isQuoteOnly).toBe(true);
    expect(row.warnings).toContain(
      "No customer list price provided; item will be set to QUOTE_ONLY."
    );
  });

  it("should enforce ENQUIRY_ONLY on Floor Springs SKUs per DEC-002", () => {
    const csvContent =
      "sku,name,category,customer_price_inr\r\n" +
      "SA-M-FS-TON90-007,Hydraulic Single Cylinder Floor Spring TON-90,Door Closer & Floor Spring,3500\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "floor_spring.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    const row = result.rows[0];
    expect(row.route).toBe("ENQUIRY_ONLY");
    expect(row.isQuoteOnly).toBe(true);
    expect(row.warnings).toContain(
      "Floor spring SKU: checkout is strictly ENQUIRY_ONLY per DEC-002 policy."
    );
  });

  it("should detect duplicate SKUs within the import file", () => {
    const csvContent =
      "sku,name,category,customer_price_inr\r\n" +
      "SA-DUP-001,Product One,Aluminium,100\r\n" +
      "SA-DUP-001,Product Duplicate,Aluminium,200\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "duplicates.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    expect(result.duplicateRows).toBe(2);
    expect(result.rows[0].severity).toBe("DUPLICATE");
    expect(result.rows[1].severity).toBe("DUPLICATE");
  });

  it("should generate a downloadable CSV error report", () => {
    const csvContent =
      "sku,name,category,customer_price_inr\r\n" +
      "SA-ERR-001,,Aluminium,-50\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "error.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    const errorReport = generateErrorReportCsv(result.rows);
    expect(errorReport).toContain("SourceRowNumber,SKU,ProductName,Category,Severity,Route,Errors,Warnings");
    expect(errorReport).toContain("SA-ERR-001");
    expect(errorReport).toContain("Missing Product Name/Title.");
    expect(errorReport).toContain("Price cannot be negative (-50)");
  });

  it("should successfully parse the actual Sai Ajantha 281-row products CSV", () => {
    const csvPath = path.resolve(process.cwd(), "apps/admin/public/sai-ajantha-products.csv");
    if (!fs.existsSync(csvPath)) return;

    const buffer = fs.readFileSync(csvPath);
    const result = parseAndValidateImportBuffer({
      fileName: "sai-ajantha-products.csv",
      buffer,
    });

    expect(result.totalRows).toBe(281);
    expect(result.excludedSampleRows).toBe(0);
    expect(result.duplicateRows).toBe(0);
    expect(result.candidateRows).toBe(281);
    expect(result.validRows).toBeGreaterThan(250);
  });

  it("should successfully parse genuine OpenXML workbook (Sai_Ajantha_Product_Input_Workbook.xlsx)", () => {
    const xlsxPath = path.resolve(
      process.cwd(),
      "apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx"
    );
    if (!fs.existsSync(xlsxPath)) return;

    const buffer = fs.readFileSync(xlsxPath);
    const result = parseAndValidateImportBuffer({
      fileName: "Sai_Ajantha_Product_Input_Workbook.xlsx",
      buffer,
    });

    expect(result.fileFormat).toBe("XLSX");
    expect(result.totalRows).toBeGreaterThan(200);
    expect(result.excludedSampleRows).toBeGreaterThanOrEqual(11); // Excludes Row 5 illustrative samples
    expect(result.candidateRows).toBeGreaterThanOrEqual(190);
  });

  it("should NOT default missing GST to 18% or missing Stock to 50 (P6.11.3)", () => {
    const csvContent =
      "sku,name,category,customer_price_inr,gst_rate,stock_qty\r\n" +
      "SA-NO-DEFAULTS,Aluminium Angle Section,Aluminium,500,,\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "no_defaults.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    const row = result.rows[0];
    expect(row.gstRate).toBeNull();
    expect(row.taxStatus).toBe("UNVERIFIED");
    expect(row.stockQty).toBeNull();
    expect(row.stockStatus).toBe("UNVERIFIED");
    expect(row.isQuoteOnly).toBe(true);
    expect(row.warnings).toContain("Missing GST rate: tax status is UNVERIFIED; financial checkout blocked to QUOTE_ONLY.");
    expect(row.warnings).toContain("Missing stock quantity: inventory status is UNVERIFIED; direct stock deduction blocked.");
  });

  it("should prohibit ₹0 price and convert to QUOTE_ONLY (P6.11.3)", () => {
    const csvContent =
      "sku,name,category,customer_price_inr,gst_rate,stock_qty\r\n" +
      "SA-ZERO-PRICE,Zero Price Item,Hardware,0,18,10\r\n";

    const result = parseAndValidateImportBuffer({
      fileName: "zero_price.csv",
      buffer: Buffer.from(csvContent, "utf8"),
    });

    const row = result.rows[0];
    expect(row.customerPriceInr).toBeNull();
    expect(row.isQuoteOnly).toBe(true);
    expect(row.warnings).toContain("₹0 price prohibited for payable checkout; converted to QUOTE_ONLY.");
  });
});
