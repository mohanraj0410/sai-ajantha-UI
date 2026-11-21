"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Package, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import {
  EmptyStatePanel,
  KpiStatRow,
  SectionCard,
  StatusTag,
} from "@/components/non-home/PortalPrimitives";
import { useStore } from "@/components/StoreProvider";
import {
  formatInr,
  getOrderStatusMeta,
  summarizeOrders,
  type PortalOrderRecord,
} from "@/lib/portal-helpers";

export default function OrdersPage() {
  const { session, authLoading } = useStore();
  const [orders, setOrders] = useState<PortalOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "QUOTES" | "DELIVERED" | "CANCELLED">("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function loadOrders() {
      setLoading(true);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (active && res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch {
        // Handled cleanly via empty state
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrders();
    return () => {
      active = false;
    };
  }, [session]);

  const summary = useMemo(() => summarizeOrders(orders), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((ord) => {
      const s = (ord.status || "").toUpperCase();
      if (filter === "QUOTES" && s !== "QUOTE_REQUESTED") return false;
      if (filter === "DELIVERED" && s !== "DELIVERED" && s !== "COMPLETED") return false;
      if (filter === "CANCELLED" && s !== "CANCELLED" && s !== "REJECTED") return false;
      if (
        filter === "ACTIVE" &&
        (s === "QUOTE_REQUESTED" || s === "DELIVERED" || s === "COMPLETED" || s === "CANCELLED" || s === "REJECTED")
      ) {
        return false;
      }
      if (!q) return true;
      return (
        ord.order_number.toLowerCase().includes(q) ||
        (ord.organization || "").toLowerCase().includes(q) ||
        (ord.payment_method || "").toLowerCase().includes(q)
      );
    });
  }, [orders, filter, query]);

  return (
    <StorefrontSurface family="account">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="Order Management"
            title="Orders & Tracking"
            description="Monitor confirmed orders, Trade POs, BOQ quotation requests, and dispatch references."
            parents={[{ label: "Account", href: "/account" }]}
            actions={
              <Link
                href="/products"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] transition-colors"
              >
                Browse Catalogue
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />

          <div className="sa-content-width py-7 sm:py-9 space-y-6">
            {authLoading ? (
              <div className="sa-card p-8 text-center text-sm text-[#5D6F82]">
                Loading order session...
              </div>
            ) : !session ? (
              <EmptyStatePanel
                icon={<Package className="size-5" />}
                title="Sign in to view your orders"
                description="Your order history, printable proformas, and dispatch tracking are protected under your Sai Ajantha account."
                primaryAction={{ label: "Sign In", href: "/login?next=/orders" }}
                secondaryAction={{ label: "Create Account", href: "/register" }}
              />
            ) : (
              <>
                <KpiStatRow
                  items={[
                    { label: "Total Records", value: summary.totalCount, detail: "Orders & quotes" },
                    { label: "Active / Processing", value: summary.activeCount, detail: "In progress" },
                    { label: "Quotation Requests", value: summary.quoteCount, detail: "BOQ quotes" },
                    {
                      label: "Cumulative Value",
                      value: formatInr(summary.totalValueInr),
                      detail: "Excluding cancelled",
                      accent: true,
                    },
                  ]}
                />

                <SectionCard
                  kicker="Records"
                  title="Order History"
                  padded={false}
                >
                  <div className="p-4 sm:p-5 border-b border-[#E7EEF4] bg-[#FAFBFD] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(["ALL", "ACTIVE", "QUOTES", "DELIVERED", "CANCELLED"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setFilter(tab)}
                          className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                            filter === tab
                              ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                              : "border-[#DCE5EE] bg-white text-[#475569] hover:border-[#076864]"
                          }`}
                        >
                          {tab === "ALL" ? `All (${orders.length})` : tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                    <div className="relative w-full md:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search order number..."
                        aria-label="Search orders"
                        className="w-full min-h-[40px] rounded-xl border border-[#C5D3E0] bg-white pl-9 pr-3 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-6 text-xs text-[#5D6F82]">Loading orders...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6">
                      <EmptyStatePanel
                        icon={<Package className="size-5" />}
                        title="No orders found"
                        description={
                          orders.length === 0
                            ? "You haven't placed any orders yet. Explore our verified catalogue to start an order or quotation."
                            : "No orders matched the current filter or search term."
                        }
                        primaryAction={
                          orders.length === 0
                            ? { label: "Explore Products", href: "/products" }
                            : {
                                label: "Reset Filters",
                                onClick: () => {
                                  setFilter("ALL");
                                  setQuery("");
                                },
                              }
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>Order Ref</th>
                              <th>Date</th>
                              <th>Tier</th>
                              <th>Status</th>
                              <th>Payment</th>
                              <th className="text-right">Total</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((ord) => {
                              const st = getOrderStatusMeta(ord.status);
                              const pay = getOrderStatusMeta(ord.payment_status);
                              return (
                                <tr key={ord.id}>
                                  <td className="font-mono text-xs font-bold text-[#0B1F35]">
                                    {ord.order_number}
                                  </td>
                                  <td className="text-xs text-[#5D6F82]">
                                    {new Date(ord.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td className="text-xs font-semibold">{ord.price_tier_applied}</td>
                                  <td>
                                    <StatusTag label={st.label} tone={st.tone} compact />
                                  </td>
                                  <td>
                                    <StatusTag label={pay.label} tone={pay.tone} compact />
                                  </td>
                                  <td className="text-right font-bold sa-tabular">
                                    {formatInr(ord.total_inr)}
                                  </td>
                                  <td className="text-right">
                                    <Link
                                      href={`/orders/${ord.id}`}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#076864] hover:underline"
                                    >
                                      Inspect
                                      <ExternalLink className="size-3" />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="md:hidden divide-y divide-[#E7EEF4]">
                        {filtered.map((ord) => {
                          const st = getOrderStatusMeta(ord.status);
                          return (
                            <div key={ord.id} className="p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                  {ord.order_number}
                                </span>
                                <StatusTag label={st.label} tone={st.tone} compact />
                              </div>
                              <div className="flex items-center justify-between text-xs text-[#5D6F82]">
                                <span>{new Date(ord.created_at).toLocaleDateString("en-IN")}</span>
                                <span className="font-bold text-[#0B1F35] sa-tabular">
                                  {formatInr(ord.total_inr)}
                                </span>
                              </div>
                              <Link
                                href={`/orders/${ord.id}`}
                                className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-semibold text-[#076864]"
                              >
                                View Order Details
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </SectionCard>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
