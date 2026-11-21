import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  theme,
} from "antd";
import type { TableProps } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PlusOutlined,
  SendOutlined,
  ShoppingOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "../auth/AuthContext";
import {
  useAdminMutations,
  useEnquiriesData,
  useEnquiryDetail,
} from "../api/adminQueries";
import type {
  PortalEnquiryRow,
  TradeQuoteDto,
} from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatDate,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";

const ENQUIRY_STATUS_OPTIONS = [
  { label: "All Statuses", value: "ALL" },
  { label: "New", value: "NEW" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Awaiting Details", value: "AWAITING_CUSTOMER_DETAILS" },
  { label: "Awaiting Seller", value: "AWAITING_SELLER" },
  { label: "Quote Preparing", value: "QUOTE_PREPARING" },
  { label: "Quote Sent", value: "QUOTED" },
  { label: "Quote Accepted", value: "QUOTE_ACCEPTED" },
  { label: "Converted to Order", value: "CONVERTED_TO_ORDER" },
  { label: "Closed", value: "CLOSED" },
] as const;

export const EnquiriesPage: React.FC = () => {
  const { token } = theme.useToken();
  const { enquiryId: paramEnquiryId } = useParams();
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useAdminToast();

  const {
    executeEnquiryAction,
    createTradeQuote,
    updateTradeQuote,
    convertQuoteToOrder,
  } = useAdminMutations();

  // Filters state
  const [searchText, setSearchText] = useState("");
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>("ALL");
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>("ALL");
  const [selectedLeadType, setSelectedLeadType] = useState<string>("ALL");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("ALL");

  // Selection & Details state
  const [selectedId, setSelectedId] = useState<string | null>(paramEnquiryId || null);

  // Modals state
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(false);
  const [assignSellerOpen, setAssignSellerOpen] = useState(false);
  const [assignStaffOpen, setAssignStaffOpen] = useState(false);
  const [scheduleFollowUpOpen, setScheduleFollowUpOpen] = useState(false);
  const [closeEnquiryOpen, setCloseEnquiryOpen] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [assignContractorOpen, setAssignContractorOpen] = useState(false);

  // Forms
  const [detailsForm] = Form.useForm();
  const [sellerForm] = Form.useForm();
  const [staffForm] = Form.useForm();
  const [followUpForm] = Form.useForm();
  const [closeForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [contractorForm] = Form.useForm();

  // Fetch enquiries with filters
  const enquiriesQuery = useEnquiriesData(staff?.email || "anon", true);
  const allEnquiries = enquiriesQuery.data?.enquiries || [];
  const rawCounts = enquiriesQuery.data?.counts || {
    total: allEnquiries.length,
    new: allEnquiries.filter((e) => e.status === "NEW").length,
    in_review: allEnquiries.filter((e) => e.status === "IN_REVIEW").length,
    awaiting_details: allEnquiries.filter((e) => e.status === "AWAITING_CUSTOMER_DETAILS").length,
    awaiting_seller: allEnquiries.filter((e) => e.status === "AWAITING_SELLER").length,
    quote_preparing: allEnquiries.filter((e) => e.status === "QUOTE_PREPARING").length,
    quoted: allEnquiries.filter((e) => e.status === "QUOTED").length,
    quote_accepted: allEnquiries.filter((e) => e.status === "QUOTE_ACCEPTED").length,
    converted_order: allEnquiries.filter((e) => e.status === "CONVERTED_TO_ORDER").length,
    closed: allEnquiries.filter((e) => e.status === "CLOSED").length,
    install: allEnquiries.filter((e) => (e.lead_type === "INSTALLATION" || (e.source || "").includes("install") || (e.division || "").toLowerCase().includes("install"))).length,
    product_quote: allEnquiries.filter((e) => !(e.lead_type === "INSTALLATION" || (e.source || "").includes("install") || (e.division || "").toLowerCase().includes("install"))).length,
  };

  // Detailed single enquiry query
  const detailQuery = useEnquiryDetail(staff?.email || "anon", selectedId || undefined);
  const detailData = detailQuery.data;
  const activeEnquiry = detailData?.enquiry || allEnquiries.find((e) => e.id === selectedId);

  // Filter table data
  const filteredEnquiries = useMemo(() => {
    return allEnquiries.filter((row) => {
      // Status filter
      if (selectedStatusTab !== "ALL" && row.status !== selectedStatusTab) {
        return false;
      }
      // Customer type
      if (selectedCustomerType !== "ALL" && row.role !== selectedCustomerType) {
        return false;
      }
      // Seller
      if (selectedSellerFilter !== "ALL") {
        if (selectedSellerFilter === "SAI_AJANTHA") {
          const isDirect =
            row.assigned_seller_id === "SAI_AJANTHA_CENTRAL" ||
            (row.assigned_seller_name || "").includes("Sai Ajantha");
          if (!isDirect) return false;
        } else if (selectedSellerFilter === "DISTRIBUTOR") {
          const isDist =
            row.assigned_seller_id &&
            row.assigned_seller_id !== "SAI_AJANTHA_CENTRAL";
          if (!isDist) return false;
        } else if (selectedSellerFilter === "AWAITING_SELLER") {
          if (row.status !== "AWAITING_SELLER" && row.assigned_seller_id) return false;
        }
      }
      // Lead Type
      const isInstall =
        row.lead_type === "INSTALLATION" ||
        (row.source || "").includes("install") ||
        (row.division || "").toLowerCase().includes("install");
      if (selectedLeadType === "INSTALL" && !isInstall) return false;
      if (selectedLeadType === "PRODUCT" && isInstall) return false;

      // Staff filter
      if (selectedStaffFilter !== "ALL" && row.assigned_staff_email !== selectedStaffFilter) {
        return false;
      }

      // Search text
      if (searchText.trim()) {
        const q = searchText.toLowerCase().trim();
        const str = `${row.name} ${row.phone} ${row.email} ${row.city || ""} ${row.postal_code || ""} ${row.division} ${row.notes || ""} ${row.assigned_seller_name || ""} ${row.assigned_staff_email || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [
    allEnquiries,
    selectedStatusTab,
    selectedCustomerType,
    selectedSellerFilter,
    selectedLeadType,
    selectedStaffFilter,
    searchText,
  ]);

  // Handlers for Admin Actions
  const handleStartReview = async () => {
    if (!activeEnquiry) return;
    try {
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: { action: "START_REVIEW" },
      });
      showToast("Review initiated. Status set to IN REVIEW.", "success");
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to start review", "error");
    }
  };

  const handleRequestDetailsSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "REQUEST_DETAILS",
          message: values.message.trim(),
          notes: values.notes?.trim(),
        },
      });
      showToast("Requested additional details. Enquiry set to AWAITING CUSTOMER DETAILS.", "success");
      setRequestDetailsOpen(false);
      detailsForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to request details", "error");
    }
  };

  const handleAssignSellerSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      const selectedSellerId = values.sellerId;
      let sName = "Sai Ajantha Central Warehouse";
      let sType = "DIRECT";

      if (selectedSellerId === "SAI_AJANTHA_CENTRAL") {
        sName = "Sai Ajantha Central Warehouse";
        sType = "DIRECT";
      } else if (selectedSellerId === "SAI_AJANTHA_ENQUIRY") {
        sName = "Sai Ajantha Central (Enquiry Only)";
        sType = "DIRECT_ENQUIRY";
      } else if (selectedSellerId === "UNSERVED") {
        selectedSellerId === null;
      } else {
        const found = detailData?.distributors?.find((d) => d.id === selectedSellerId);
        sName = found?.name || "Authorized Territory Distributor";
        sType = "DISTRIBUTOR";
      }

      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "ASSIGN_SELLER",
          seller_id: selectedSellerId === "UNSERVED" ? "" : selectedSellerId,
          seller_name: selectedSellerId === "UNSERVED" ? "" : sName,
          seller_type: selectedSellerId === "UNSERVED" ? "" : sType,
          notes: values.notes,
        },
      });
      showToast("Seller routing successfully updated.", "success");
      setAssignSellerOpen(false);
      sellerForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign seller", "error");
    }
  };

  const handleAssignStaffSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      const staffMember = detailData?.availableStaff?.find((s) => s.email === values.staffEmail);
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "ASSIGN_STAFF",
          staff_id: staffMember?.id || "",
          staff_email: values.staffEmail,
        },
      });
      showToast(`Assigned to ${values.staffEmail}.`, "success");
      setAssignStaffOpen(false);
      staffForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign staff", "error");
    }
  };

  const handleAssignContractorSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      const contractor = detailData?.contractors?.find((c) => c.id === values.contractorId);
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "ASSIGN_CONTRACTOR",
          contractor_id: values.contractorId,
          contractor_name: contractor?.name || "Verified Local Contractor",
        },
      });
      showToast(`Verified contractor assigned for installation lead.`, "success");
      setAssignContractorOpen(false);
      contractorForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to assign contractor", "error");
    }
  };

  const handleScheduleFollowUpSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "SCHEDULE_FOLLOW_UP",
          follow_up_date: values.followUpDate.toISOString(),
          notes: values.notes,
        },
      });
      showToast("Follow-up scheduled successfully.", "success");
      setScheduleFollowUpOpen(false);
      followUpForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to schedule follow-up", "error");
    }
  };

  const handleCloseEnquirySubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      await executeEnquiryAction.mutateAsync({
        enquiryId: activeEnquiry.id,
        payload: {
          action: "CLOSE",
          closure_reason: values.reason,
          notes: values.notes,
        },
      });
      showToast("Enquiry closed with recorded justification.", "success");
      setCloseEnquiryOpen(false);
      closeForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to close enquiry", "error");
    }
  };

  // Open Create Quotation Modal pre-filled
  const handleOpenCreateQuote = () => {
    if (!activeEnquiry) return;
    const isInstall =
      activeEnquiry.lead_type === "INSTALLATION" ||
      (activeEnquiry.source || "").includes("install") ||
      (activeEnquiry.division || "").toLowerCase().includes("install");

    const defaultSku =
      Array.isArray(activeEnquiry.items) && activeEnquiry.items[0]?.sku
        ? activeEnquiry.items[0].sku
        : isInstall
        ? "SA-SVC-INSTALL"
        : "SA-PROD-QUOTE";

    const defaultName =
      Array.isArray(activeEnquiry.items) && activeEnquiry.items[0]?.name
        ? activeEnquiry.items[0].name
        : isInstall
        ? `Installation Service: ${activeEnquiry.division || "Hardware Fitting"}`
        : `${activeEnquiry.division || "Hardware Quotation Package"}`;

    const defaultQty =
      Array.isArray(activeEnquiry.items) && activeEnquiry.items[0]?.quantity
        ? Number(activeEnquiry.items[0].quantity)
        : 1;

    const defaultPrice =
      Array.isArray(activeEnquiry.items) && (activeEnquiry.items[0] as any)?.unitPriceInr
        ? Number((activeEnquiry.items[0] as any).unitPriceInr)
        : isInstall
        ? 1500
        : 2500;

    quoteForm.setFieldsValue({
      customerName: activeEnquiry.name,
      customerEmail: activeEnquiry.email || "",
      customerPhone: activeEnquiry.phone || "",
      postalCode: activeEnquiry.postal_code || "",
      organization: activeEnquiry.organization || "",
      division: activeEnquiry.division || "General Quotation",
      sku: defaultSku,
      itemName: defaultName,
      quantity: defaultQty,
      unitPriceInr: defaultPrice,
      validDays: 15,
      sellerId: activeEnquiry.assigned_seller_id || "SAI_AJANTHA_CENTRAL",
      sellerName: activeEnquiry.assigned_seller_name || "Sai Ajantha Central Warehouse",
      sellerType: activeEnquiry.assigned_seller_type || "DIRECT",
      isServiceQuote: isInstall,
      contractorId: activeEnquiry.contractor_id || undefined,
      contractorName: activeEnquiry.contractor_name || undefined,
      customerNotes: isInstall
        ? "Separate contractor installation quotation. Fitting charges are billed separately from product supply."
        : "Formal quotation valid for 15 days.",
      internalNotes: `Prepared for enquiry ${activeEnquiry.id}`,
    });

    setCreateQuoteOpen(true);
  };

  const handleCreateQuoteSubmit = async (values: any) => {
    if (!activeEnquiry) return;
    try {
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + (Number(values.validDays) || 15));

      const payload = {
        enquiry_id: activeEnquiry.id,
        customer_name: values.customerName.trim(),
        customer_email: values.customerEmail?.trim() || "",
        customer_phone: values.customerPhone?.trim() || "",
        postal_code: values.postalCode?.trim() || "",
        organization: values.organization?.trim() || "",
        division: values.division || "General Quotation",
        valid_until: validUntilDate.toISOString(),
        status: values.sendImmediately ? "SHARED_NONPAYABLE" : "DRAFT",
        seller_id: values.sellerId || activeEnquiry.assigned_seller_id || "SAI_AJANTHA_CENTRAL",
        seller_name: values.sellerName || activeEnquiry.assigned_seller_name || "Sai Ajantha Central Warehouse",
        seller_type: values.sellerType || activeEnquiry.assigned_seller_type || "DIRECT",
        is_service_quote: Boolean(values.isServiceQuote),
        contractor_id: values.contractorId || null,
        contractor_name: values.contractorName || null,
        items: [
          {
            sku: values.sku.trim(),
            name: values.itemName.trim(),
            quantity: Number(values.quantity || 1),
            unitPriceInr: Number(values.unitPriceInr || 0),
            gstRate:
              values.gstRate !== undefined && values.gstRate !== null && values.gstRate !== ""
                ? Number(values.gstRate)
                : undefined,
          },
        ],
        customer_notes: values.customerNotes || "",
        internal_notes: values.internalNotes || "",
      };

      await createTradeQuote.mutateAsync(payload as any);
      showToast(
        values.sendImmediately
          ? "Quotation issued to customer. Enquiry updated to QUOTED."
          : "Draft quotation created. Enquiry updated to QUOTE PREPARING.",
        "success"
      );
      setCreateQuoteOpen(false);
      quoteForm.resetFields();
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create quotation", "error");
    }
  };

  // Convert Quote to Order
  const handleConvertQuote = async (quote: TradeQuoteDto) => {
    try {
      const res = await convertQuoteToOrder.mutateAsync(quote.id);
      showToast(
        `Quotation ${quote.quote_number} converted to Trade Order ${res.orderNumber}!`,
        "success"
      );
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not convert quote to order", "error");
    }
  };

  // Issue/Send draft quotation
  const handleSendQuote = async (quote: TradeQuoteDto) => {
    try {
      await updateTradeQuote.mutateAsync({
        quoteId: quote.id,
        payload: {
          status: "SHARED_NONPAYABLE",
          revision_note: "Quotation issued and sent to customer",
        },
      });
      showToast(`Quotation ${quote.quote_number} issued. Enquiry updated to QUOTED.`, "success");
      detailQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not issue quotation", "error");
    }
  };

  // Table Columns
  const columns: TableProps<PortalEnquiryRow>["columns"] = [
    {
      title: "Customer & Contact",
      key: "customer",
      width: 220,
      render: (_, row) => (
        <div>
          <Flex align="center" gap={6}>
            <Typography.Text strong>{row.name}</Typography.Text>
            {row.role && row.role !== "Retail / Individual" && (
              <Tag color="cyan" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                {row.role}
              </Tag>
            )}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
            <PhoneOutlined style={{ marginRight: 4 }} />
            {row.phone}
          </Typography.Text>
          {row.city && (
            <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              {row.city} {row.postal_code ? `• PIN ${row.postal_code}` : ""}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: "Category / Specification",
      dataIndex: "division",
      key: "division",
      width: 220,
      ellipsis: true,
      render: (v: string, row) => {
        const isInstall =
          row.lead_type === "INSTALLATION" ||
          (row.source || "").includes("install") ||
          (v || "").toLowerCase().includes("install");
        return (
          <Space direction="vertical" size={2}>
            <Space size={6}>
              {isInstall ? (
                <Tag color="orange" icon={<ToolOutlined />} style={{ margin: 0, fontWeight: 600 }}>
                  Installation
                </Tag>
              ) : (
                <Tag color="blue" icon={<FileProtectOutlined />} style={{ margin: 0, fontWeight: 600 }}>
                  Product Quote
                </Tag>
              )}
            </Space>
            <Typography.Text ellipsis={{ tooltip: v }} style={{ fontSize: 12.5 }}>
              {v || "General Hardware"}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: "Responsible Seller",
      key: "seller",
      width: 190,
      render: (_, row) => {
        if (row.status === "AWAITING_SELLER" || !row.assigned_seller_id) {
          return (
            <Tag color="purple" style={{ fontWeight: 600 }}>
              Awaiting Seller
            </Tag>
          );
        }
        const isDirect =
          row.assigned_seller_id === "SAI_AJANTHA_CENTRAL" ||
          (row.assigned_seller_name || "").includes("Sai Ajantha");
        return (
          <div>
            <Typography.Text style={{ fontSize: 12, fontWeight: 600, display: "block" }}>
              {row.assigned_seller_name || "Sai Ajantha Central"}
            </Typography.Text>
            <Tag color={isDirect ? "geekblue" : "cyan"} style={{ fontSize: 10, margin: 0 }}>
              {isDirect ? "Central Warehouse" : "Distributor Route"}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 170,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Assigned Staff",
      dataIndex: "assigned_staff_email",
      key: "staff",
      width: 170,
      ellipsis: true,
      render: (v: string | null) => (
        <Typography.Text type={v ? undefined : "secondary"} style={{ fontSize: 12 }}>
          {v || "Unassigned"}
        </Typography.Text>
      ),
    },
    {
      title: "Received Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (v: string) => (
        <Typography.Text style={{ fontSize: 12 }}>{formatDate(v)}</Typography.Text>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 100,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          style={{ background: BRAND_TOKENS.navy, borderColor: BRAND_TOKENS.navy }}
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(row.id);
          }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Enquiry & Quotation Management"
        subtitle="End-to-end CRM workflow: Enquiry Review → Seller Routing → Quotation Creation → Customer Response → Order Conversion."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Enquiries" }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: BRAND_TOKENS.teal, borderColor: BRAND_TOKENS.teal }}
            onClick={() => navigate("/quotes")}
          >
            Create Independent Quote
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ borderRadius: 10, marginBottom: 16 }}
        message="Strict Commercial Fulfillment & Installation Policy"
        description="Sai Ajantha Central fulfills 9 direct categories. Door Closers and Kitchen Baskets route to authorized territory distributors based on delivery PIN code. Floor Springs are enquiry-only. Independent contractor installation requests are quoted and billed separately from product orders."
      />

      {/* Actual Persisted Record Counts Bar */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Total Enquiries"
            value={rawCounts.total}
            icon={<CustomerServiceOutlined />}
            accentColor={BRAND_TOKENS.navy}
            highlightTop
            onClick={() => setSelectedStatusTab("ALL")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="New Enquiries"
            value={rawCounts.new}
            icon={<ClockCircleOutlined />}
            accentColor="#2563EB"
            highlightTop
            onClick={() => setSelectedStatusTab("NEW")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Under Review"
            value={rawCounts.in_review}
            icon={<FileTextOutlined />}
            accentColor="#D97706"
            highlightTop
            onClick={() => setSelectedStatusTab("IN_REVIEW")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Awaiting Seller"
            value={rawCounts.awaiting_seller}
            icon={<ExclamationCircleOutlined />}
            accentColor="#7C3AED"
            highlightTop
            onClick={() => setSelectedStatusTab("AWAITING_SELLER")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Quote Preparing"
            value={rawCounts.quote_preparing}
            icon={<FileProtectOutlined />}
            accentColor="#0284C7"
            highlightTop
            onClick={() => setSelectedStatusTab("QUOTE_PREPARING")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Quote Sent"
            value={rawCounts.quoted}
            icon={<SendOutlined />}
            accentColor="#0D9488"
            highlightTop
            onClick={() => setSelectedStatusTab("QUOTED")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Quote Accepted"
            value={rawCounts.quote_accepted}
            icon={<CheckCircleOutlined />}
            accentColor="#16A34A"
            highlightTop
            onClick={() => setSelectedStatusTab("QUOTE_ACCEPTED")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Converted to Order"
            value={rawCounts.converted_order}
            icon={<ShoppingOutlined />}
            accentColor="#059669"
            highlightTop
            onClick={() => setSelectedStatusTab("CONVERTED_TO_ORDER")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Installation Leads"
            value={rawCounts.install}
            icon={<ToolOutlined />}
            accentColor="#EA580C"
            highlightTop
            onClick={() => setSelectedLeadType("INSTALL")}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={2.4}>
          <AdminStatCard
            label="Closed"
            value={rawCounts.closed}
            icon={<FileDoneOutlined />}
            accentColor="#64748B"
            highlightTop
            onClick={() => setSelectedStatusTab("CLOSED")}
          />
        </Col>
      </Row>

      {/* Advanced Filter Bar */}
      <Card
        size="small"
        bordered
        style={{ borderRadius: 12, marginBottom: 14, background: token.colorFillAlter }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Status Filter
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={selectedStatusTab}
              onChange={setSelectedStatusTab}
              options={ENQUIRY_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Customer Role
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={selectedCustomerType}
              onChange={setSelectedCustomerType}
              options={[
                { label: "All Customer Types", value: "ALL" },
                { label: "Retail / Individual", value: "Retail / Individual" },
                { label: "Dealer / Contractor", value: "DEALER" },
                { label: "Distributor", value: "DISTRIBUTOR" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Fulfillment Seller
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={selectedSellerFilter}
              onChange={setSelectedSellerFilter}
              options={[
                { label: "All Sellers", value: "ALL" },
                { label: "Sai Ajantha Central", value: "SAI_AJANTHA" },
                { label: "Distributor Resale", value: "DISTRIBUTOR" },
                { label: "Awaiting Seller", value: "AWAITING_SELLER" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Lead Workflow
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={selectedLeadType}
              onChange={setSelectedLeadType}
              options={[
                { label: "All Enquiries", value: "ALL" },
                { label: "Product Quotations", value: "PRODUCT" },
                { label: "Installation Requests", value: "INSTALL" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Typography.Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Assigned Staff
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              value={selectedStaffFilter}
              onChange={setSelectedStaffFilter}
              options={[
                { label: "All Staff Members", value: "ALL" },
                ...(detailData?.availableStaff || []).map((s) => ({
                  label: s.first_name ? `${s.first_name} (${s.email})` : s.email,
                  value: s.email,
                })),
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Enquiries Data Table */}
      <AdminTable<PortalEnquiryRow>
        title="Enquiry Queue"
        dataSource={filteredEnquiries}
        columns={columns}
        rowKey="id"
        loading={enquiriesQuery.isLoading}
        error={enquiriesQuery.isError ? "Failed to load enquiries." : null}
        onRetry={() => void enquiriesQuery.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search customer name, phone, city, PIN, division, notes, SKU, seller..."
        hasActiveFilters={
          Boolean(searchText) ||
          selectedStatusTab !== "ALL" ||
          selectedCustomerType !== "ALL" ||
          selectedSellerFilter !== "ALL" ||
          selectedLeadType !== "ALL" ||
          selectedStaffFilter !== "ALL"
        }
        onClearFilters={() => {
          setSearchText("");
          setSelectedStatusTab("ALL");
          setSelectedCustomerType("ALL");
          setSelectedSellerFilter("ALL");
          setSelectedLeadType("ALL");
          setSelectedStaffFilter("ALL");
        }}
        emptyTitle="No enquiries match your filter criteria"
        emptyDescription="Customer inquiries, quote leads, and installation requests will appear in this queue."
        onRefresh={() => void enquiriesQuery.refetch()}
        refreshing={enquiriesQuery.isFetching}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      {/* FULL FUNCTIONAL ENQUIRY DETAILS DRAWER */}
      <Drawer
        open={Boolean(selectedId)}
        onClose={() => {
          setSelectedId(null);
          if (paramEnquiryId) navigate("/enquiries");
        }}
        title={
          activeEnquiry ? (
            <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
              <Space align="center" size={10}>
                <Typography.Title level={4} style={{ margin: 0, color: BRAND_TOKENS.navy }}>
                  Enquiry #{activeEnquiry.id}
                </Typography.Title>
                <AdminStatusTag status={activeEnquiry.status} />
                {activeEnquiry.lead_type === "INSTALLATION" ||
                (activeEnquiry.source || "").includes("install") ||
                (activeEnquiry.division || "").toLowerCase().includes("install") ? (
                  <Tag color="orange" icon={<ToolOutlined />} style={{ fontWeight: 600 }}>
                    Separate Installation Lead
                  </Tag>
                ) : (
                  <Tag color="blue" icon={<FileProtectOutlined />} style={{ fontWeight: 600 }}>
                    Product Quotation Lead
                  </Tag>
                )}
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Received {formatDate(activeEnquiry.created_at, true)}
              </Typography.Text>
            </Flex>
          ) : (
            "Enquiry Details"
          )
        }
        width={760}
      >
        {activeEnquiry && (
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            {/* ACTION TOOLBAR AT TOP */}
            <Card size="small" style={{ borderRadius: 10, background: "#F0FDF4", borderColor: "#BBF7D0" }}>
              <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                <Space wrap size={8}>
                  {activeEnquiry.status === "NEW" && (
                    <Button
                      type="primary"
                      style={{ background: "#2563EB", borderColor: "#2563EB" }}
                      onClick={handleStartReview}
                    >
                      Start Review
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      detailsForm.resetFields();
                      setRequestDetailsOpen(true);
                    }}
                  >
                    Request Details
                  </Button>
                  <Button
                    onClick={() => {
                      sellerForm.resetFields();
                      setAssignSellerOpen(true);
                    }}
                  >
                    Assign Seller
                  </Button>
                  <Button
                    onClick={() => {
                      staffForm.resetFields();
                      setAssignStaffOpen(true);
                    }}
                  >
                    Assign Staff
                  </Button>
                  <Button
                    onClick={() => {
                      followUpForm.resetFields();
                      setScheduleFollowUpOpen(true);
                    }}
                  >
                    Schedule Follow-up
                  </Button>
                  {activeEnquiry.lead_type === "INSTALLATION" && (
                    <Button
                      style={{ borderColor: "#EA580C", color: "#EA580C" }}
                      onClick={() => {
                        contractorForm.resetFields();
                        setAssignContractorOpen(true);
                      }}
                    >
                      Assign Contractor
                    </Button>
                  )}
                  <Button
                    danger
                    onClick={() => {
                      closeForm.resetFields();
                      setCloseEnquiryOpen(true);
                    }}
                  >
                    Close Enquiry
                  </Button>
                </Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ background: BRAND_TOKENS.teal, borderColor: BRAND_TOKENS.teal }}
                  onClick={handleOpenCreateQuote}
                >
                  Create Quotation
                </Button>
              </Flex>
            </Card>

            {/* CUSTOMER & DEALER IDENTITY */}
            <Card size="small" title="Customer Identity & Contact Information" bordered style={{ borderRadius: 10 }}>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                <Descriptions.Item label="Contact Name">
                  <strong>{activeEnquiry.name}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Role / Tier">
                  <Tag color="cyan">{activeEnquiry.role || "Retail / Individual"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Organization">
                  {activeEnquiry.organization || "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Mobile Number">
                  <a href={`tel:${activeEnquiry.phone}`}>{activeEnquiry.phone}</a>
                </Descriptions.Item>
                <Descriptions.Item label="Email Address">
                  {activeEnquiry.email ? <a href={`mailto:${activeEnquiry.email}`}>{activeEnquiry.email}</a> : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery City">
                  {activeEnquiry.city || "Trichy"}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery PIN Code">
                  <Tag color={activeEnquiry.postal_code ? "geekblue" : "default"}>
                    {activeEnquiry.postal_code ? `PIN: ${activeEnquiry.postal_code}` : "Not Provided"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Lead Source">
                  {activeEnquiry.source || "storefront"}
                </Descriptions.Item>
                <Descriptions.Item label="Follow-up Date">
                  {activeEnquiry.follow_up_date ? (
                    <span style={{ color: "#D97706", fontWeight: 600 }}>
                      <CalendarOutlined style={{ marginRight: 4 }} />
                      {formatDate(activeEnquiry.follow_up_date, true)}
                    </span>
                  ) : (
                    "Not Scheduled"
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* SELLER & ROUTING CARD */}
            <Card
              size="small"
              title="Fulfillment Routing & Seller Assignment"
              bordered
              style={{ borderRadius: 10 }}
              extra={
                <Button size="small" type="link" onClick={() => setAssignSellerOpen(true)}>
                  Change Seller
                </Button>
              }
            >
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Assigned Seller">
                  {activeEnquiry.assigned_seller_name ? (
                    <Space>
                      <strong>{activeEnquiry.assigned_seller_name}</strong>
                      <Tag color={activeEnquiry.assigned_seller_type === "DIRECT" ? "geekblue" : "cyan"}>
                        {activeEnquiry.assigned_seller_type || "DISTRIBUTOR"}
                      </Tag>
                    </Space>
                  ) : (
                    <Tag color="purple" style={{ fontWeight: 600 }}>
                      Awaiting Seller Assignment
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Routing Rule Analysis">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {detailData?.recommendedSeller?.reason ||
                      "Authoritative routing rule: Direct categories are fulfilled by Sai Ajantha Central. Closers & Baskets route to territory distributor. Floor Springs are enquiry-only."}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Assigned Staff Member">
                  {activeEnquiry.assigned_staff_email ? (
                    <Tag color="blue">{activeEnquiry.assigned_staff_email}</Tag>
                  ) : (
                    <span style={{ color: "#94A3B8" }}>Unassigned</span>
                  )}
                </Descriptions.Item>
                {activeEnquiry.lead_type === "INSTALLATION" && (
                  <Descriptions.Item label="Verified Contractor">
                    {activeEnquiry.contractor_name ? (
                      <Tag color="orange">{activeEnquiry.contractor_name}</Tag>
                    ) : (
                      <span style={{ color: "#EA580C" }}>Awaiting Contractor Assignment</span>
                    )}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* REQUESTED PRODUCTS & SPECIFICATION */}
            <Card size="small" title="Requested Products & Sizing Requirements" bordered style={{ borderRadius: 10 }}>
              {Array.isArray(activeEnquiry.items) && activeEnquiry.items.length > 0 ? (
                <Table
                  size="small"
                  pagination={false}
                  dataSource={activeEnquiry.items.map((it: any, idx: number) => ({ ...it, key: idx }))}
                  columns={[
                    { title: "SKU", dataIndex: "sku", key: "sku", width: 140 },
                    { title: "Product Description", dataIndex: "name", key: "name" },
                    { title: "Size / Spec", dataIndex: "size", key: "size", render: (v) => v || "Standard" },
                    { title: "Qty", dataIndex: "quantity", key: "quantity", width: 80 },
                    { title: "Unit", dataIndex: "unit", key: "unit", width: 90, render: (v) => v || "Unit" },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  No structured line items. Customer provided description below:
                </Typography.Text>
              )}

              <div style={{ marginTop: 12 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 4 }}>
                  Customer Message:
                </Typography.Text>
                <Card size="small" style={{ background: token.colorFillAlter, borderRadius: 8 }}>
                  <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>
                    {activeEnquiry.notes || "No message provided."}
                  </Typography.Paragraph>
                </Card>
              </div>

              {activeEnquiry.closure_reason && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 12, borderRadius: 8 }}
                  message="Enquiry Closure Justification"
                  description={activeEnquiry.closure_reason}
                />
              )}
            </Card>

            {/* QUOTATION HISTORY */}
            <Card
              size="small"
              title="Quotation History"
              bordered
              style={{ borderRadius: 10 }}
              extra={
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ background: BRAND_TOKENS.teal, borderColor: BRAND_TOKENS.teal }}
                  onClick={handleOpenCreateQuote}
                >
                  Create Quotation
                </Button>
              }
            >
              {detailData?.quotes && detailData.quotes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {detailData.quotes.map((q) => (
                    <Card
                      key={q.id}
                      size="small"
                      bordered
                      style={{
                        borderRadius: 8,
                        background: q.status === "ACCEPTED" ? "#F0FDF4" : undefined,
                        borderColor: q.status === "ACCEPTED" ? "#86EFAC" : undefined,
                      }}
                    >
                      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                        <div>
                          <Space size={8}>
                            <Typography.Text strong style={{ fontSize: 14 }}>
                              {q.quote_number}
                            </Typography.Text>
                            <Tag color="blue">Rev #{q.revision}</Tag>
                            <AdminStatusTag status={q.status} />
                            {q.is_service_quote && <Tag color="orange">Installation Service</Tag>}
                          </Space>
                          <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                            Total: <strong>{formatInr(q.total_inr || q.subtotal_inr)}</strong> (Subtotal: {formatInr(q.subtotal_inr)}, GST 18%: {formatInr(q.tax_inr)})
                          </Typography.Text>
                          {q.customer_response_notes && (
                            <Typography.Text type="secondary" style={{ display: "block", fontSize: 11.5, color: "#0F766E" }}>
                              Customer Note: "{q.customer_response_notes}"
                            </Typography.Text>
                          )}
                        </div>

                        <Space wrap size={8}>
                          {/* If quote is DRAFT or REVIEWED, allow sending */}
                          {(q.status === "DRAFT" || q.status === "REVIEWED") && (
                            <Button
                              size="small"
                              type="primary"
                              icon={<SendOutlined />}
                              style={{ background: "#0D9488", borderColor: "#0D9488" }}
                              onClick={() => handleSendQuote(q)}
                            >
                              Send Quote
                            </Button>
                          )}

                          {/* If quote is ACCEPTED, allow converting to order */}
                          {q.status === "ACCEPTED" && !q.converted_order_id && (
                            <Button
                              size="small"
                              type="primary"
                              icon={<ShoppingOutlined />}
                              style={{ background: "#16A34A", borderColor: "#16A34A" }}
                              onClick={() => handleConvertQuote(q)}
                            >
                              Convert to Order
                            </Button>
                          )}

                          {q.converted_order_id && (
                            <Tag color="green" icon={<CheckCircleOutlined />}>
                              Converted: {q.converted_order_id}
                            </Tag>
                          )}
                        </Space>
                      </Flex>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No quotations issued for this enquiry yet."
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ background: BRAND_TOKENS.teal, borderColor: BRAND_TOKENS.teal }}
                    onClick={handleOpenCreateQuote}
                  >
                    Prepare First Quotation
                  </Button>
                </Empty>
              )}
            </Card>

            {/* FULL ACTIVITY TIMELINE */}
            <Card size="small" title="Audit & Activity Timeline" bordered style={{ borderRadius: 10 }}>
              {detailData?.activity && detailData.activity.length > 0 ? (
                <Timeline
                  items={detailData.activity.map((act) => ({
                    color:
                      act.action.includes("ACCEPTED") || act.action.includes("ORDER")
                        ? "green"
                        : act.action.includes("SENT")
                        ? "blue"
                        : act.action.includes("REJECT") || act.action.includes("CLOSED")
                        ? "red"
                        : "cyan",
                    children: (
                      <div>
                        <Flex justify="space-between" align="baseline">
                          <strong>{act.action.replace(/_/g, " ")}</strong>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {formatDate(act.created_at, true)}
                          </Typography.Text>
                        </Flex>
                        {act.notes && (
                          <Typography.Paragraph style={{ margin: "4px 0 0", fontSize: 12.5 }}>
                            {act.notes}
                          </Typography.Paragraph>
                        )}
                        {act.actor_email && (
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            by {act.actor_email}
                          </Typography.Text>
                        )}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Typography.Text type="secondary">No activity entries recorded yet.</Typography.Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      {/* MODAL 1: REQUEST MORE DETAILS */}
      <Modal
        open={requestDetailsOpen}
        onCancel={() => setRequestDetailsOpen(false)}
        title="Request Additional Details from Customer"
        onOk={() => detailsForm.submit()}
      >
        <Form form={detailsForm} layout="vertical" onFinish={handleRequestDetailsSubmit}>
          <Form.Item
            name="message"
            label="Information Required"
            rules={[{ required: true, message: "Please specify what details are needed." }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="e.g. Please provide exact frame width and height, or confirm your site delivery PIN code."
            />
          </Form.Item>
          <Form.Item name="notes" label="Internal Notes (Optional)">
            <Input placeholder="Reason for requesting clarification" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 2: ASSIGN SELLER */}
      <Modal
        open={assignSellerOpen}
        onCancel={() => setAssignSellerOpen(false)}
        title="Assign Responsible Seller"
        onOk={() => sellerForm.submit()}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14 }}
          message="Seller Routing Guidelines"
          description="9 Direct Categories → Sai Ajantha Central. Door Closers & Kitchen Baskets → Territory Distributor based on PIN. Floor Springs → Enquiry Only. Never invent a seller."
        />
        <Form form={sellerForm} layout="vertical" onFinish={handleAssignSellerSubmit}>
          <Form.Item
            name="sellerId"
            label="Select Seller"
            rules={[{ required: true, message: "Please select a seller route" }]}
            initialValue="SAI_AJANTHA_CENTRAL"
          >
            <Select>
              <Select.Option value="SAI_AJANTHA_CENTRAL">
                Sai Ajantha Central Warehouse (Direct Sale)
              </Select.Option>
              <Select.Option value="SAI_AJANTHA_ENQUIRY">
                Sai Ajantha Central (Floor Springs Enquiry Only)
              </Select.Option>
              <Select.OptGroup label="Active Regional Distributors">
                {(detailData?.distributors || []).map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} ({d.territory || "Tamil Nadu"})
                  </Select.Option>
                ))}
              </Select.OptGroup>
              <Select.Option value="UNSERVED">
                Unserved Territory — Keep in Awaiting Seller Queue
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Routing Justification (Optional)">
            <Input placeholder="Reason for seller selection" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 3: ASSIGN STAFF */}
      <Modal
        open={assignStaffOpen}
        onCancel={() => setAssignStaffOpen(false)}
        title="Assign Staff Member"
        onOk={() => staffForm.submit()}
      >
        <Form form={staffForm} layout="vertical" onFinish={handleAssignStaffSubmit}>
          <Form.Item
            name="staffEmail"
            label="Staff Member"
            rules={[{ required: true, message: "Please select staff member" }]}
          >
            <Select placeholder="Select staff user">
              {(detailData?.availableStaff || []).map((s) => (
                <Select.Option key={s.email} value={s.email}>
                  {s.first_name ? `${s.first_name} (${s.email})` : s.email}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 4: ASSIGN VERIFIED CONTRACTOR */}
      <Modal
        open={assignContractorOpen}
        onCancel={() => setAssignContractorOpen(false)}
        title="Assign Verified Local Contractor"
        onOk={() => contractorForm.submit()}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14 }}
          message="Independent Fitting Policy"
          description="Installation is quoted and billed independently by the verified contractor. It is never merged into product merchandise orders."
        />
        <Form form={contractorForm} layout="vertical" onFinish={handleAssignContractorSubmit}>
          <Form.Item
            name="contractorId"
            label="Select Verified Contractor"
            rules={[{ required: true, message: "Please select a contractor" }]}
          >
            <Select placeholder="Select verified contractor / dealer">
              {(detailData?.contractors || []).map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name} ({c.territory || "Tamil Nadu"})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 5: SCHEDULE FOLLOW-UP */}
      <Modal
        open={scheduleFollowUpOpen}
        onCancel={() => setScheduleFollowUpOpen(false)}
        title="Schedule Follow-up"
        onOk={() => followUpForm.submit()}
      >
        <Form form={followUpForm} layout="vertical" onFinish={handleScheduleFollowUpSubmit}>
          <Form.Item
            name="followUpDate"
            label="Follow-up Date & Time"
            rules={[{ required: true, message: "Select date and time" }]}
            initialValue={dayjs().add(2, "day")}
          >
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="notes" label="Follow-up Agenda / Notes">
            <Input.TextArea rows={2} placeholder="e.g. Call customer to verify door thickness and schedule site inspection." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 6: CLOSE ENQUIRY */}
      <Modal
        open={closeEnquiryOpen}
        onCancel={() => setCloseEnquiryOpen(false)}
        title="Close Enquiry with Mandatory Reason"
        onOk={() => closeForm.submit()}
        okText="Confirm Closure"
        okButtonProps={{ danger: true }}
      >
        <Form form={closeForm} layout="vertical" onFinish={handleCloseEnquirySubmit}>
          <Form.Item
            name="reason"
            label="Closure Reason"
            rules={[{ required: true, message: "Please specify closure reason" }]}
          >
            <Select placeholder="Select closure reason">
              <Select.Option value="Customer declined quotation">Customer declined quotation</Select.Option>
              <Select.Option value="Requirements fulfilled via alternative channel">Requirements fulfilled via alternative channel</Select.Option>
              <Select.Option value="Product out of scope / Not manufactured">Product out of scope / Not manufactured</Select.Option>
              <Select.Option value="Customer unreachable after repeated attempts">Customer unreachable after repeated attempts</Select.Option>
              <Select.Option value="Duplicate enquiry consolidated">Duplicate enquiry consolidated</Select.Option>
              <Select.Option value="Other commercial reasons">Other commercial reasons</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Additional Details">
            <Input.TextArea rows={2} placeholder="Explain why the enquiry is closed." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 7: CREATE REAL QUOTATION LINKED TO ENQUIRY */}
      <Modal
        open={createQuoteOpen}
        onCancel={() => setCreateQuoteOpen(false)}
        title="Create & Issue Verified Quotation"
        width={680}
        onOk={() => quoteForm.submit()}
        okText="Generate Quotation"
      >
        <Form form={quoteForm} layout="vertical" onFinish={handleCreateQuoteSubmit}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label="Customer / Firm Name"
                rules={[{ required: true, message: "Customer name required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organization" label="Company / Organization">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="customerEmail" label="Email Address">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerPhone" label="Phone Number">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="division" label="Category / Division">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="postalCode" label="Delivery PIN Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "10px 0" }}>Quoted Line Item</Divider>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="sku" label="Product SKU" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="itemName" label="Line Item Name / Specification" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="unitPriceInr" label="Unit Price (INR excl. GST)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="gstRate" label="GST Rate (%)">
                <InputNumber min={0} max={28} placeholder="Auto" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="validDays" label="Validity (Days)">
                <InputNumber min={1} max={90} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="customerNotes" label="Customer Visible Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="internalNotes" label="Internal Staff Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="sendImmediately" valuePropName="checked" initialValue={true}>
            <Select
              options={[
                { label: "Send Immediately to Customer (Status: QUOTED)", value: true },
                { label: "Save as Draft Only (Status: QUOTE PREPARING)", value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default EnquiriesPage;
