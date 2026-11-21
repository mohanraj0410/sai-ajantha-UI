import React, { useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui";
import { ThemeProvider } from "../../components/theme/theme-context";
import { ThemeHeader } from "../../components/theme/ThemeHeader";
import { AddProductModal } from "../../components/products/AddProductModal";

function ProductImportNavIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

interface ParsedProductRow {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  size: string;
  material: string;
  billing_unit: string;
  customer_price_inr: number | null;
  contractor_price_inr: number | null;
  dealer_price_inr: number | null;
  distributor_price_inr: number | null;
  gst_rate: number;
  stock_qty: number;
  src: string;
  description: string;
  isValid: boolean;
  errors: string[];
}

const DEFAULT_CSV_TEMPLATE = `sku,name,category,subcategory,brand,size,material,billing_unit,customer_price_inr,contractor_price_inr,dealer_price_inr,distributor_price_inr,gst_rate,stock_qty,src,description
SA-ALM-6063-001,Aluminium Extrusion Architectural Profile 6063-T5,Aluminium,Extrusions,Sai Ajantha,50mm x 25mm x 1.5mm,Aluminium Alloy 6063-T5,1 length (3.66m),1450,1280,1150,980,18,500,http://localhost:9000/static/catalog/images/ALM-001.jpg,High-tensile architectural aluminium profile for commercial facades and partitions
SA-FRM-CHS-002,Heavy Duty Sub-Sill Perimeter Channel,Frames & Channels,Sub-Sills,Sai Ajantha,100mm x 45mm x 2.0mm,Aluminium Alloy 6063-T5,1 length (3.0m),1850,1650,1480,1260,18,350,http://localhost:9000/static/catalog/images/FRM-002.jpg,Engineered drainage perimeter sub-sill channel for structural curtain wall installations
SA-GLS-HNG-003,Glass-to-Wall 90 Degree Hydraulic Shower Hinge,Glass Hardware,Shower Fittings,Ajantha Gold,Standard 10-12mm,SS 304 Marine Grade,1 pair,2400,2100,1850,1580,18,120,http://localhost:9000/static/catalog/images/GLS-003.jpg,Heavy-duty SS 304 hydraulic self-closing 90-degree glass hinge tested to 100000 cycles
`;

const DEFAULT_EXCEL_XML = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#102D4D" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Sai Ajantha Product Catalog">
  <Table>
   <Column ss:Width="120"/>
   <Column ss:Width="250"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="60"/>
   <Column ss:Width="70"/>
   <Column ss:Width="180"/>
   <Column ss:Width="250"/>
   <Row ss:Height="25">
    <Cell ss:StyleID="Header"><Data ss:Type="String">sku</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">subcategory</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">brand</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">size</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">material</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">billing_unit</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">customer_price_inr</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">contractor_price_inr</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">dealer_price_inr</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">distributor_price_inr</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">gst_rate</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">stock_qty</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">src</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">description</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">SA-ALM-6063-001</Data></Cell>
    <Cell><Data ss:Type="String">Aluminium Extrusion Architectural Profile 6063-T5</Data></Cell>
    <Cell><Data ss:Type="String">Aluminium</Data></Cell>
    <Cell><Data ss:Type="String">Extrusions</Data></Cell>
    <Cell><Data ss:Type="String">Sai Ajantha</Data></Cell>
    <Cell><Data ss:Type="String">50mm x 25mm x 1.5mm</Data></Cell>
    <Cell><Data ss:Type="String">Aluminium Alloy 6063-T5</Data></Cell>
    <Cell><Data ss:Type="String">1 length (3.66m)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1450</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1280</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1150</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">980</Data></Cell>
    <Cell><Data ss:Type="Number">18</Data></Cell>
    <Cell><Data ss:Type="Number">500</Data></Cell>
    <Cell><Data ss:Type="String">http://localhost:9000/static/catalog/images/ALM-001.jpg</Data></Cell>
    <Cell><Data ss:Type="String">High-tensile architectural aluminium profile for commercial facades and partitions</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">SA-FRM-CHS-002</Data></Cell>
    <Cell><Data ss:Type="String">Heavy Duty Sub-Sill Perimeter Channel</Data></Cell>
    <Cell><Data ss:Type="String">Frames &amp; Channels</Data></Cell>
    <Cell><Data ss:Type="String">Sub-Sills</Data></Cell>
    <Cell><Data ss:Type="String">Sai Ajantha</Data></Cell>
    <Cell><Data ss:Type="String">100mm x 45mm x 2.0mm</Data></Cell>
    <Cell><Data ss:Type="String">Aluminium Alloy 6063-T5</Data></Cell>
    <Cell><Data ss:Type="String">1 length (3.0m)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1850</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1650</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1480</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">1260</Data></Cell>
    <Cell><Data ss:Type="Number">18</Data></Cell>
    <Cell><Data ss:Type="Number">350</Data></Cell>
    <Cell><Data ss:Type="String">http://localhost:9000/static/catalog/images/FRM-002.jpg</Data></Cell>
    <Cell><Data ss:Type="String">Engineered drainage perimeter sub-sill channel for structural curtain wall installations</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

const ProductImportPageContent: React.FC = () => {
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount: number;
    failedCount: number;
    message: string;
  } | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Template Download Handlers
  const handleDownloadCsv = () => {
    const blob = new Blob([DEFAULT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sai-ajantha-products-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    const blob = new Blob([DEFAULT_EXCEL_XML], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sai-ajantha-products-template.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // File Upload & Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        alert("The uploaded file does not contain enough data rows.");
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9_]/g, "")
      );

      const rows: ParsedProductRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rowMap: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowMap[h] = values[idx] || "";
        });

        const sku = rowMap.sku || rowMap.skucode || "";
        const name = rowMap.name || rowMap.title || rowMap.productname || "";
        const category = rowMap.category || rowMap.categoryname || "";
        const subcategory = rowMap.subcategory || rowMap.section || category;
        const brand = rowMap.brand || "Sai Ajantha";
        const size = rowMap.size || rowMap.dimension || "Standard";
        const material = rowMap.material || "Aluminium Alloy 6063-T5";
        const billingUnit = rowMap.billing_unit || rowMap.billingunit || rowMap.unit || "1 unit";

        const customerPrice = rowMap.customer_price_inr || rowMap.customerpriceinr || rowMap.mrp || null;
        const contractorPrice = rowMap.contractor_price_inr || rowMap.contractorpriceinr || null;
        const dealerPrice = rowMap.dealer_price_inr || rowMap.dealerpriceinr || null;
        const distributorPrice = rowMap.distributor_price_inr || rowMap.distributorpriceinr || null;
        const gstRate = rowMap.gst_rate || rowMap.gstrate || "18";
        const stockQty = rowMap.stock_qty || rowMap.stockqty || rowMap.stock || "25";
        const src = rowMap.src || rowMap.image || rowMap.thumbnail || "";
        const description = rowMap.description || `${brand} ${name}`;

        const errors: string[] = [];
        if (!sku) errors.push("Missing SKU");
        if (!name) errors.push("Missing Title");
        if (!category) errors.push("Missing Category");

        rows.push({
          sku,
          name,
          category,
          subcategory,
          brand,
          size,
          material,
          billing_unit: billingUnit,
          customer_price_inr: customerPrice ? parseFloat(customerPrice) : null,
          contractor_price_inr: contractorPrice ? parseFloat(contractorPrice) : null,
          dealer_price_inr: dealerPrice ? parseFloat(dealerPrice) : null,
          distributor_price_inr: distributorPrice ? parseFloat(distributorPrice) : null,
          gst_rate: parseInt(gstRate, 10) || 18,
          stock_qty: parseInt(stockQty, 10) || 25,
          src,
          description,
          isValid: errors.length === 0,
          errors,
        });
      }

      setParsedRows(rows);
    };

    reader.readAsText(file);
  };

  // Perform Bulk Import to Backend API
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    let successCount = 0;
    let failedCount = 0;

    const chunkSize = 10;
    const totalChunks = Math.ceil(validRows.length / chunkSize);

    for (let c = 0; c < totalChunks; c++) {
      const chunk = validRows.slice(c * chunkSize, (c + 1) * chunkSize);

      const payload = {
        products: chunk.map((item) => ({
          sku: item.sku,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory,
          brand: item.brand,
          size: item.size,
          material: item.material,
          billingUnit: item.billing_unit,
          customerPriceInr: item.customer_price_inr,
          contractorPriceInr: item.contractor_price_inr,
          dealerPriceInr: item.dealer_price_inr,
          distributorPriceInr: item.distributor_price_inr,
          gstRate: item.gst_rate,
          stockQty: item.stock_qty,
          src: item.src,
          description: item.description,
          approved: true,
        })),
      };

      try {
        const res = await fetch("/admin/sai-ajanta/products", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          successCount += json.count || chunk.length;
        } else {
          failedCount += chunk.length;
        }
      } catch {
        failedCount += chunk.length;
      }

      setImportProgress(Math.round(((c + 1) / totalChunks) * 100));
    }

    setImporting(false);
    setImportResult({
      success: successCount > 0,
      importedCount: successCount,
      failedCount,
      message: `Successfully imported ${successCount} products into Medusa catalog.${
        failedCount > 0 ? ` ${failedCount} rows failed.` : ""
      }`,
    });
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="flex flex-col gap-y-5 pb-12">
      {/* Top Header */}
      <ThemeHeader
        title="Bulk Product Import &amp; Catalog Schema"
        subtitle="Download schema templates, import CSV/Excel spreadsheets, and publish live SKUs"
        onAddProductClick={() => setIsAddProductOpen(true)}
      />

      {/* Templates & Schema Download Banner */}
      <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Badge color="blue">Official 16-Field Schema</Badge>
              <Badge color="green">Excel + CSV Ready</Badge>
            </div>
            <h2 className="mt-2 text-lg font-bold text-ui-fg-base">
              Download Standard Product Catalog Templates
            </h2>
            <Text size="small" className="mt-1 text-ui-fg-subtle">
              Pre-structured with the official 16-point hardware attribute schema, including 4-tier
              B2B pricing (Customer, Contractor, Dealer, Distributor), GST rates, units, and inventory.
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 border-ui-border-base"
            >
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Download CSV Template (.csv)
            </Button>

            <Button
              variant="secondary"
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 border-ui-border-base bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="15" />
                <line x1="15" y1="9" x2="9" y2="15" />
              </svg>
              Download Excel Template (.xls)
            </Button>
          </div>
        </div>

        {/* 16-Point Schema Field Summary Pills */}
        <div className="mt-5 border-t border-ui-border-base pt-4">
          <Text size="xsmall" className="font-semibold uppercase tracking-wider text-ui-fg-muted">
            Default Product Structure (16 Fields):
          </Text>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { name: "sku", req: true },
              { name: "name", req: true },
              { name: "category", req: true },
              { name: "subcategory", req: false },
              { name: "brand", req: false },
              { name: "size", req: false },
              { name: "material", req: false },
              { name: "billing_unit", req: false },
              { name: "customer_price_inr", req: false },
              { name: "contractor_price_inr", req: false },
              { name: "dealer_price_inr", req: false },
              { name: "distributor_price_inr", req: false },
              { name: "gst_rate", req: false },
              { name: "stock_qty", req: false },
              { name: "src", req: false },
              { name: "description", req: false },
            ].map((f) => (
              <span
                key={f.name}
                className={`rounded-md px-2 py-0.5 text-xs font-mono font-medium ${
                  f.req
                    ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
                    : "bg-ui-bg-subtle text-ui-fg-subtle border border-ui-border-base"
                }`}
              >
                {f.name} {f.req ? "*" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* File Upload Drop Zone */}
      <div className="rounded-xl border-2 border-dashed border-ui-border-base bg-ui-bg-base p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#102d4d] text-white shadow-sm dark:bg-[#079d9a]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3 className="mt-3 text-base font-bold text-ui-fg-base">
          Upload Catalog CSV or Spreadsheet
        </h3>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          Drag and drop your file here, or browse from your computer (.csv, .xlsx, .xls)
        </Text>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#079d9a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#068280] transition-colors">
          <span>Browse File</span>
          <input
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {fileName && (
          <div className="mt-3 text-xs font-medium text-ui-fg-base">
            Selected File: <span className="font-mono text-[#079d9a]">{fileName}</span>
          </div>
        )}
      </div>

      {/* Import Status Alert */}
      {importResult && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            importResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          }`}
        >
          <div className="font-bold">{importResult.success ? "Import Complete!" : "Import Notice"}</div>
          <div>{importResult.message}</div>
        </div>
      )}

      {/* Validation & Preview Section */}
      {parsedRows.length > 0 && (
        <Container className="divide-y p-0 overflow-hidden shadow-sm">
          {/* Summary & Confirm Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-ui-bg-base">
            <div className="flex items-center gap-3">
              <div>
                <Heading level="h2" className="text-base font-bold">
                  File Preview &amp; Schema Validation
                </Heading>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-ui-fg-subtle">Total: {parsedRows.length} rows</span>
                  <Badge color="green">{validCount} Valid Ready</Badge>
                  {invalidCount > 0 && <Badge color="red">{invalidCount} Incomplete</Badge>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {importing && (
                <div className="flex items-center gap-2 text-xs font-medium text-[#079d9a]">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-ui-bg-subtle border">
                    <div
                      className="h-full bg-[#079d9a] transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <span>{importProgress}%</span>
                </div>
              )}

              <Button
                variant="primary"
                onClick={handleExecuteImport}
                disabled={importing || validCount === 0}
                className="bg-[#079d9a] hover:bg-[#068280] text-white"
              >
                {importing ? "Importing to Medusa..." : `Confirm Import (${validCount} Products)`}
              </Button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto px-6 py-3">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Product Name</Table.HeaderCell>
                  <Table.HeaderCell>Category</Table.HeaderCell>
                  <Table.HeaderCell>MRP (₹)</Table.HeaderCell>
                  <Table.HeaderCell>Dealer (₹)</Table.HeaderCell>
                  <Table.HeaderCell>Distributor (₹)</Table.HeaderCell>
                  <Table.HeaderCell>Stock</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <Table.Row key={idx} className="hover:bg-ui-bg-subtle/30">
                    <Table.Cell>
                      {row.isValid ? (
                        <Badge color="green">Valid</Badge>
                      ) : (
                        <Badge color="red" title={row.errors.join(", ")}>
                          Error
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-xs font-bold text-ui-fg-base">
                      {row.sku || "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col max-w-xs">
                        <span className="font-medium text-ui-fg-base truncate">{row.name}</span>
                        <span className="text-[11px] text-ui-fg-muted">{row.billing_unit}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="blue">{row.category}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {row.customer_price_inr ? `₹${row.customer_price_inr}` : "—"}
                    </Table.Cell>
                    <Table.Cell>
                      {row.dealer_price_inr ? `₹${row.dealer_price_inr}` : "—"}
                    </Table.Cell>
                    <Table.Cell className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {row.distributor_price_inr ? `₹${row.distributor_price_inr}` : "—"}
                    </Table.Cell>
                    <Table.Cell>{row.stock_qty}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            {parsedRows.length > 50 && (
              <Text size="xsmall" className="mt-2 block text-ui-fg-subtle">
                Showing first 50 of {parsedRows.length} rows. All {validCount} valid rows will be imported.
              </Text>
            )}
          </div>
        </Container>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />
    </div>
  );
};

const ProductImportPage: React.FC = () => {
  return (
    <ThemeProvider>
      <ProductImportPageContent />
    </ThemeProvider>
  );
};

export const config = defineRouteConfig({
  label: "Product Import",
  icon: ProductImportNavIcon,
  rank: 4,
});

export default ProductImportPage;
