"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { format } from "date-fns";
import {
  CalendarIcon,
  Check,
  Pencil,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useStore } from "@/components/StoreProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInr } from "@/lib/productSpecs";

type AdminTab =
  | "applications"
  | "customers"
  | "products"
  | "orders"
  | "payments"
  | "enquiries";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  business_city: string | null;
  role: string;
  approval_status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface AdminProductRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  customer_price_inr: number | null;
  dealer_price_inr: number | null;
  distributor_price_inr: number | null;
  stock_qty: number;
  approved: number;
  active: number;
}

interface AdminOrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  price_tier_applied: string;
  customer_name: string;
  organization: string;
  total_inr: number;
  shipping_carrier: string | null;
  tracking_reference: string | null;
  refund_status: string;
  created_at: string;
}

interface AdminPaymentRow {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  signature_verified: number;
  amount_paise: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
}

interface AdminEnquiryRow {
  id: string;
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  division: string;
  notes: string;
  source: string;
  status: string;
  created_at: string;
}

interface AdminOverviewResponse {
  users: AdminUserRow[];
  products: AdminProductRow[];
  orders: AdminOrderRow[];
  payments: AdminPaymentRow[];
  enquiries: AdminEnquiryRow[];
  reports: {
    totalUsers: number;
    pendingApplications: number;
    totalProducts: number;
    lowStockProducts: number;
    totalOrders: number;
    paidOrders: number;
    paidRevenueInr: number;
    totalEnquiries: number;
  };
}

export default function AdminPage() {
  const { session, authLoading, refreshAuthAndCatalog, showToast } = useStore();
  const [tab, setTab] = useState<AdminTab>("applications");
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingProd, setEditingProd] = useState<AdminProductRow | null>(null);
  const [editingOrder, setEditingOrder] = useState<AdminOrderRow | null>(null);
  const [orderDateFilter, setOrderDateFilter] = useState<Date | undefined>(
    undefined
  );

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        setData((await res.json()) as AdminOverviewResponse);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || session?.role !== "ADMIN") return;
    const frame = window.requestAnimationFrame(() => {
      setLoading(true);
      void loadOverview();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session, authLoading, loadOverview]);

  const handleApproval = useCallback(
    async (userId: string, approvalStatus: "APPROVED" | "REJECTED") => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalStatus,
          rejectionReason:
            approvalStatus === "REJECTED"
              ? "Incomplete verification details"
              : undefined,
        }),
      });
      if (res.ok) {
        showToast(`Application marked ${approvalStatus}.`);
        await loadOverview();
      }
    },
    [loadOverview, showToast]
  );

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProd) return;
    const res = await fetch(
      `/api/admin/products/${encodeURIComponent(editingProd.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingProd.name,
          customerPriceInr: editingProd.customer_price_inr,
          dealerPriceInr: editingProd.dealer_price_inr,
          distributorPriceInr: editingProd.distributor_price_inr,
          stockQty: editingProd.stock_qty,
          approved: Boolean(editingProd.approved),
        }),
      }
    );
    if (res.ok) {
      showToast(`Updated ${editingProd.sku}.`);
      setEditingProd(null);
      await loadOverview();
      await refreshAuthAndCatalog();
    }
  }

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!editingOrder) return;
    const res = await fetch(
      `/api/admin/orders/${encodeURIComponent(editingOrder.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editingOrder.status,
          shippingCarrier: editingOrder.shipping_carrier,
          trackingReference: editingOrder.tracking_reference,
          refundStatus: editingOrder.refund_status,
        }),
      }
    );
    if (res.ok) {
      showToast(`Order ${editingOrder.order_number} updated.`);
      setEditingOrder(null);
      await loadOverview();
    }
  }

  const handleEnquiryStatus = useCallback(
    async (id: string, status: string) => {
      const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Enquiry marked ${status}.`);
        await loadOverview();
      }
    },
    [loadOverview, showToast]
  );

  const wholesaleUsers = useMemo(
    () =>
      (data?.users || []).filter(
        (u) => u.role === "DISTRIBUTOR" || u.role === "DEALER"
      ),
    [data]
  );

  const customerUsers = useMemo(
    () => (data?.users || []).filter((u) => u.role === "CUSTOMER"),
    [data]
  );

  const filteredOrders = useMemo(() => {
    const orders = data?.orders || [];
    if (!orderDateFilter) return orders;
    const targetDay = format(orderDateFilter, "yyyy-MM-dd");
    return orders.filter((o) => o.created_at.slice(0, 10) >= targetDay);
  }, [data, orderDateFilter]);

  const applicationColumns = useMemo<LegacyColumnDef<AdminUserRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Applicant",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div>
              <strong className="text-[#153C66]">{u.name}</strong>
              <span className="block text-[#7B8896]">
                {u.email} · {u.phone}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <Badge variant="teal">{row.original.role}</Badge>,
      },
      {
        accessorKey: "organization",
        header: "Firm / GSTIN",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <span className="text-[#7B8896]">
              {u.organization}
              {u.gstin ? ` · ${u.gstin}` : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "approval_status",
        header: "Status",
        cell: ({ row }) => {
          const st = row.original.approval_status;
          return (
            <Badge
              variant={
                st === "APPROVED"
                  ? "success"
                  : st === "REJECTED"
                    ? "destructive"
                    : "warning"
              }
            >
              {st}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="teal"
                onClick={() => void handleApproval(u.id, "APPROVED")}
              >
                <Check className="size-3" /> Approve
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <X className="size-3" /> Reject
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject {u.role} Application?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {u.name} ({u.organization}) will remain restricted to Customer list pricing only.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleApproval(u.id, "REJECTED")}
                    >
                      Confirm Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [handleApproval]
  );

  const customerColumns = useMemo<LegacyColumnDef<AdminUserRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-bold text-[#153C66]">{row.original.name}</span>
        ),
      },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "organization", header: "Organization" },
      {
        accessorKey: "created_at",
        header: "Joined",
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString("en-IN"),
      },
    ],
    []
  );

  const productColumns = useMemo<LegacyColumnDef<AdminProductRow, unknown>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-semibold text-[#12878F]">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Product Name",
        cell: ({ row }) => (
          <span className="font-semibold text-[#153C66]">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "customer_price_inr",
        header: "Customer ₹",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.customer_price_inr !== null
              ? formatInr(row.original.customer_price_inr)
              : "Quote"}
          </span>
        ),
      },
      {
        accessorKey: "dealer_price_inr",
        header: "Dealer ₹",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.dealer_price_inr !== null
              ? formatInr(row.original.dealer_price_inr)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "distributor_price_inr",
        header: "Distributor ₹",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.distributor_price_inr !== null
              ? formatInr(row.original.distributor_price_inr)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "stock_qty",
        header: "Stock",
        cell: ({ row }) => (
          <Badge variant={row.original.stock_qty <= 10 ? "warning" : "secondary"}>
            {row.original.stock_qty}
          </Badge>
        ),
      },
      {
        id: "edit",
        header: "Edit",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline-navy"
            onClick={() => setEditingProd(row.original)}
          >
            <Pencil className="size-3" /> Edit
          </Button>
        ),
      },
    ],
    []
  );

  const orderColumns = useMemo<LegacyColumnDef<AdminOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Order #",
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="font-bold text-[#153C66] hover:text-[#12878F] hover:underline"
          >
            {row.original.order_number}
          </Link>
        ),
      },
      {
        accessorKey: "customer_name",
        header: "Buyer / Tier",
        cell: ({ row }) => (
          <span>
            {row.original.customer_name} ({row.original.price_tier_applied})
          </span>
        ),
      },
      {
        accessorKey: "total_inr",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">
            {formatInr(row.original.total_inr)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant="default">{row.original.status}</Badge>,
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ row }) => (
          <Badge variant="teal">{row.original.payment_status}</Badge>
        ),
      },
      {
        id: "action",
        header: "Action",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="teal"
            onClick={() => setEditingOrder(row.original)}
          >
            <SlidersHorizontal className="size-3" /> Manage
          </Button>
        ),
      },
    ],
    []
  );

  const paymentColumns = useMemo<LegacyColumnDef<AdminPaymentRow, unknown>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Order #",
        cell: ({ row }) => (
          <span className="font-bold text-[#153C66]">{row.original.order_number}</span>
        ),
      },
      {
        accessorKey: "provider_order_id",
        header: "Razorpay Order ID",
        cell: ({ row }) => (
          <span className="font-mono text-[11px]">{row.original.provider_order_id}</span>
        ),
      },
      {
        accessorKey: "provider_payment_id",
        header: "Payment ID",
        cell: ({ row }) => (
          <span className="font-mono text-[11px]">
            {row.original.provider_payment_id || "—"}
          </span>
        ),
      },
      {
        accessorKey: "amount_paise",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-bold tabular-nums">
            {formatInr(row.original.amount_paise / 100)}
          </span>
        ),
      },
      {
        accessorKey: "signature_verified",
        header: "Verified",
        cell: ({ row }) =>
          row.original.signature_verified ? (
            <Badge variant="success">HMAC Verified</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant="teal">{row.original.status}</Badge>,
      },
    ],
    []
  );

  const enquiryColumns = useMemo<LegacyColumnDef<AdminEnquiryRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Contact",
        cell: ({ row }) => {
          const enq = row.original;
          return (
            <div>
              <strong className="text-[#153C66]">{enq.name}</strong>
              <span className="block text-[#7B8896]">
                {enq.phone} {enq.email}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "division",
        header: "Division / Source",
        cell: ({ row }) => (
          <span>
            {row.original.division} ({row.original.source})
          </span>
        ),
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="block max-w-xs text-[#7B8896] line-clamp-2">
            {row.original.notes || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => {
          const enq = row.original;
          return (
            <div className="w-36">
              <Select
                value={enq.status}
                onValueChange={(val) => void handleEnquiryStatus(enq.id, val)}
              >
                <SelectTrigger size="sm" aria-label="Update enquiry status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="IN_REVIEW">IN_REVIEW</SelectItem>
                  <SelectItem value="QUOTED">QUOTED</SelectItem>
                  <SelectItem value="CLOSED">CLOSED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
    ],
    [handleEnquiryStatus]
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 bg-[#F4F6F9] py-12 sm:py-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Admin Console" }]}
          />

          {authLoading || loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          ) : session?.role !== "ADMIN" ? (
            <Card className="mx-auto max-w-lg p-10 text-center">
              <div className="space-y-4">
                <Badge variant="default">
                  <Shield className="size-3" /> 403 · Admin Authorization Required
                </Badge>
                <h1 className="font-display text-2xl font-bold text-[#153C66]">
                  Restricted Operations Console
                </h1>
                <p className="text-sm text-[#7B8896]">
                  Only authenticated administrators may approve Distributor/Dealer
                  applications, manage role-based pricing, or update orders.
                </p>
                <Button asChild size="lg">
                  <Link href="/login?role=admin">Admin Sign In →</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Badge variant="teal">Sai Ajantha EDMS &amp; Operations</Badge>
                  <h1 className="mt-2 font-display text-3xl font-extrabold text-[#153C66]">
                    Administrator Dashboard
                  </h1>
                </div>
                <Button
                  type="button"
                  variant="outline-navy"
                  onClick={() => void loadOverview()}
                >
                  <RefreshCw className="size-3.5" /> Refresh Live Data
                </Button>
              </div>

              {/* Reports KPI Strip */}
              {data?.reports && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-5 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#12878F]">
                      Pending Wholesale Apps
                    </p>
                    <p className="font-display text-3xl font-extrabold text-[#153C66]">
                      {data.reports.pendingApplications}
                    </p>
                  </Card>
                  <Card className="p-5 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8896]">
                      Paid Order Revenue
                    </p>
                    <p className="font-display text-3xl font-extrabold text-[#153C66] tabular-nums">
                      {formatInr(data.reports.paidRevenueInr)}
                    </p>
                  </Card>
                  <Card className="p-5 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8896]">
                      Total Orders / SKUs
                    </p>
                    <p className="font-display text-3xl font-extrabold text-[#153C66]">
                      {data.reports.totalOrders} / {data.reports.totalProducts}
                    </p>
                  </Card>
                  <Card className="p-5 gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#12878F]">
                      Low Stock (&le;10) / Open Enquiries
                    </p>
                    <p className="font-display text-3xl font-extrabold text-[#153C66]">
                      {(data.products || []).filter((p) => p.stock_qty <= 10).length} /{" "}
                      {(data.enquiries || []).filter((e) => e.status === "NEW" || e.status === "IN_REVIEW").length}
                    </p>
                    <p className="text-[11px] text-[#7B8896]">
                      Total SKUs: {data.reports.totalProducts} · Total Enquiries: {data.reports.totalEnquiries}
                    </p>
                  </Card>
                </div>
              )}

              {/* Operations Tabs & TanStack DataTables */}
              <Tabs
                value={tab}
                onValueChange={(val) => setTab(val as AdminTab)}
              >
                <TabsList className="h-auto flex-wrap justify-start gap-1.5 bg-transparent border-0 p-0">
                  <TabsTrigger
                    value="applications"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Distributor &amp; Dealer Apps ({wholesaleUsers.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="customers"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Customers ({customerUsers.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="products"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Products &amp; Pricing ({data?.products.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="orders"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Orders ({data?.orders.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="payments"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Payments ({data?.payments.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="enquiries"
                    className="border border-[#C6CAD5] bg-white"
                  >
                    Enquiries ({data?.enquiries.length ?? 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="applications" className="mt-4">
                  <DataTable
                    columns={applicationColumns}
                    data={wholesaleUsers}
                    searchPlaceholder="Filter applications by name, firm, email, or GSTIN..."
                    emptyMessage="No Distributor or Dealer applications yet."
                  />
                </TabsContent>

                <TabsContent value="customers" className="mt-4">
                  <DataTable
                    columns={customerColumns}
                    data={customerUsers}
                    searchPlaceholder="Filter customers by name, email, or firm..."
                    emptyMessage="No registered customer accounts yet."
                  />
                </TabsContent>

                <TabsContent value="products" className="mt-4">
                  <DataTable
                    columns={productColumns}
                    data={data?.products || []}
                    searchPlaceholder={`Filter all ${data?.products.length ?? 281} SKUs by SKU code or product name...`}
                    pageSize={20}
                  />
                </TabsContent>

                <TabsContent value="orders" className="mt-4">
                  <DataTable
                    columns={orderColumns}
                    data={filteredOrders}
                    searchPlaceholder="Filter orders by order #, buyer, or status..."
                    emptyMessage="No orders match the selected criteria."
                    toolbarExtra={
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              <CalendarIcon className="size-3.5 text-[#12878F]" />
                              {orderDateFilter
                                ? `From ${format(orderDateFilter, "dd MMM yyyy")}`
                                : "Filter by Order Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={orderDateFilter}
                              onSelect={setOrderDateFilter}
                            />
                          </PopoverContent>
                        </Popover>
                        {orderDateFilter && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setOrderDateFilter(undefined)}
                          >
                            Clear Date
                          </Button>
                        )}
                      </div>
                    }
                  />
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <DataTable
                    columns={paymentColumns}
                    data={data?.payments || []}
                    searchPlaceholder="Filter Razorpay order or payment IDs..."
                    emptyMessage="No Razorpay transactions recorded yet."
                  />
                </TabsContent>

                <TabsContent value="enquiries" className="mt-4">
                  <DataTable
                    columns={enquiryColumns}
                    data={data?.enquiries || []}
                    searchPlaceholder="Filter enquiries by contact, division, or notes..."
                    emptyMessage="No enquiries logged yet."
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>

      {/* Edit Product Pricing & Stock Dialog */}
      <Dialog
        open={Boolean(editingProd)}
        onOpenChange={(open) => !open && setEditingProd(null)}
      >
        <DialogContent className="max-w-md">
          {editingProd && (
            <form onSubmit={handleSaveProduct} noValidate className="space-y-4">
              <DialogHeader>
                <DialogTitle>Edit {editingProd.sku}</DialogTitle>
                <DialogDescription>{editingProd.name}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="Customer ₹">
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProd.customer_price_inr ?? ""}
                    onChange={(e) =>
                      setEditingProd({
                        ...editingProd,
                        customer_price_inr: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </FormField>
                <FormField label="Dealer ₹">
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProd.dealer_price_inr ?? ""}
                    onChange={(e) =>
                      setEditingProd({
                        ...editingProd,
                        dealer_price_inr: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </FormField>
                <FormField label="Distributor ₹">
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProd.distributor_price_inr ?? ""}
                    onChange={(e) =>
                      setEditingProd({
                        ...editingProd,
                        distributor_price_inr: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </FormField>
              </div>

              <FormField label="Inventory Stock Qty">
                <Input
                  type="number"
                  value={editingProd.stock_qty}
                  onChange={(e) =>
                    setEditingProd({
                      ...editingProd,
                      stock_qty: Number(e.target.value) || 0,
                    })
                  }
                />
              </FormField>

              <div className="flex items-center justify-between rounded-xl border border-[#C6CAD5] bg-[#F4F6F9] px-3.5 py-2.5">
                <Label htmlFor="prod-approved-switch">Approved Spec Sheet</Label>
                <Switch
                  id="prod-approved-switch"
                  checked={Boolean(editingProd.approved)}
                  onCheckedChange={(checked) =>
                    setEditingProd({
                      ...editingProd,
                      approved: checked ? 1 : 0,
                    })
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingProd(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Order Status & Dispatch Dialog */}
      <Dialog
        open={Boolean(editingOrder)}
        onOpenChange={(open) => !open && setEditingOrder(null)}
      >
        <DialogContent className="max-w-md">
          {editingOrder && (
            <form onSubmit={handleSaveOrder} noValidate className="space-y-4">
              <DialogHeader>
                <DialogTitle>Manage Order {editingOrder.order_number}</DialogTitle>
                <DialogDescription>
                  Update dispatch status, carrier tracking reference, or refund state.
                </DialogDescription>
              </DialogHeader>

              <FormField label="Order Status">
                <Select
                  value={editingOrder.status}
                  onValueChange={(val) =>
                    setEditingOrder({ ...editingOrder, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "PENDING_PAYMENT",
                      "BOQ_QUOTE_REQUESTED",
                      "CONFIRMED_TRADE_PO",
                      "CONFIRMED",
                      "PROCESSING",
                      "DISPATCHED",
                      "DELIVERED",
                      "CANCELLED",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Shipping Carrier">
                <Input
                  type="text"
                  value={editingOrder.shipping_carrier ?? ""}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      shipping_carrier: e.target.value,
                    })
                  }
                  placeholder="e.g. ABT Parcel / TCI Freight"
                />
              </FormField>

              <FormField label="LR / Waybill Reference">
                <Input
                  type="text"
                  value={editingOrder.tracking_reference ?? ""}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      tracking_reference: e.target.value,
                    })
                  }
                  placeholder="Waybill or LR number"
                />
              </FormField>

              <FormField label="Refund Status">
                <Select
                  value={editingOrder.refund_status}
                  onValueChange={(val) =>
                    setEditingOrder({ ...editingOrder, refund_status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">NONE</SelectItem>
                    <SelectItem value="REFUND_REQUESTED">REFUND_REQUESTED</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingOrder(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="teal">
                  Update Order
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
