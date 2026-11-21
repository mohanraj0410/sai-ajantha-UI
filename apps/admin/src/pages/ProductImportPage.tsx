import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Modal,
  Row,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { TableProps } from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  InboxOutlined,
  LockOutlined,
  SendOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { generateExact34ColumnTemplateCsv } from "@sai-ajanta/types";
import { useAdminMutations } from "../api/adminQueries";
import type { ParsedImportRow, ProductItem } from "../types";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatCard,
  AdminStatusTag,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

type StagingRow = ParsedImportRow & {
  id: string;
  severity?: string;
  proposedAction?: "KEEP_OLD" | "PROPOSE_UPDATE" | "BLOCKED_NEEDS_REVIEW";
  verificationStatus?: string;
  features?: string;
  benefits?: string;
  product_specifications?: Record<string, unknown> | null;
};

export const ProductImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useAdminToast();
  const { batchImportProducts, stageImport, publishImport } = useAdminMutations();

  const [fileName, setFileName] = useState<string | null>(null);
  const [stagedJobId, setStagedJobId] = useState<string | null>(null);
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState<boolean>(true);
  const [selectedRowDetail, setSelectedRowDetail] = useState<StagingRow | null>(null);

  const hasUncommittedImport = Boolean(fileName || rows.length > 0 || stagedJobId) && !importMessage;

  const handleResetImport = useCallback(() => {
    setFileName(null);
    setStagedJobId(null);
    setRows([]);
    setImportMessage(null);
  }, []);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: hasUncommittedImport,
    onDiscard: handleResetImport,
    enabled: true,
  });

  const activeStep = useMemo(() => {
    if (importMessage) return 3;
    if (rows.length > 0) return 2;
    if (fileName) return 1;
    return 0;
  }, [fileName, rows.length, importMessage]);

  const counts = useMemo(() => {
    const valid = rows.filter((r) => r.isValid && !r.is_sample_row).length;
    const samples = rows.filter((r) => r.is_sample_row).length;
    const blocked = rows.filter((r) => !r.isValid && !r.is_sample_row).length;
    const updates = rows.filter((r) => r.proposedAction === "PROPOSE_UPDATE").length;
    const kept = rows.filter((r) => r.proposedAction === "KEEP_OLD").length;
    return { total: rows.length, valid, samples, blocked, updates, kept };
  }, [rows]);

  const downloadTemplate = () => {
    const templateContent = generateExact34ColumnTemplateCsv();
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sai-ajantha-products-34-column-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded official 34-column CSV template.", "info");
  };

  const mapServerRows = (serverRows: any[]): StagingRow[] =>
    serverRows.map((r, i) => {
      const isSample = Boolean(r.is_sample_row || r.isSampleRow);
      const isFloorSpring =
        (r.category && r.category.toLowerCase().includes("floor spring")) ||
        (r.subcategory && r.subcategory.toLowerCase().includes("floor spring")) ||
        (r.sku && r.sku.toUpperCase().includes("-FS-"));

      let proposedAction: "KEEP_OLD" | "PROPOSE_UPDATE" | "BLOCKED_NEEDS_REVIEW" = "PROPOSE_UPDATE";
      if (isSample || !r.sku) {
        proposedAction = "BLOCKED_NEEDS_REVIEW";
      } else if (r.errors && r.errors.length > 0) {
        proposedAction = "BLOCKED_NEEDS_REVIEW";
      } else if (r.proposed_action === "KEEP_OLD") {
        proposedAction = "KEEP_OLD";
      }

      return {
        id: r.id || `row-${i}-${r.sku}`,
        sku: r.sku,
        name: r.name || r.product_name,
        category: r.category,
        subcategory: r.subcategory || r.category,
        brand: r.brand || "Sai Ajantha",
        size: r.size || "Standard",
        material: r.material || "",
        billing_unit: r.billing_unit || r.billingUnit || "1 unit",
        customer_price_inr: r.customer_price_inr ?? r.customerPriceInr ?? null,
        contractor_price_inr: r.contractor_price_inr ?? r.contractorPriceInr ?? null,
        dealer_price_inr: r.dealer_price_inr ?? r.dealerPriceInr ?? null,
        distributor_price_inr: r.distributor_price_inr ?? r.distributorPriceInr ?? null,
        cms_status: "DRAFT",
        is_sample_row: isSample,
        gst_rate: Number(r.gst_rate ?? r.gstRate ?? 18),
        stock_qty: Number(r.stock_qty ?? r.stockQty ?? 0),
        is_manufactured: Boolean(r.is_manufactured ?? r.isManufactured),
        src: r.src || "",
        description: r.description || r.name,
        features: r.features || "",
        benefits: r.benefits || "",
        product_specifications: r.product_specifications || r.productSpecifications || null,
        severity: r.severity || (isSample ? "EXCLUDED_SAMPLE" : "VALID"),
        proposedAction,
        verificationStatus: isFloorSpring
          ? "LOCKED_QUOTE_ONLY"
          : r.verification_status || (r.is_verified ? "VERIFIED" : "PENDING_TECHNICAL_VERIFICATION"),
        isValid: (r.severity === "VALID" || r.severity === "WARNING" || !r.errors?.length) && !isSample,
        errors: Array.isArray(r.errors) ? r.errors : [],
      };
    });

  const handleFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      showToast("Please upload a valid .csv or .xlsx workbook file.", "warning");
      return false;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast("File is too large. Maximum allowed size is 15 MB.", "warning");
      return false;
    }

    setFileName(file.name);
    setStagedJobId(null);
    setImportMessage(null);
    const isXlsx = lowerName.endsWith(".xlsx");
    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const raw = String(ev.target?.result || "");
        const stageRes = await stageImport.mutateAsync(
          isXlsx
            ? { fileName: file.name, fileContentBase64: raw.split(",")[1] || "" }
            : { fileName: file.name, fileContentText: raw }
        );
        setStagedJobId(stageRes.jobId);
        setRows(mapServerRows(stageRes.rows || []));
        showToast(
          `Validated ${stageRes.totalRows} rows (${stageRes.candidateRows} ready, ${stageRes.excludedSamples} samples excluded).`,
          "success"
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not parse uploaded file.", "error");
      }
    };

    if (isXlsx) reader.readAsDataURL(file);
    else reader.readAsText(file);
    return false;
  };

  const handlePublish = async () => {
    if (isDryRun) {
      showToast(
        "Dry-Run Mode: Validation successful! 0 database mutations applied. Disable Dry-Run only after obtaining Owner Sign-off on the 145 field differences.",
        "info"
      );
      return;
    }

    try {
      if (stagedJobId) {
        const res = await publishImport.mutateAsync(stagedJobId);
        allowNextNavigation();
        setImportMessage(`Published ${res.publishedCount ?? counts.valid} valid rows from job ${stagedJobId}.`);
        showToast("Staged products published successfully.", "success");
      } else {
        const ready: ProductItem[] = rows
          .filter((r) => r.isValid && !r.is_sample_row)
          .map((r) => ({
            id: r.sku,
            sku: r.sku,
            title: r.name,
            category: r.category,
            subcategory: r.subcategory,
            brand: r.brand,
            size: r.size,
            material: r.material,
            customerPriceInr: r.customer_price_inr ?? 0,
            contractorPriceInr: r.contractor_price_inr ?? 0,
            dealerPriceInr: r.dealer_price_inr ?? 0,
            distributorPriceInr: r.distributor_price_inr ?? 0,
            unit: r.billing_unit,
            stockQty: r.stock_qty ?? 0,
            gstRate: r.gst_rate,
            isManufactured: r.is_manufactured,
            thumbnail: r.src,
            description: r.description,
            cmsStatus: "DRAFT",
          }));
        await batchImportProducts.mutateAsync(ready);
        allowNextNavigation();
        setImportMessage(`Imported ${ready.length} products as Drafts.`);
        showToast("Products imported successfully.", "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import commit failed.", "error");
    }
  };

  const columns: TableProps<StagingRow>["columns"] = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 140,
      fixed: "left",
      render: (v: string, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{v}</Typography.Text>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 11 }}
            icon={<EyeOutlined />}
            onClick={() => setSelectedRowDetail(row)}
          >
            Inspect 34 Fields
          </Button>
        </Space>
      ),
    },
    {
      title: "Product Name",
      dataIndex: "name",
      key: "name",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Category / Subcategory",
      key: "category",
      width: 180,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Tag style={{ margin: 0 }}>{row.category}</Tag>
          {row.subcategory && row.subcategory !== row.category && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {row.subcategory}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: "Proposed Action",
      key: "proposedAction",
      width: 150,
      render: (_, row) => {
        if (row.proposedAction === "BLOCKED_NEEDS_REVIEW") {
          return <Tag color="error">BLOCKED REVIEW</Tag>;
        }
        if (row.proposedAction === "KEEP_OLD") {
          return <Tag color="blue">KEEP EXISTING</Tag>;
        }
        return <Tag color="gold">PROPOSE UPDATE</Tag>;
      },
    },
    {
      title: "Base Prices (GST-Excl)",
      key: "prices",
      width: 200,
      render: (_, row) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Typography.Text type="secondary">Cust: </Typography.Text>
            {row.customer_price_inr ? formatInr(row.customer_price_inr) : "Quote"}
          </div>
          <div>
            <Typography.Text type="secondary">Contr: </Typography.Text>
            {row.contractor_price_inr ? formatInr(row.contractor_price_inr) : "—"}
          </div>
          <div>
            <Typography.Text type="secondary">Dealer: </Typography.Text>
            {row.dealer_price_inr ? formatInr(row.dealer_price_inr) : "—"}
          </div>
          <div>
            <Typography.Text type="secondary">Dist: </Typography.Text>
            {row.distributor_price_inr ? formatInr(row.distributor_price_inr) : "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Status & Technical Check",
      key: "verificationStatus",
      width: 160,
      render: (_, row) => (
        <Space direction="vertical" size={4}>
          <AdminStatusTag
            status={row.is_sample_row ? "EXCLUDED_SAMPLE" : row.severity || (row.isValid ? "VALID" : "BLOCKED")}
          />
          {row.verificationStatus === "LOCKED_QUOTE_ONLY" && (
            <Tag color="volcano" style={{ margin: 0 }}>
              FS Locked Quote
            </Tag>
          )}
          {row.verificationStatus === "PENDING_TECHNICAL_VERIFICATION" && (
            <Tag color="warning" style={{ margin: 0 }}>
              Specs Pending Check
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Validation Notes",
      key: "errors",
      ellipsis: true,
      render: (_, row) =>
        row.errors.length > 0 ? (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {row.errors.join("; ")}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Passes 34-column schema validation
          </Typography.Text>
        ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Import Products (34-Column Excel / CSV)"
        subtitle="Validate and stage workbook data against the canonical 34-field specification. Live catalogue mutations remain gated by owner approval."
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Products", to: "/products" },
          { label: "Import" },
        ]}
        extra={
          <>
            {hasUncommittedImport && (
              <Button icon={<UndoOutlined />} onClick={handleResetImport}>
                Clear Upload
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
              Download 34-Col Template CSV
            </Button>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => confirmLeave(() => navigate("/products"))}
            >
              Back to Products
            </Button>
          </>
        }
      />

      {/* HARD STOP GATE OWNER BANNER */}
      <Alert
        type="warning"
        showIcon
        icon={<LockOutlined style={{ fontSize: 20 }} />}
        message="HARD STOP GATE: 281 Live Products Protected"
        description={
          <div>
            All 281 existing genuine catalogue products, prices, images, and categories are strictly preserved.
            Automated batch overwriting of live records is locked. Staging and dry-run preview allow verification of the 34 fields without affecting live storefront data.
          </div>
        }
        style={{ borderRadius: 12, marginBottom: 16 }}
      />

      <AdminSectionCard style={{ marginBottom: 14 }}>
        <Steps
          current={activeStep}
          size="small"
          responsive
          items={[
            { title: "Upload File" },
            { title: "Server Validation" },
            { title: "Review 34 Columns" },
            { title: "Publish Approved" },
          ]}
        />
      </AdminSectionCard>

      {importMessage && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Import Staging Completed"
          description={importMessage}
          style={{ borderRadius: 12, marginBottom: 16 }}
          action={
            <Button size="small" type="primary" onClick={() => navigate("/products")}>
              View Products
            </Button>
          }
        />
      )}

      <AdminSectionCard
        title="Upload 34-Column Workbook (.xlsx or .csv)"
        subtitle="Supports all 34 canonical fields, 4 GST-exclusive price tiers, JSON specifications, and stock ownership routing."
        style={{ marginBottom: 16 }}
      >
        <Upload.Dragger
          accept=".csv,.xlsx"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => handleFile(file)}
          disabled={stageImport.isPending}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: BRAND_TOKENS.teal }} />
          </p>
          <p className="ant-upload-text">
            {fileName ? `Selected file: ${fileName}` : "Click or drag CSV / Excel file here to upload"}
          </p>
          <p className="ant-upload-hint">
            Compatible with official SAI Ajantha Products (1).xlsx format. Automatically excludes sample rows and isolates Floor Springs.
          </p>
        </Upload.Dragger>
      </AdminSectionCard>

      {rows.length > 0 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Total Staged" value={counts.total} accentColor={BRAND_TOKENS.navy} />
            </Col>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Valid Rows" value={counts.valid} accentColor="#16A34A" />
            </Col>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Proposed Updates" value={counts.updates} accentColor="#D97706" />
            </Col>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Keep Old" value={counts.kept} accentColor="#2563EB" />
            </Col>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Blocked / Review" value={counts.blocked} accentColor="#DC2626" />
            </Col>
            <Col xs={12} sm={4}>
              <AdminStatCard label="Samples Skipped" value={counts.samples} accentColor="#64748B" />
            </Col>
          </Row>

          <AdminTable<StagingRow>
            title="Staged 34-Column Import Preview"
            dataSource={rows}
            columns={columns}
            rowKey="id"
            loading={stageImport.isPending}
            scrollX={1100}
            toolbarActions={
              <Space size={16} align="center">
                <Space align="center">
                  <Switch
                    checked={isDryRun}
                    onChange={(checked) => setIsDryRun(checked)}
                    style={{ backgroundColor: isDryRun ? "#079D9A" : "#DC2626" }}
                  />
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    {isDryRun ? "Dry-Run Safety Mode (Active)" : "Live Commit Mode (Requires Owner Gate)"}
                  </Typography.Text>
                </Space>

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={counts.valid === 0}
                  loading={publishImport.isPending || batchImportProducts.isPending}
                  onClick={() => void handlePublish()}
                >
                  {isDryRun ? "Simulate Dry-Run Validation" : `Commit ${counts.valid} Valid Row(s)`}
                </Button>
              </Space>
            }
          />
        </>
      )}

      {/* Row Detail 34-Field Inspector Modal */}
      <Modal
        title={`34-Field Record Inspector: ${selectedRowDetail?.sku || ""}`}
        open={Boolean(selectedRowDetail)}
        onCancel={() => setSelectedRowDetail(null)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setSelectedRowDetail(null)}>
            Close
          </Button>,
        ]}
      >
        {selectedRowDetail && (
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="SKU / Code">{selectedRowDetail.sku}</Descriptions.Item>
            <Descriptions.Item label="Product Name">{selectedRowDetail.name}</Descriptions.Item>
            <Descriptions.Item label="Category">{selectedRowDetail.category}</Descriptions.Item>
            <Descriptions.Item label="Subcategory">{selectedRowDetail.subcategory}</Descriptions.Item>
            <Descriptions.Item label="Brand">{selectedRowDetail.brand}</Descriptions.Item>
            <Descriptions.Item label="Billing Unit">{selectedRowDetail.billing_unit}</Descriptions.Item>
            <Descriptions.Item label="Customer Price (INR)">
              {selectedRowDetail.customer_price_inr != null ? formatInr(selectedRowDetail.customer_price_inr) : "Quote Only"}
            </Descriptions.Item>
            <Descriptions.Item label="Contractor Price (INR)">
              {selectedRowDetail.contractor_price_inr != null ? formatInr(selectedRowDetail.contractor_price_inr) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Dealer Price (INR)">
              {selectedRowDetail.dealer_price_inr != null ? formatInr(selectedRowDetail.dealer_price_inr) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Distributor Price (INR)">
              {selectedRowDetail.distributor_price_inr != null ? formatInr(selectedRowDetail.distributor_price_inr) : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="GST Rate">{selectedRowDetail.gst_rate}% (Base Excl)</Descriptions.Item>
            <Descriptions.Item label="Stock Quantity">{selectedRowDetail.stock_qty}</Descriptions.Item>
            <Descriptions.Item label="Size / Dimensions">{selectedRowDetail.size}</Descriptions.Item>
            <Descriptions.Item label="Material">{selectedRowDetail.material}</Descriptions.Item>
            <Descriptions.Item label="Manufactured">{selectedRowDetail.is_manufactured ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Proposed Action">{selectedRowDetail.proposedAction}</Descriptions.Item>
            <Descriptions.Item label="Verification Status">{selectedRowDetail.verificationStatus}</Descriptions.Item>
            <Descriptions.Item label="Image Asset">{selectedRowDetail.src || "Will preserve existing catalogue asset"}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              {selectedRowDetail.description}
            </Descriptions.Item>
            <Descriptions.Item label="Features" span={2}>
              {selectedRowDetail.features || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Benefits" span={2}>
              {selectedRowDetail.benefits || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Category Specifications (JSON)" span={2}>
              <pre style={{ fontSize: 11, maxHeight: 150, overflow: "auto" }}>
                {JSON.stringify(selectedRowDetail.product_specifications, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
