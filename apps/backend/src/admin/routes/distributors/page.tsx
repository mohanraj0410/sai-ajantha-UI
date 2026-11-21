import React, { useCallback, useEffect, useMemo, useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Input, Select, Table, Text } from "@medusajs/ui";
import { ThemeProvider } from "../../components/theme/theme-context";
import { ThemeHeader } from "../../components/theme/ThemeHeader";
import { AddProductModal } from "../../components/products/AddProductModal";

// Distributor Entity Interface
interface DistributorUser {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  company_name: string;
  organization?: string;
  gstin?: string | null;
  territory?: string | null;
  business_city?: string | null;
  credit_limit?: number;
  discount_tier?: string;
  role: string;
  status?: string;
  approval_status?: string;
  created_at: string;
}

// Order Item & Record Interfaces
interface OrderItem {
  id?: string;
  product_id?: string;
  sku?: string;
  name?: string;
  category?: string;
  finish?: string | null;
  pack_label?: string | null;
  pack_multiplier?: number;
  unit_price_inr?: number | null;
  quantity: number;
  line_total_inr?: number | null;
}

interface TradeOrderRecord {
  id: string;
  order_number: string;
  user_id?: string;
  customer_id?: string;
  role_at_order?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  organization?: string;
  gstin?: string | null;
  shipping_address?: string;
  subtotal_inr: number;
  gst_amount_inr: number;
  total_inr: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  shipping_carrier?: string | null;
  tracking_reference?: string | null;
  notes?: string | null;
  created_at: string;
  items: OrderItem[];
}

function DistributorNavIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function formatInr(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const LOGISTICS_CARRIERS = [
  "Sai Ajantha Dedicated Logistics Fleet",
  "V-Trans (India) Limited",
  "TCI Freight Logistics",
  "Safexpress Supply Chain",
  "KPN Speed Parcel",
  "ARC Surface Logistics",
  "Local Trichy Plant Pickup",
];

const DistributorsPageContent: React.FC = () => {
  // Top-level View Tab: "PARTNERS" or "ORDERS"
  const [activeTab, setActiveTab] = useState<"PARTNERS" | "ORDERS">("PARTNERS");

  // State: Distributors
  const [distributors, setDistributors] = useState<DistributorUser[]>([]);
  const [loadingDistributors, setLoadingDistributors] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // State: Distributor Orders
  const [orders, setOrders] = useState<TradeOrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL_MANUFACTURED");
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState<DistributorUser | null>(null);

  // Order Logistics Modal State
  const [activeOrderModal, setActiveOrderModal] = useState<TradeOrderRecord | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateCarrier, setUpdateCarrier] = useState<string>("");
  const [updateTracking, setUpdateTracking] = useState<string>("");
  const [updateNote, setUpdateNote] = useState<string>("");
  const [submittingOrderUpdate, setSubmittingOrderUpdate] = useState(false);
  const [orderUpdateError, setOrderUpdateError] = useState<string | null>(null);

  // New Distributor Form State
  const [formCompany, setFormCompany] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formGstin, setFormGstin] = useState("");
  const [formTerritory, setFormTerritory] = useState("Trichy");
  const [formCreditLimit, setFormCreditLimit] = useState("500000");
  const [formDiscountTier, setFormDiscountTier] = useState("35%");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Distributors
  const fetchDistributors = useCallback(async () => {
    setLoadingDistributors(true);
    try {
      const res = await fetch("/admin/sai-ajanta/customers?role=DISTRIBUTOR", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setDistributors(json.customers || []);
      } else {
        const portalRes = await fetch("/admin/sai-ajanta/portal", {
          credentials: "include",
        });
        if (portalRes.ok) {
          const json = await portalRes.json();
          const users: DistributorUser[] = (json.users || []).filter(
            (u: { role: string }) => u.role === "DISTRIBUTOR"
          );
          setDistributors(users);
        }
      }
    } catch (e) {
      console.error("Failed to load distributors", e);
    } finally {
      setLoadingDistributors(false);
    }
  }, []);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/admin/sai-ajanta/orders", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
      }
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    void fetchDistributors();
    void fetchOrders();

    const handleGlobalRefresh = () => {
      void fetchDistributors();
      void fetchOrders();
    };
    window.addEventListener("sai-ajanta-refresh", handleGlobalRefresh);
    return () => window.removeEventListener("sai-ajanta-refresh", handleGlobalRefresh);
  }, [fetchDistributors, fetchOrders]);

  // Status Change for Distributor
  const handleStatusChange = async (
    distributorId: string,
    nextStatus: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED"
  ) => {
    setActionLoadingId(distributorId);
    try {
      const res = await fetch(`/admin/sai-ajanta/customers/${distributorId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, role: "DISTRIBUTOR" }),
      });
      if (res.ok) {
        await fetchDistributors();
      }
    } catch (e) {
      console.error("Failed to update status", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create Distributor Form Submit
  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formEmail.trim() || !formCompany.trim()) {
      setFormError("Company name and contact email are required.");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        company_name: formCompany.trim(),
        name: formName.trim() || formCompany.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        gstin: formGstin.trim().toUpperCase(),
        territory: formTerritory.trim(),
        credit_limit: parseFloat(formCreditLimit) || 500000,
        discount_tier: formDiscountTier.trim() || "35%",
        role: "DISTRIBUTOR",
        status: formStatus,
      };

      const res = await fetch("/admin/sai-ajanta/customers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create distributor");
      }

      setFormCompany("");
      setFormName("");
      setFormEmail("");
      setFormPhone("");
      setFormGstin("");
      setIsCreateModalOpen(false);
      await fetchDistributors();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create distributor");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Order Logistics Modal
  const handleOpenOrderModal = (order: TradeOrderRecord) => {
    setActiveOrderModal(order);
    setUpdateStatus(order.status || "CONFIRMED_TRADE_PO");
    setUpdateCarrier(order.shipping_carrier || LOGISTICS_CARRIERS[0]);
    setUpdateTracking(order.tracking_reference || "");
    setUpdateNote("");
    setOrderUpdateError(null);
  };

  // Save Order Logistics Update
  const handleSaveOrderUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderModal) return;
    setSubmittingOrderUpdate(true);
    setOrderUpdateError(null);

    try {
      const res = await fetch(`/admin/sai-ajanta/orders/${activeOrderModal.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus,
          shippingCarrier: updateCarrier,
          trackingReference: updateTracking.trim(),
          eventNote: updateNote.trim() || `Logistics updated: ${updateStatus} via ${updateCarrier}`,
          actorName: "Sai Ajantha Logistics Manager",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to update order status");
      }

      setActiveOrderModal(null);
      await fetchOrders();
    } catch (err: unknown) {
      setOrderUpdateError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setSubmittingOrderUpdate(false);
    }
  };

  // Metrics: Distributors
  const distributorMetrics = useMemo(() => {
    const total = distributors.length;
    const active = distributors.filter(
      (d) => (d.status || d.approval_status) === "ACTIVE" || (d.status || d.approval_status) === "APPROVED"
    ).length;
    const pending = distributors.filter(
      (d) => (d.status || d.approval_status) === "PENDING_APPROVAL"
    ).length;
    const suspended = distributors.filter(
      (d) => (d.status || d.approval_status) === "SUSPENDED" || (d.status || d.approval_status) === "REJECTED"
    ).length;
    const totalCredit = distributors.reduce((sum, d) => sum + (d.credit_limit || 500000), 0);

    return { total, active, pending, suspended, totalCredit };
  }, [distributors]);

  // Filtered Distributors
  const filteredDistributors = useMemo(() => {
    const q = distributorSearch.trim().toLowerCase();
    return distributors.filter((d) => {
      const currentStatus = (d.status || d.approval_status || "ACTIVE").toUpperCase();
      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && !(currentStatus === "ACTIVE" || currentStatus === "APPROVED")) return false;
        if (statusFilter === "PENDING_APPROVAL" && currentStatus !== "PENDING_APPROVAL") return false;
        if (statusFilter === "SUSPENDED" && !(currentStatus === "SUSPENDED" || currentStatus === "REJECTED")) return false;
      }
      if (!q) return true;
      return (
        (d.company_name || d.organization || "").toLowerCase().includes(q) ||
        (d.name || "").toLowerCase().includes(q) ||
        (d.email || "").toLowerCase().includes(q) ||
        (d.phone || "").toLowerCase().includes(q) ||
        (d.gstin || "").toLowerCase().includes(q) ||
        (d.territory || d.business_city || "").toLowerCase().includes(q)
      );
    });
  }, [distributors, statusFilter, distributorSearch]);

  // Filtered Manufactured Orders (Aluminium & Frames/Channels)
  const manufacturedOrders = useMemo(() => {
    return orders.filter((order) => {
      const isDistributor = (order.role_at_order || "").toUpperCase() === "DISTRIBUTOR";
      const hasManufacturedItem = (order.items || []).some((item) => {
        const cat = (item.category || "").toLowerCase();
        return (
          cat.includes("aluminium") ||
          cat.includes("frames") ||
          cat.includes("channels") ||
          cat.includes("extrusion")
        );
      });
      return isDistributor || hasManufacturedItem;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return manufacturedOrders.filter((o) => {
      if (selectedCategory === "ALUMINIUM") {
        const hasAlu = (o.items || []).some((i) =>
          (i.category || "").toLowerCase().includes("aluminium")
        );
        if (!hasAlu) return false;
      } else if (selectedCategory === "FRAMES_CHANNELS") {
        const hasFrames = (o.items || []).some((i) =>
          (i.category || "").toLowerCase().includes("frame") ||
          (i.category || "").toLowerCase().includes("channel")
        );
        if (!hasFrames) return false;
      }

      if (selectedOrderStatus !== "ALL" && o.status !== selectedOrderStatus) {
        return false;
      }

      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.organization || "").toLowerCase().includes(q) ||
        (o.tracking_reference || "").toLowerCase().includes(q) ||
        (o.items || []).some((i) => (i.name || "").toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q))
      );
    });
  }, [manufacturedOrders, selectedCategory, selectedOrderStatus, orderSearch]);

  // Metrics: Orders
  const orderMetrics = useMemo(() => {
    let aluCount = 0;
    let aluRevenue = 0;
    let frameCount = 0;
    let frameRevenue = 0;
    let inProduction = 0;
    let dispatched = 0;

    for (const o of manufacturedOrders) {
      if (o.status === "PROCESSING" || o.status === "CONFIRMED_TRADE_PO") inProduction++;
      if (o.status === "DISPATCHED") dispatched++;

      for (const item of o.items || []) {
        const cat = (item.category || "").toLowerCase();
        const lineTotal = item.line_total_inr || (item.unit_price_inr || 0) * item.quantity;
        if (cat.includes("aluminium")) {
          aluCount += item.quantity;
          aluRevenue += lineTotal;
        } else if (cat.includes("frame") || cat.includes("channel")) {
          frameCount += item.quantity;
          frameRevenue += lineTotal;
        }
      }
    }

    return { aluCount, aluRevenue, frameCount, frameRevenue, inProduction, dispatched };
  }, [manufacturedOrders]);

  return (
    <div className="flex flex-col gap-y-5 pb-12">
      {/* Top Header */}
      <ThemeHeader
        title="Distributor Management &amp; Orders"
        subtitle="Manage authorized distributor network, credit limits, and orders for manufactured lines"
        onAddProductClick={() => setIsAddProductOpen(true)}
        actions={
          activeTab === "PARTNERS" ? (
            <Button
              variant="primary"
              size="small"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none"
            >
              + Create Distributor
            </Button>
          ) : null
        }
      />

      {/* Main Mode Toggle: Distributor Partners vs Distributor Orders */}
      <div className="flex items-center gap-2 rounded-xl border border-ui-border-base bg-ui-bg-base p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("PARTNERS")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === "PARTNERS"
              ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
              : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          }`}
        >
          Distributor Partners ({distributors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ORDERS")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            activeTab === "ORDERS"
              ? "bg-[#102d4d] text-white dark:bg-[#079d9a]"
              : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
          }`}
        >
          Distributor Orders (Aluminium &amp; Framing) ({manufacturedOrders.length})
        </button>
      </div>

      {/* =========================================================================
       * VIEW 1: DISTRIBUTOR PARTNERS
       * ========================================================================= */}
      {activeTab === "PARTNERS" && (
        <>
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Total Distributors
              </Text>
              <Heading level="h2" className="mt-1 text-2xl font-bold">
                {distributorMetrics.total}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                Authorized partners
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                  Active Partners
                </Text>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {distributorMetrics.active}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                PO &amp; credit enabled
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                  Pending Approvals
                </Text>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {distributorMetrics.pending}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                Awaiting verification
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Suspended
              </Text>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {distributorMetrics.suspended}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                Under trade review
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Allocated Credit Pool
              </Text>
              <Heading level="h2" className="mt-1 text-xl font-bold text-[#079d9a] dark:text-[#24c6d0]">
                {formatInr(distributorMetrics.totalCredit)}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                Revolving trade credit
              </Text>
            </div>
          </div>

          {/* Table Container */}
          <Container className="divide-y p-0 overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-ui-bg-base">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: `All (${distributors.length})` },
                  { id: "ACTIVE", label: `Active (${distributorMetrics.active})` },
                  { id: "PENDING_APPROVAL", label: `Pending (${distributorMetrics.pending})` },
                  { id: "SUSPENDED", label: `Suspended (${distributorMetrics.suspended})` },
                ].map((tab) => (
                  <Button
                    key={tab.id}
                    size="small"
                    variant={statusFilter === tab.id ? "primary" : "secondary"}
                    onClick={() => setStatusFilter(tab.id)}
                    className={statusFilter === tab.id ? "bg-[#102d4d] dark:bg-[#079d9a] text-white border-none shadow-none" : ""}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search distributor, GSTIN, city..."
                  value={distributorSearch}
                  onChange={(e) => setDistributorSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto px-6 py-3">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Distributor / Entity</Table.HeaderCell>
                    <Table.HeaderCell>Contact Person</Table.HeaderCell>
                    <Table.HeaderCell>GSTIN / Territory</Table.HeaderCell>
                    <Table.HeaderCell>Credit Limit</Table.HeaderCell>
                    <Table.HeaderCell>Discount Tier</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {loadingDistributors ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        Loading distributors...
                      </Table.Cell>
                    </Table.Row>
                  ) : filteredDistributors.length === 0 ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        No distributors found matching criteria.
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredDistributors.map((dist) => {
                      const status = (dist.status || dist.approval_status || "ACTIVE").toUpperCase();
                      const isActive = status === "ACTIVE" || status === "APPROVED";
                      const isPending = status === "PENDING_APPROVAL";
                      const isSuspended = status === "SUSPENDED" || status === "REJECTED";
                      const isBusy = actionLoadingId === dist.id;

                      return (
                        <Table.Row key={dist.id} className="hover:bg-ui-bg-subtle/40 transition-colors">
                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-ui-fg-base">
                                {dist.company_name || dist.organization || dist.name}
                              </span>
                              <span className="text-xs text-ui-fg-subtle font-mono">
                                ID: {dist.id.slice(0, 14)}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-ui-fg-base">
                                {dist.name}
                              </span>
                              <span className="text-xs text-ui-fg-muted">
                                {dist.email} {dist.phone ? `· ${dist.phone}` : ""}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col gap-0.5">
                              {dist.gstin ? (
                                <span className="font-mono text-xs font-semibold text-ui-fg-base">
                                  {dist.gstin}
                                </span>
                              ) : (
                                <span className="text-xs text-ui-fg-muted">GST Unregistered</span>
                              )}
                              <span className="text-xs text-ui-fg-subtle">
                                {dist.territory || dist.business_city || "Tamil Nadu"}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <span className="font-semibold text-[#079d9a] dark:text-[#24c6d0]">
                              {formatInr(dist.credit_limit || 500000)}
                            </span>
                          </Table.Cell>

                          <Table.Cell>
                            <Badge color="blue" className="font-medium">
                              {dist.discount_tier || "35% Off"}
                            </Badge>
                          </Table.Cell>

                          <Table.Cell>
                            {isActive && <Badge color="green">Active</Badge>}
                            {isPending && <Badge color="orange">Pending Approval</Badge>}
                            {isSuspended && <Badge color="red">Suspended</Badge>}
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex items-center gap-2">
                              {isPending && (
                                <Button
                                  size="small"
                                  variant="primary"
                                  disabled={isBusy}
                                  onClick={() => void handleStatusChange(dist.id, "ACTIVE")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                                >
                                  {isBusy ? "..." : "Approve"}
                                </Button>
                              )}
                              {isActive && (
                                <Button
                                  size="small"
                                  variant="secondary"
                                  disabled={isBusy}
                                  onClick={() => void handleStatusChange(dist.id, "SUSPENDED")}
                                  className="text-xs text-rose-600 hover:text-rose-700 h-7 px-2"
                                >
                                  {isBusy ? "..." : "Suspend"}
                                </Button>
                              )}
                              {isSuspended && (
                                <Button
                                  size="small"
                                  variant="secondary"
                                  disabled={isBusy}
                                  onClick={() => void handleStatusChange(dist.id, "ACTIVE")}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 h-7 px-2"
                                >
                                  {isBusy ? "..." : "Reactivate"}
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setEditingDistributor(dist)}
                                className="text-xs h-7 px-2 text-ui-fg-subtle hover:text-ui-fg-base"
                              >
                                Edit
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </>
      )}

      {/* =========================================================================
       * VIEW 2: DISTRIBUTOR ORDERS (MANUFACTURED CATEGORIES)
       * ========================================================================= */}
      {activeTab === "ORDERS" && (
        <>
          {/* Orders KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium uppercase tracking-wider">
                  Aluminium Extrusions
                </Text>
                <Badge color="blue">6063-T5</Badge>
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-[#102d4d] dark:text-[#24c6d0]">
                {formatInr(orderMetrics.aluRevenue)}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted font-medium">
                {orderMetrics.aluCount} lengths / linear units
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium uppercase tracking-wider">
                  Frames &amp; Channels
                </Text>
                <Badge color="purple">Sub-Sill</Badge>
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-[#102d4d] dark:text-[#24c6d0]">
                {formatInr(orderMetrics.frameRevenue)}
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted font-medium">
                {orderMetrics.frameCount} structural channel units
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium uppercase tracking-wider">
                  In Production Queue
                </Text>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {orderMetrics.inProduction} POs
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                Extrusion cut-to-length &amp; finishing
              </Text>
            </div>

            <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Text size="xsmall" className="text-ui-fg-subtle font-medium uppercase tracking-wider">
                  Dispatched &amp; In-Transit
                </Text>
                <Badge color="green">Freight</Badge>
              </div>
              <Heading level="h2" className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {orderMetrics.dispatched} Shipments
              </Heading>
              <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                With logistics docket assigned
              </Text>
            </div>
          </div>

          {/* Orders Table Container */}
          <Container className="divide-y p-0 overflow-hidden shadow-sm">
            <div className="flex flex-col gap-3 px-6 py-4 bg-ui-bg-base lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="small"
                  variant={selectedCategory === "ALL_MANUFACTURED" ? "primary" : "secondary"}
                  onClick={() => setSelectedCategory("ALL_MANUFACTURED")}
                  className={selectedCategory === "ALL_MANUFACTURED" ? "bg-[#102d4d] dark:bg-[#079d9a] text-white border-none shadow-none" : ""}
                >
                  All Manufactured ({manufacturedOrders.length})
                </Button>
                <Button
                  size="small"
                  variant={selectedCategory === "ALUMINIUM" ? "primary" : "secondary"}
                  onClick={() => setSelectedCategory("ALUMINIUM")}
                  className={selectedCategory === "ALUMINIUM" ? "bg-[#102d4d] dark:bg-[#079d9a] text-white border-none shadow-none" : ""}
                >
                  Aluminium Extrusions
                </Button>
                <Button
                  size="small"
                  variant={selectedCategory === "FRAMES_CHANNELS" ? "primary" : "secondary"}
                  onClick={() => setSelectedCategory("FRAMES_CHANNELS")}
                  className={selectedCategory === "FRAMES_CHANNELS" ? "bg-[#102d4d] dark:bg-[#079d9a] text-white border-none shadow-none" : ""}
                >
                  Frames &amp; Channels
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedOrderStatus} onValueChange={(v) => setSelectedOrderStatus(v)}>
                  <Select.Trigger className="w-44 text-xs">
                    <Select.Value placeholder="Filter Status" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="ALL">All Statuses</Select.Item>
                    <Select.Item value="CONFIRMED_TRADE_PO">Confirmed Trade PO</Select.Item>
                    <Select.Item value="PROCESSING">Processing / Production</Select.Item>
                    <Select.Item value="DISPATCHED">Dispatched</Select.Item>
                    <Select.Item value="DELIVERED">Delivered</Select.Item>
                    <Select.Item value="CANCELLED">Cancelled</Select.Item>
                  </Select.Content>
                </Select>

                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search PO #, buyer, tracking..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto px-6 py-3">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Order # / Date</Table.HeaderCell>
                    <Table.HeaderCell>Distributor / Buyer</Table.HeaderCell>
                    <Table.HeaderCell>Manufactured Items Breakdown</Table.HeaderCell>
                    <Table.HeaderCell>Total (INR)</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Shipping &amp; Docket</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {loadingOrders ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        Loading distributor orders...
                      </Table.Cell>
                    </Table.Row>
                  ) : filteredOrders.length === 0 ? (
                    <Table.Row>
                      <Table.Cell className="text-center py-8 text-ui-fg-muted">
                        No distributor orders found matching criteria.
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    filteredOrders.map((order) => {
                      const items = order.items || [];
                      const isDispatched = order.status === "DISPATCHED";
                      const isDelivered = order.status === "DELIVERED";
                      const isProcessing = order.status === "PROCESSING";

                      return (
                        <Table.Row key={order.id} className="hover:bg-ui-bg-subtle/40 transition-colors">
                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="font-bold text-ui-fg-base font-mono">
                                {order.order_number}
                              </span>
                              <span className="text-xs text-ui-fg-subtle">
                                {new Date(order.created_at).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-ui-fg-base">
                                {order.organization || order.customer_name}
                              </span>
                              <span className="text-xs text-ui-fg-muted">
                                {order.customer_email}
                              </span>
                              <span className="mt-0.5 inline-block text-[11px] text-[#079d9a] font-medium">
                                Role: {order.role_at_order || "DISTRIBUTOR"}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell className="max-w-xs">
                            <div className="flex flex-col gap-1">
                              {items.slice(0, 3).map((item, idx) => {
                                const isAlu = (item.category || "").toLowerCase().includes("aluminium");
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 text-xs border-b border-ui-border-base/50 pb-0.5"
                                  >
                                    <div className="truncate">
                                      <span className="font-medium text-ui-fg-base">
                                        {item.name || item.sku}
                                      </span>
                                      {item.category && (
                                        <span
                                          className={`ml-1.5 rounded px-1 py-0.2 text-[10px] font-semibold ${
                                            isAlu
                                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                              : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                          }`}
                                        >
                                          {isAlu ? "Aluminium" : "Frames"}
                                        </span>
                                      )}
                                    </div>
                                    <span className="shrink-0 font-mono text-ui-fg-subtle">
                                      x{item.quantity}
                                    </span>
                                  </div>
                                );
                              })}
                              {items.length > 3 && (
                                <span className="text-[11px] text-ui-fg-muted italic">
                                  +{items.length - 3} more items in PO
                                </span>
                              )}
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="font-bold text-ui-fg-base">
                                {formatInr(order.total_inr)}
                              </span>
                              <span className="text-[11px] text-ui-fg-subtle">
                                GST: {formatInr(order.gst_amount_inr)}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col gap-1">
                              {isProcessing && <Badge color="orange">Processing</Badge>}
                              {isDispatched && <Badge color="blue">Dispatched</Badge>}
                              {isDelivered && <Badge color="green">Delivered</Badge>}
                              {!isProcessing && !isDispatched && !isDelivered && (
                                <Badge color="grey">{order.status}</Badge>
                              )}
                              <span className="text-[10px] text-ui-fg-muted uppercase font-mono">
                                {order.payment_status}
                              </span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-ui-fg-base">
                                {order.shipping_carrier || "Local Dispatch"}
                              </span>
                              {order.tracking_reference ? (
                                <span className="font-mono text-xs font-semibold text-[#079d9a] dark:text-[#24c6d0]">
                                  Docket: {order.tracking_reference}
                                </span>
                              ) : (
                                <span className="text-[11px] text-ui-fg-muted italic">
                                  No docket assigned
                                </span>
                              )}
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => handleOpenOrderModal(order)}
                              className="text-xs text-ui-fg-base hover:bg-ui-bg-subtle"
                            >
                              Dispatch / Update
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </>
      )}

      {/* =========================================================================
       * MODALS: CREATE DISTRIBUTOR & EDIT DISTRIBUTOR
       * ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102d4d] text-white dark:bg-[#079d9a]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ui-fg-base">Register New Distributor</h3>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Creates authorized Medusa B2B account with wholesale privileges
                  </Text>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-ui-fg-muted hover:text-ui-fg-base"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDistributor} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Company / Trade Business Name *
                </label>
                <Input
                  placeholder="e.g. Trichy Architectural Hardware Systems Pvt Ltd"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Contact Person Name *
                  </label>
                  <Input
                    placeholder="e.g. Suresh Kumar"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Contact Email *
                  </label>
                  <Input
                    type="email"
                    placeholder="distributor@trade.in"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Phone / WhatsApp
                  </label>
                  <Input
                    placeholder="+91 98401 23456"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    GSTIN (15 Digits)
                  </label>
                  <Input
                    placeholder="33AAAAA0000A1Z5"
                    value={formGstin}
                    onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Territory / Operating Hub
                  </label>
                  <Input
                    placeholder="e.g. Trichy / Madurai Region"
                    value={formTerritory}
                    onChange={(e) => setFormTerritory(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Credit Limit (₹)
                  </label>
                  <Input
                    type="number"
                    step="10000"
                    placeholder="500000"
                    value={formCreditLimit}
                    onChange={(e) => setFormCreditLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Wholesale Discount Slab
                  </label>
                  <Select value={formDiscountTier} onValueChange={(v) => setFormDiscountTier(v)}>
                    <Select.Trigger>
                      <Select.Value placeholder="Select Tier" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="35%">Tier A — 35% Off MRP</Select.Item>
                      <Select.Item value="30%">Tier B — 30% Off MRP</Select.Item>
                      <Select.Item value="25%">Tier C — 25% Off MRP</Select.Item>
                      <Select.Item value="40%">Elite Platinum — 40% Off</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                    Initial Status
                  </label>
                  <Select value={formStatus} onValueChange={(v) => setFormStatus(v)}>
                    <Select.Trigger>
                      <Select.Value placeholder="Status" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="ACTIVE">Active (Immediate Ordering)</Select.Item>
                      <Select.Item value="PENDING_APPROVAL">Pending Verification</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-ui-border-base pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={formSubmitting}
                  className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none"
                >
                  {formSubmitting ? "Creating Partner..." : "Register Distributor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Order Logistics */}
      {activeOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ui-border-base pb-3">
              <div>
                <h3 className="text-lg font-bold text-ui-fg-base">
                  Dispatch &amp; Order #{activeOrderModal.order_number}
                </h3>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Distributor: {activeOrderModal.organization || activeOrderModal.customer_name}
                </Text>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrderModal(null)}
                className="text-ui-fg-muted hover:text-ui-fg-base"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {orderUpdateError && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                {orderUpdateError}
              </div>
            )}

            <form onSubmit={handleSaveOrderUpdate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Fulfillment Status
                </label>
                <Select value={updateStatus} onValueChange={(val) => setUpdateStatus(val)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="CONFIRMED_TRADE_PO">Confirmed Trade PO</Select.Item>
                    <Select.Item value="PROCESSING">Processing / In Production</Select.Item>
                    <Select.Item value="DISPATCHED">Dispatched &amp; In-Transit</Select.Item>
                    <Select.Item value="DELIVERED">Delivered to Partner Warehouse</Select.Item>
                    <Select.Item value="CANCELLED">Cancelled</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Freight / Logistics Carrier
                </label>
                <Select value={updateCarrier} onValueChange={(val) => setUpdateCarrier(val)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {LOGISTICS_CARRIERS.map((c) => (
                      <Select.Item key={c} value={c}>
                        {c}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Consignment Docket / Waybill Reference No.
                </label>
                <Input
                  placeholder="e.g. VTR-8829103-TR"
                  value={updateTracking}
                  onChange={(e) => setUpdateTracking(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Dispatch Notes / Memo
                </label>
                <Input
                  placeholder="e.g. Dispatched 50 bundles 6063-T5 aluminium profiles from Trichy Hub"
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-ui-border-base pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveOrderModal(null)}
                  disabled={submittingOrderUpdate}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingOrderUpdate}
                  className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none"
                >
                  {submittingOrderUpdate ? "Saving..." : "Update Shipment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Distributor */}
      {editingDistributor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-ui-border-base bg-ui-bg-base p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ui-fg-base">
              Edit Distributor: {editingDistributor.company_name || editingDistributor.name}
            </h3>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              Update commercial limits and account status
            </Text>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ui-fg-subtle">
                  Account Status
                </label>
                <Select
                  value={editingDistributor.status || "ACTIVE"}
                  onValueChange={(val) =>
                    setEditingDistributor({ ...editingDistributor, status: val })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="ACTIVE">Active</Select.Item>
                    <Select.Item value="PENDING_APPROVAL">Pending Approval</Select.Item>
                    <Select.Item value="SUSPENDED">Suspended</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-ui-border-base pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingDistributor(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    void handleStatusChange(
                      editingDistributor.id,
                      (editingDistributor.status as "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED") || "ACTIVE"
                    );
                    setEditingDistributor(null);
                  }}
                  className="bg-[#079d9a] hover:bg-[#068280] text-white border-none shadow-none"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
      />
    </div>
  );
};

const DistributorsPage: React.FC = () => {
  return (
    <ThemeProvider>
      <DistributorsPageContent />
    </ThemeProvider>
  );
};

export const config = defineRouteConfig({
  label: "Distributors",
  icon: DistributorNavIcon,
  rank: 2,
});

export default DistributorsPage;
