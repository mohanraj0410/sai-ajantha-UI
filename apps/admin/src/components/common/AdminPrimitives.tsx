import React from "react";
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ClearOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../auth/AuthContext";
import type { StaffPermission } from "../../api/adminClient";

/* ==================== FORMATTERS ==================== */

export function formatInr(value: number | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return fallback;
  }
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null | undefined, includeTime = false): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/* ==================== COMPACT PAGE HEADER ==================== */

export interface BreadcrumbItemDef {
  label: string;
  to?: string;
}

export const AdminPageHeader: React.FC<{
  title: string;
  subtitle?: string;
  /** Kept optional for compatibility; route-driven AdminPathBreadcrumb now renders in the sticky topbar */
  breadcrumbs?: BreadcrumbItemDef[];
  extra?: React.ReactNode;
}> = ({ title, subtitle, extra }) => {
  return (
    <Flex
      justify="space-between"
      align="center"
      wrap="wrap"
      gap={10}
      style={{ marginBottom: 14 }}
    >
      <div style={{ minWidth: 0 }}>
        <Typography.Title
          level={3}
          style={{
            margin: 0,
            fontSize: "clamp(19px, 2vw, 23px)",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginTop: 2, fontSize: 12.5 }}
          >
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {extra && (
        <div className="sa-page-header-actions">
          <Space wrap size={8}>
            {extra}
          </Space>
        </div>
      )}
    </Flex>
  );
};

/* ==================== COMPACT SECTION CARD ==================== */

export const AdminSectionCard: React.FC<{
  title?: React.ReactNode;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({ title, subtitle, extra, children, noPadding = false, style, className }) => {
  const headerTitle =
    title && subtitle ? (
      <div style={{ padding: "2px 0" }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{title}</div>
        <Typography.Text type="secondary" style={{ fontSize: 11.5, fontWeight: 400 }}>
          {subtitle}
        </Typography.Text>
      </div>
    ) : (
      title
    );

  return (
    <Card
      bordered
      title={headerTitle}
      extra={extra}
      className={className}
      styles={{
        header: { minHeight: 44, padding: "8px 16px" },
        body: { padding: noPadding ? 0 : 16 },
      }}
      style={{
        borderRadius: 12,
        boxShadow: "0 1px 2px rgba(11, 31, 53, 0.04)",
        ...style,
      }}
    >
      {children}
    </Card>
  );
};

/* ==================== PREMIUM COMPACT KPI CARD ==================== */

export const AdminStatCard: React.FC<{
  loading?: boolean;
  unavailable?: boolean;
  label: string;
  value: React.ReactNode;
  helper?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  tag?: { text: string; color?: string };
  highlightTop?: boolean;
  onClick?: () => void;
}> = ({
  loading = false,
  unavailable = false,
  label,
  value,
  helper,
  icon,
  accentColor = "#079D9A",
  tag,
  highlightTop = false,
  onClick,
}) => {
  const { themeMode } = useAuth();
  const isDark = themeMode === "dark";
  const lowerAccent = accentColor.toLowerCase();
  const resolvedAccent =
    isDark && (lowerAccent === "#0b1f35" || lowerAccent === "#001c3f")
      ? "#38BDF8"
      : accentColor;

  return (
    <Card
      bordered
      className={onClick ? "sa-kpi-card" : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      styles={{ body: { padding: "14px 16px" } }}
      style={{
        borderRadius: 12,
        height: "100%",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 2px rgba(11, 31, 53, 0.04)",
        borderTop: highlightTop ? `3px solid ${resolvedAccent}` : undefined,
      }}
    >
      <Flex justify="space-between" align="flex-start" gap={10}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 4,
              lineHeight: 1.25,
            }}
          >
            {label}
          </Typography.Text>
          <div
            className="sa-num"
            style={{
              fontSize: "clamp(20px, 1.8vw, 25px)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {unavailable ? <span title="Data unavailable. Retry the failed request.">—</span> : loading ? <Skeleton.Input active size="small" style={{ width: 60, minWidth: 60 }} /> : value ?? "—"}
          </div>
        </div>
        {icon && (
          <div
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark ? `${resolvedAccent}24` : `${resolvedAccent}15`,
              color: resolvedAccent,
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </Flex>
      {(helper || tag) && (
        <Flex
          justify="space-between"
          align="center"
          gap={8}
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11.5, lineHeight: 1.3 }}
          >
            {helper || " "}
          </Typography.Text>
          {tag && (
            <Tag
              color={tag.color || "cyan"}
              style={{ margin: 0, fontWeight: 600, fontSize: 10.5, lineHeight: "18px", flexShrink: 0 }}
            >
              {tag.text}
            </Tag>
          )}
        </Flex>
      )}
    </Card>
  );
};

export const AdminKpiCard = AdminStatCard;

/* ==================== STATUS TAG ==================== */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  APPROVED: { label: "Approved", color: "success" },
  ACTIVE: { label: "Active", color: "success" },
  PENDING_APPROVAL: { label: "Pending Approval", color: "warning" },
  PENDING: { label: "Pending", color: "warning" },
  REJECTED: { label: "Rejected", color: "error" },
  SUSPENDED: { label: "Suspended", color: "error" },
  INACTIVE: { label: "Inactive", color: "default" },

  PLACED: { label: "Placed", color: "processing" },
  PROCESSING: { label: "Processing", color: "processing" },
  PACKED: { label: "Packed", color: "cyan" },
  DISPATCHED: { label: "Dispatched", color: "blue" },
  SHIPPED: { label: "Shipped", color: "blue" },
  DELIVERED: { label: "Delivered", color: "success" },
  INVOICED: { label: "Invoiced", color: "success" },
  CANCELLED: { label: "Cancelled", color: "error" },

  PAID: { label: "Paid", color: "success" },
  CAPTURED: { label: "Paid", color: "success" },
  UNPAID: { label: "Unpaid", color: "warning" },
  AWAITING_FINANCE_APPROVAL: { label: "Awaiting Finance", color: "gold" },
  UTR_SUBMITTED: { label: "UTR Submitted", color: "gold" },
  FAILED: { label: "Failed", color: "error" },
  REFUNDED: { label: "Refunded", color: "purple" },

  PUBLISHED: { label: "Published", color: "success" },
  DRAFT: { label: "Draft", color: "default" },
  REVIEW: { label: "In Review", color: "warning" },
  REVIEWED: { label: "Reviewed", color: "processing" },
  SHARED_NONPAYABLE: { label: "Shared", color: "cyan" },
  VALID: { label: "Valid", color: "success" },
  WARNING: { label: "Needs Check", color: "warning" },
  BLOCKED: { label: "Blocked", color: "error" },
  EXCLUDED_SAMPLE: { label: "Sample Skipped", color: "default" },

  NEW: { label: "New", color: "processing" },
  IN_REVIEW: { label: "In Review", color: "warning" },
  AWAITING_CUSTOMER_DETAILS: { label: "Awaiting Details", color: "orange" },
  AWAITING_SELLER: { label: "Awaiting Seller", color: "purple" },
  QUOTE_PREPARING: { label: "Quote Preparing", color: "blue" },
  QUOTED: { label: "Quote Sent", color: "cyan" },
  QUOTE_SENT: { label: "Quote Sent", color: "cyan" },
  QUOTE_ACCEPTED: { label: "Quote Accepted", color: "success" },
  CONVERTED_TO_ORDER: { label: "Converted to Order", color: "green" },
  REVISION_REQUESTED: { label: "Revision Requested", color: "volcano" },
  SENT: { label: "Sent", color: "processing" },
  ACCEPTED: { label: "Accepted", color: "success" },
  EXPIRED: { label: "Expired", color: "default" },
  ARCHIVED: { label: "Archived", color: "default" },
  CLOSED: { label: "Closed", color: "default" },

  SAI_AJANTHA: { label: "Sai Ajantha Direct", color: "geekblue" },
  SAI_AJANTA: { label: "Sai Ajantha Direct", color: "geekblue" },
  DIRECT: { label: "Sai Ajantha Direct", color: "geekblue" },
  DISTRIBUTOR: { label: "Distributor", color: "cyan" },
  HOUSE_OF_AJANTHA: { label: "House of Ajantha", color: "cyan" },
  ENQUIRY_ONLY: { label: "Quote Only", color: "orange" },
  QUOTE_ONLY: { label: "Quote Only", color: "orange" },

  NONE: { label: "No Return", color: "default" },
  REQUESTED: { label: "Requested", color: "warning" },
  RETURNED: { label: "Returned", color: "processing" },
  INSPECTED: { label: "Inspected", color: "success" },
};

export const AdminStatusTag: React.FC<{
  status: string | null | undefined;
  labelOverride?: string;
}> = ({ status, labelOverride }) => {
  const key = (status || "").toUpperCase().replace(/\s+/g, "_");
  const entry = STATUS_MAP[key];
  const label =
    labelOverride ||
    entry?.label ||
    (status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
  const color = entry?.color || "default";

  return (
    <Tag color={color} style={{ margin: 0, fontWeight: 600 }}>
      {label}
    </Tag>
  );
};

/* ==================== FILTER BAR ==================== */

export const AdminFilterBar: React.FC<{
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters,
  actions,
  hasActiveFilters,
  onClearFilters,
  onRefresh,
  refreshing,
}) => {
  return (
    <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 12 }}>
      <Flex align="center" wrap="wrap" gap={8} style={{ flex: "1 1 260px" }}>
        {onSearchChange && (
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#94A3B8" }} />}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ maxWidth: 280, minWidth: 180, flex: "1 1 190px" }}
          />
        )}
        {filters}
        {hasActiveFilters && onClearFilters && (
          <Button icon={<ClearOutlined />} onClick={onClearFilters}>
            Clear
          </Button>
        )}
      </Flex>
      <Space wrap size={8}>
        {onRefresh && (
          <Tooltip title="Refresh data">
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={onRefresh}
              loading={refreshing}
            >
              Refresh
            </Button>
          </Tooltip>
        )}
        {actions}
      </Space>
    </Flex>
  );
};

/* ==================== CONFIRM POPUP ==================== */

export const AdminConfirmAction: React.FC<{
  title: string;
  description?: string;
  okText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}> = ({ title, description, okText = "Confirm", danger = false, onConfirm, children }) => (
  <Popconfirm
    title={title}
    description={description}
    okText={okText}
    cancelText="Cancel"
    okButtonProps={{ danger }}
    onConfirm={onConfirm}
  >
    {children}
  </Popconfirm>
);

/* ==================== PERMISSION GATE ==================== */

export const AdminPermissionGate: React.FC<{
  permission?: StaffPermission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, fallback = null, children }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
