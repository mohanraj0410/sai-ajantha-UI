import React, { useMemo, useState } from "react";
import {
  Button,
  Alert,
  Card,
  Empty,
  Flex,
  Grid,
  Input,
  List,
  Pagination,
  Segmented,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  ClearOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { AdminErrorState } from "./AdminStateView";

const { useBreakpoint } = Grid;

export interface AdminTableProps<T extends object> {
  title?: string;
  subtitle?: string;
  dataSource: T[];
  columns: TableProps<T>["columns"];
  rowKey: TableProps<T>["rowKey"];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filterControls?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  exportFilename?: string;
  getExportRows?: () => Promise<T[]>;
  exportMapper?: (row: T) => Record<string, string | number | boolean | null | undefined>;
  scrollX?: number;
  defaultPageSize?: number;
  pagination?: TableProps<T>["pagination"];
  onChange?: TableProps<T>["onChange"];
  onRowClick?: (record: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  renderMobileItem?: (record: T) => React.ReactNode;
  showDensityToggle?: boolean;
  rowSelection?: TableProps<T>["rowSelection"];
}

function downloadCsv(
  rows: Record<string, string | number | boolean | null | undefined>[],
  filename: string
) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminTable<T extends object>({
  title,
  subtitle,
  dataSource,
  columns,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterControls,
  toolbarActions,
  hasActiveFilters,
  onClearFilters,
  onRefresh,
  refreshing,
  exportFilename,
  getExportRows,
  exportMapper,
  scrollX = 960,
  defaultPageSize = 10,
  pagination,
  onChange,
  onRowClick,
  emptyTitle = "No records yet",
  emptyDescription = "New records will appear here automatically.",
  emptyActionLabel,
  onEmptyAction,
  renderMobileItem,
  showDensityToggle = false,
  rowSelection,
}: AdminTableProps<T>) {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const [density, setDensity] = useState<"middle" | "small">("middle");
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const safeData = useMemo(() => (Array.isArray(dataSource) ? dataSource : []), [dataSource]);

  const handleExport = async () => {
    if (!exportFilename || !exportMapper || !safeData.length) return;
    setExporting(true);
    setExportError(null);
    try { downloadCsv((getExportRows ? await getExportRows() : safeData).map(exportMapper), exportFilename); }
    catch { setExportError("Export failed. Please retry."); }
    finally { setExporting(false); }
  };

  const resolvedPagination: TableProps<T>["pagination"] =
    pagination === false || safeData.length === 0
      ? false
      : {
          current: Math.min(currentPage, Math.max(1, Math.ceil(safeData.length / pageSize))),
          pageSize,
          total: safeData.length,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) setPageSize(size);
          },
          size: isMobile ? "small" : "default",
          ...pagination,
        };

  const renderSmartEmpty = () => {
    const isFilteredEmpty = Boolean(hasActiveFilters);
    return (
      <div style={{ padding: "14px 8px" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          imageStyle={{ height: 36, marginBottom: 6 }}
          description={
            <Space direction="vertical" size={2}>
              <Typography.Text strong style={{ fontSize: 13.5 }}>
                {isFilteredEmpty ? "No matching records" : emptyTitle}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {isFilteredEmpty
                  ? "Clear or adjust your search and filter choices."
                  : emptyDescription}
              </Typography.Text>
            </Space>
          }
        >
          {isFilteredEmpty && onClearFilters ? (
            <Button size="small" icon={<ClearOutlined />} onClick={onClearFilters}>
              Clear Filters
            </Button>
          ) : emptyActionLabel && onEmptyAction ? (
            <Button size="small" type="primary" onClick={onEmptyAction}>
              {emptyActionLabel}
            </Button>
          ) : null}
        </Empty>
      </div>
    );
  };

  return (
    <Card
      bordered
      className="sa-table-card"
      styles={{ body: { padding: isMobile ? 12 : 16 } }}
      style={{
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(11, 31, 53, 0.04)",
      }}
    >
      {exportError && <Alert type="error" message={exportError} closable onClose={() => setExportError(null)} />}
      {/* Unified Compact Header & Toolbar Row */}
      {(title || subtitle || toolbarActions || showDensityToggle || exportFilename || onRefresh) && (
        <Flex
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={10}
          style={{ marginBottom: 12 }}
        >
          <div>
            {title && (
              <Space align="center" size={8}>
                <Typography.Text strong style={{ fontSize: 14.5 }}>
                  {title}
                </Typography.Text>
                <Tag color="cyan" className="sa-num" style={{ margin: 0, fontWeight: 700 }}>
                  {error ? "—" : loading ? <Skeleton.Input active size="small" style={{ width: 24, minWidth: 24, height: 14 }} /> : new Intl.NumberFormat("en-IN").format(pagination && typeof pagination === "object" ? pagination.total ?? safeData.length : safeData.length)}
                </Tag>
              </Space>
            )}
            {subtitle && (
              <Typography.Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 1 }}>
                {subtitle}
              </Typography.Text>
            )}
          </div>
          <Space wrap size={8}>
            {showDensityToggle && !isMobile && safeData.length > 0 && (
              <Segmented
                size="small"
                value={density}
                onChange={(v) => setDensity(v as "middle" | "small")}
                options={[
                  { label: "Comfortable", value: "middle" },
                  { label: "Compact", value: "small" },
                ]}
              />
            )}
            {exportFilename && exportMapper && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={!safeData.length}
                onClick={() => void handleExport()}
                loading={exporting}
              >
                Export CSV
              </Button>
            )}
            {onRefresh && (
              <Tooltip title="Refresh">
                <Button
                  size="small"
                  icon={<ReloadOutlined spin={refreshing} />}
                  onClick={onRefresh}
                  loading={refreshing}
                >
                  {isMobile ? "" : "Refresh"}
                </Button>
              </Tooltip>
            )}
            {toolbarActions}
          </Space>
        </Flex>
      )}

      {/* Search & Filter Row (Strictly outside horizontal table scroll) */}
      {(onSearchChange || filterControls) && (
        <Flex align="center" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
          {onSearchChange && (
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
              value={searchValue}
              onChange={(e) => {
                setCurrentPage(1);
                onSearchChange(e.target.value);
              }}
              placeholder={searchPlaceholder}
              style={{ maxWidth: isMobile ? "100%" : 280, flex: "1 1 190px" }}
            />
          )}
          {filterControls}
          {hasActiveFilters && onClearFilters && (
            <Button
              icon={<ClearOutlined />}
              onClick={() => {
                setCurrentPage(1);
                onClearFilters();
              }}
            >
              Clear
            </Button>
          )}
        </Flex>
      )}

      {/* Error State / Mobile Cards / Desktop Table */}
      {error ? (
        <AdminErrorState message={error} onRetry={onRetry} />
      ) : isMobile && renderMobileItem ? (
        <List
          loading={loading}
          dataSource={pagination === false || (pagination && typeof pagination === "object") ? safeData : safeData.slice((Math.min(currentPage, Math.max(1, Math.ceil(safeData.length / pageSize))) - 1) * pageSize, Math.min(currentPage, Math.max(1, Math.ceil(safeData.length / pageSize))) * pageSize)}
          pagination={false}
          locale={{ emptyText: renderSmartEmpty() }}
          renderItem={(item) => (
            <List.Item style={{ padding: "6px 0", borderBlockEnd: "none" }}>
              <div style={{ width: "100%" }}>{renderMobileItem(item)}</div>
            </List.Item>
          )}
        />
      ) : (
        <Table<T>
          dataSource={safeData}
          columns={columns}
          rowKey={rowKey}
          loading={loading}
          size={density}
          scroll={{ x: scrollX }}
          pagination={resolvedPagination}
          onChange={onChange}
          rowSelection={rowSelection}
          onRow={
            onRowClick
              ? (record) => ({
                  onClick: () => onRowClick(record),
                  style: { cursor: "pointer" },
                })
              : undefined
          }
          locale={{ emptyText: renderSmartEmpty() }}
        />
      )}
      {isMobile && renderMobileItem && resolvedPagination && <Pagination {...resolvedPagination} style={{ marginTop: 12 }} />}
    </Card>
  );
}
