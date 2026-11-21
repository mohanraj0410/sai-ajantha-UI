import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  RollbackOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, useAdminDataset } from "../api/adminQueries";
import type { PortalOrderRow } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
} from "../components/common/AdminPrimitives";
import { AdminBlockedApiBanner } from "../components/common/AdminStateView";
import { AdminStatusTabs } from "../components/common/AdminStatusTabs";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { areFormValuesEqual } from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

interface ReturnRow {
  id: string;
  ref: string;
  customer: string;
  sellerScope: string;
  returnStatus: "NONE" | "REQUESTED" | "RETURNED" | "INSPECTED";
  damageClaimStatus: "NONE" | "REPORTED" | "VERIFIED" | "REPLACED";
  damagedQty: number;
  notes: string;
  rawOrder: PortalOrderRow;
}

export const ReturnsPage: React.FC = () => {
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  const { updateReturnInspection } = useAdminMutations();

  const [searchText, setSearchText] = useState("");
  const [filterTab, setFilterTab] = useState("ALL");
  const [inspectRow, setInspectRow] = useState<ReturnRow | null>(null);
  const [inspectInitialValues, setInspectInitialValues] = useState<Record<string, unknown>>({});
  const [form] = Form.useForm();

  const watchedInspect = Form.useWatch([], form);
  const isInspectDirty = useMemo(
    () => Boolean(inspectRow) && !areFormValuesEqual(watchedInspect || {}, inspectInitialValues),
    [inspectRow, watchedInspect, inspectInitialValues]
  );

  const closeInspectClean = useCallback(() => {
    setInspectRow(null);
    form.resetFields();
  }, [form]);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: isInspectDirty,
    onDiscard: closeInspectClean,
    enabled: Boolean(inspectRow),
  });

  const openInspectModal = useCallback(
    (row: ReturnRow) => {
      const init = {
        returnStatus: row.returnStatus,
        damageClaimStatus: row.damageClaimStatus,
        damagedQty: row.damagedQty,
        notes: row.notes,
      };
      form.resetFields();
      form.setFieldsValue(init);
      setInspectInitialValues(init);
      setInspectRow(row);
    },
    [form]
  );

  const portal = useAdminDataset<PortalOrderRow>(staff?.email || "anon", "returns", { tab: filterTab, q: searchText });
  const allRows: ReturnRow[] = useMemo(() => {
    return (portal.data?.items || []).map((o) => {
      const rStat = (((o as any).return_status as string) || "NONE") as ReturnRow["returnStatus"];
      const cStat = (((o as any).damage_claim_status as string) || "NONE") as ReturnRow["damageClaimStatus"];
      const isDirect = (o as any).is_direct_sai_ajanta !== false;
      return {
        id: o.id,
        ref: o.order_number,
        customer: o.customer_name,
        sellerScope: isDirect ? "Sai Ajantha Direct" : "Distributor",
        returnStatus: rStat,
        damageClaimStatus: cStat,
        damagedQty: Number((o as any).damaged_qty || 0),
        notes: String((o as any).damage_notes || ""),
        rawOrder: o,
      };
    });
  }, [portal.data?.items]);

  const filtered = allRows;

  const handleSaveInspection = async (values: any) => {
    if (!inspectRow) return;
    try {
      await updateReturnInspection.mutateAsync({
        orderId: inspectRow.id,
        payload: {
          return_status: values.returnStatus,
          damage_claim_status: values.damageClaimStatus,
          damaged_qty: Number(values.damagedQty) || 0,
          damage_notes: values.notes || undefined,
        },
      });
      showToast(`Saved inspection record for ${inspectRow.ref}.`, "success");
      allowNextNavigation();
      closeInspectClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update inspection. Your entries are preserved.", "error");
    }
  };

  const columns: TableProps<ReturnRow>["columns"] = [
    {
      title: "Order #",
      dataIndex: "ref",
      key: "ref",
      width: 155,
      render: (v: string) => <Typography.Text strong style={{ color: BRAND_TOKENS.teal }}>{v}</Typography.Text>,
    },
    { title: "Customer", dataIndex: "customer", key: "customer", width: 200, ellipsis: true },
    {
      title: "Seller",
      dataIndex: "sellerScope",
      key: "sellerScope",
      width: 155,
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: "Return Status",
      dataIndex: "returnStatus",
      key: "returnStatus",
      align: "center",
      width: 135,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Damage Claim",
      dataIndex: "damageClaimStatus",
      key: "damageClaimStatus",
      align: "center",
      width: 135,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Damaged Qty",
      dataIndex: "damagedQty",
      key: "damagedQty",
      align: "right",
      width: 115,
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 120,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          icon={<EditOutlined />}
          onClick={() => openInspectModal(row)}
        >
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Returns & Inspection"
        subtitle="Log physical return receipts and transit damage inspections."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Returns" }]}
      />

      <AdminBlockedApiBanner
        title="Automated Online Refunds & Restock Disabled"
        description="You can log return inspection and damage claim statuses below. Automated Razorpay refunds and automatic stock restocking remain disabled pending management approval."
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Orders Tracked" value={portal.data?.counts.ALL} icon={<RollbackOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Active Claims" value={portal.data?.counts.OPEN} icon={<WarningOutlined />} accentColor="#D97706" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Inspected"
            value={portal.data?.counts.INSPECTED}
            icon={<CheckCircleOutlined />}
            accentColor="#16A34A"
            highlightTop
          />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Pending Inspection"
            value={portal.data?.counts.REQUESTED}
            icon={<ClockCircleOutlined />}
            accentColor={BRAND_TOKENS.teal}
            highlightTop
          />
        </Col>
      </Row>

      <AdminStatusTabs query={portal} activeKey={filterTab} onChange={setFilterTab}
        items={[{"key":"ALL","label":"All Orders"},{"key":"OPEN","label":"With Return / Damage"},{"key":"INSPECTED","label":"Inspected"}]}
        note="Orders with claims include inspected claims." />

      <AdminTable<ReturnRow>
        title="Return Inspection Log"
        dataSource={filtered}
        pagination={portal.pagination}
        columns={columns}
        rowKey="id"
        loading={portal.isLoading}
        error={portal.isError ? "Failed to load return records." : null}
        onRetry={() => void portal.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search order # or customer..."
        hasActiveFilters={Boolean(searchText)}
        onClearFilters={() => setSearchText("")}
        emptyTitle="No return or damage claims"
        emptyDescription="Delivered orders and return inspection logs will appear here automatically."
        renderMobileItem={(row) => (
          <Card size="small" bordered style={{ borderRadius: 12 }}>
            <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
              <Typography.Text strong style={{ color: BRAND_TOKENS.teal }}>{row.ref}</Typography.Text>
              <AdminStatusTag status={row.returnStatus} />
            </Flex>
            <Typography.Text style={{ display: "block", marginBottom: 8 }}>{row.customer}</Typography.Text>
            <Flex justify="space-between" align="center">
              <AdminStatusTag status={row.damageClaimStatus} />
              <Button size="small" onClick={() => openInspectModal(row)}>
                Inspect
              </Button>
            </Flex>
          </Card>
        )}
      />

      <Modal
        open={Boolean(inspectRow)}
        destroyOnClose
        title={inspectRow ? `Return Inspection — ${inspectRow.ref}` : "Inspection"}
        onCancel={() => confirmLeave(closeInspectClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isInspectDirty || updateReturnInspection.isPending}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue(inspectInitialValues);
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closeInspectClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={updateReturnInspection.isPending}
            disabled={updateReturnInspection.isPending}
            onClick={() => form.submit()}
          >
            Save Inspection
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={(v) => void handleSaveInspection(v)}>
          <Form.Item
            label="Return Status"
            name="returnStatus"
            rules={[{ required: true, message: "Select a return status." }]}
          >
            <Select
              options={[
                { label: "No Return", value: "NONE" },
                { label: "Return Requested", value: "REQUESTED" },
                { label: "Item Returned to Warehouse", value: "RETURNED" },
                { label: "Physically Inspected", value: "INSPECTED" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Damage Claim Status"
            name="damageClaimStatus"
            rules={[{ required: true, message: "Select a damage claim status." }]}
          >
            <Select
              options={[
                { label: "None", value: "NONE" },
                { label: "Damage Reported", value: "REPORTED" },
                { label: "Damage Verified", value: "VERIFIED" },
                { label: "Replacement Dispatched", value: "REPLACED" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Damaged Quantity"
            name="damagedQty"
            dependencies={["damageClaimStatus"]}
            rules={[
              ({ getFieldValue }) => ({
                validator: async (_, value) => {
                  const claim = getFieldValue("damageClaimStatus");
                  const qty = Number(value ?? 0);
                  if (Number.isNaN(qty) || qty < 0) {
                    throw new Error("Damaged quantity cannot be negative.");
                  }
                  if (claim && claim !== "NONE" && qty < 1) {
                    throw new Error("Enter at least 1 damaged unit when a damage claim is active.");
                  }
                },
              }),
            ]}
          >
            <InputNumber min={0} max={100000} precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Inspection Notes" name="notes">
            <Input.TextArea rows={3} placeholder="Record transit damage condition or replacement note" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
