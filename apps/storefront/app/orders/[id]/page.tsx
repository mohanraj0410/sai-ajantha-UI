"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  FileText,
  MapPin,
  Printer,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import {
  CommercialGateBanner,
  EmptyStatePanel,
  SectionCard,
  StatusTag,
  WorkflowStepper,
} from "@/components/non-home/PortalPrimitives";
import { useStore } from "@/components/StoreProvider";
import { BRAND_CONTACT } from "@/lib/brand";
import {
  formatInr,
  getOrderStatusMeta,
  type PortalOrderRecord,
} from "@/lib/portal-helpers";

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const { session, showToast } = useStore();

  const [order, setOrder] = useState<PortalOrderRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnRef, setReturnRef] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId || !session) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to load this order.");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network error loading order details.");
    } finally {
      setLoading(false);
    }
  }, [orderId, session]);

  useEffect(() => {
    if (!orderId || !session) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "Unable to load this order.");
          return;
        }
        setError("");
        setOrder(data.order);
      } catch {
        if (active) setError("Network error loading order details.");
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId, session]);

  async function handleCancelOrder() {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by account holder via storefront." }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to cancel this order.");
        return;
      }
      setConfirmCancelOpen(false);
      showToast("Order cancelled.");
      await fetchOrder();
    } catch {
      showToast("Network error while cancelling order.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleRequestReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!order || !returnReason.trim()) return;
    setReturnSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email,
          division: `Return Request: ${order.order_number}`,
          notes: `Return & inspection request for order ${order.order_number}. Reason: ${returnReason.trim()}. Seller inspection required prior to restocking or credit approval.`,
          source: "return-inspection-request",
        }),
      });
      const d = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !d.id) {
        showToast(d.error || "Unable to submit return request.");
        return;
      }
      setReturnRef(d.id);
      setReturnOpen(false);
      setReturnReason("");
      showToast("Return inspection request submitted.");
    } catch {
      showToast("Network error submitting return request.");
    } finally {
      setReturnSubmitting(false);
    }
  }

  const statusUpper = (order?.status || "").toUpperCase();
  const canCancel =
    order &&
    !["CANCELLED", "DELIVERED", "COMPLETED", "DISPATCHED"].includes(statusUpper);

  const stepperSteps = [
    {
      label: "Order Logged",
      detail: order ? new Date(order.created_at).toLocaleDateString("en-IN") : "",
      state: "done" as const,
    },
    {
      label: "Commercial Verification",
      detail: order?.payment_method || "Offline / Trade PO",
      state:
        statusUpper === "QUOTE_REQUESTED"
          ? ("active" as const)
          : statusUpper === "CANCELLED"
            ? ("upcoming" as const)
            : ("done" as const),
    },
    {
      label: "Dispatch & Transit",
      detail: order?.tracking_reference || "Awaiting dispatch",
      state:
        statusUpper === "DISPATCHED" || statusUpper === "IN_TRANSIT"
          ? ("active" as const)
          : statusUpper === "DELIVERED" || statusUpper === "COMPLETED"
            ? ("done" as const)
            : ("upcoming" as const),
    },
    {
      label: "Delivered",
      detail: "Site receipt confirmed",
      state:
        statusUpper === "DELIVERED" || statusUpper === "COMPLETED"
          ? ("done" as const)
          : ("upcoming" as const),
    },
  ];

  return (
    <StorefrontSurface family="account">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="Order Document"
            title={order ? `Order ${order.order_number}` : "Order Details"}
            description="Non-statutory order summary & proforma reference. Official GST tax invoices are issued upon dispatch confirmation."
            parents={[
              { label: "Account", href: "/account" },
              { label: "Orders", href: "/orders" },
            ]}
            actions={
              order && (
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                  >
                    <Printer className="size-3.5" />
                    Print Proforma
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setConfirmCancelOpen(true)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      Cancel Order
                    </button>
                  )}
                </div>
              )
            }
          />

          <div className="sa-content-width py-7 sm:py-9 space-y-6">
            {!session ? (
              <EmptyStatePanel
                icon={<FileText className="size-5" />}
                title="Sign in to inspect this order"
                description="Order documents and tracking details are accessible only to the authenticated account holder."
                primaryAction={{ label: "Sign In", href: `/login?next=/orders/${orderId || ""}` }}
              />
            ) : loading ? (
              <div className="sa-card p-8 text-center text-sm text-[#5D6F82]">
                Loading order details...
              </div>
            ) : error || !order ? (
              <EmptyStatePanel
                icon={<FileText className="size-5" />}
                title="Order not found"
                description={error || "We could not locate this order under your account."}
                primaryAction={{ label: "Back to Orders", href: "/orders" }}
              />
            ) : (
              <>
                {returnRef && (
                  <CommercialGateBanner
                    tone="info"
                    title="Return Inspection Request Logged"
                    description={`Reference ${returnRef} has been recorded. Our Trichy desk will review and coordinate inspection steps.`}
                  />
                )}

                {confirmCancelOpen && (
                  <div className="rounded-xl border border-[#F5B8B8] bg-[#FEF2F2] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-[#7F1D1D]">
                      <p className="font-bold">Confirm Order Cancellation</p>
                      <p className="mt-0.5">
                        Are you sure you want to cancel {order.order_number}? This action updates the
                        order record immediately.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelOpen(false)}
                        className="min-h-[38px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs font-semibold text-[#0B1F35] cursor-pointer"
                      >
                        Keep Order
                      </button>
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={handleCancelOrder}
                        className="min-h-[38px] rounded-lg bg-[#B91C1C] px-3.5 text-xs font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60 cursor-pointer"
                      >
                        {cancelling ? "Cancelling..." : "Yes, Cancel Order"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Header Strip */}
                <div className="sa-card p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StatusTag
                        label={getOrderStatusMeta(order.status).label}
                        tone={getOrderStatusMeta(order.status).tone}
                      />
                      <StatusTag
                        label={getOrderStatusMeta(order.payment_status).label}
                        tone={getOrderStatusMeta(order.payment_status).tone}
                      />
                      <span className="text-xs font-semibold text-[#526477]">
                        Tier: <strong className="text-[#0B1F35]">{order.price_tier_applied}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-[#5D6F82]">
                      Recorded{" "}
                      {new Date(order.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  <WorkflowStepper steps={stepperSteps} />
                </div>

                {/* Party & Logistics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard kicker="Buyer & Delivery" title={order.customer_name}>
                    <dl className="space-y-2 text-xs text-[#3D4F63]">
                      {order.organization && (
                        <div>
                          <dt className="text-[#64748B]">Organization</dt>
                          <dd className="font-semibold text-[#0B1F35]">{order.organization}</dd>
                        </div>
                      )}
                      {order.gstin && (
                        <div>
                          <dt className="text-[#64748B]">GSTIN</dt>
                          <dd className="font-mono font-semibold text-[#0B1F35]">{order.gstin}</dd>
                        </div>
                      )}
                      <div className="flex items-start gap-2 pt-1">
                        <MapPin className="size-4 text-[#076864] shrink-0 mt-0.5" />
                        <span>{order.shipping_address || "Trichy pickup / site delivery"}</span>
                      </div>
                      <p className="text-[#5D6F82]">
                        {order.customer_email} · {order.customer_phone}
                      </p>
                    </dl>
                  </SectionCard>

                  <SectionCard kicker="Supplier & Dispatch" title={BRAND_CONTACT.companyName}>
                    <dl className="space-y-2 text-xs text-[#3D4F63]">
                      <p>{BRAND_CONTACT.address}</p>
                      <p>
                        Contact: <strong>{BRAND_CONTACT.phone}</strong> · {BRAND_CONTACT.email}
                      </p>
                      <div className="pt-2 border-t border-[#EDF2F7] flex items-center gap-2">
                        <Truck className="size-4 text-[#076864]" />
                        <span>
                          {order.tracking_reference
                            ? `${order.shipping_carrier || "Logistics"}: ${order.tracking_reference}`
                            : "Dispatch & courier reference will appear once shipped."}
                        </span>
                      </div>
                    </dl>
                  </SectionCard>
                </div>

                {/* Line Items Table */}
                <SectionCard kicker="Line Items" title="Ordered Specifications" padded={false}>
                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>SKU &amp; Item</th>
                          <th>Finish / Pack</th>
                          <th className="text-right">Unit Rate</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((line, i) => (
                          <tr key={line.id || `${line.sku}-${i}`}>
                            <td>
                              <p className="font-semibold text-[#0B1F35]">{line.name}</p>
                              <p className="font-mono text-[11px] text-[#64748B]">
                                {line.sku}
                                {line.category ? ` · ${line.category}` : ""}
                              </p>
                            </td>
                            <td className="text-xs text-[#526477]">
                              {line.finish || "Standard"} · {line.pack_label || "1 unit"}
                            </td>
                            <td className="text-right text-xs sa-tabular">
                              {formatInr(line.unit_price_inr)}
                            </td>
                            <td className="text-right font-bold sa-tabular">{line.quantity}</td>
                            <td className="text-right font-bold text-[#0B1F35] sa-tabular">
                              {formatInr(line.line_total_inr)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Summary Footer */}
                  <div className="p-5 sm:p-6 bg-[#FAFBFD] border-t border-[#E7EEF4] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="text-xs text-[#5D6F82] max-w-md space-y-1">
                      <p className="font-semibold text-[#0B1F35]">
                        Proforma / Order Summary (Non-Statutory)
                      </p>
                      <p>
                        Official GST tax invoice is issued by the fulfilling seller upon dispatch
                        and settlement confirmation.
                      </p>
                      {order.notes && <p className="pt-1 text-[#3D4F63]">Notes: {order.notes}</p>}
                    </div>
                    <dl className="w-full sm:w-64 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-[#5D6F82]">Subtotal</dt>
                        <dd className="font-semibold text-[#0B1F35] sa-tabular">
                          {formatInr(order.subtotal_inr)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#5D6F82]">Estimated GST</dt>
                        <dd className="font-semibold text-[#0B1F35] sa-tabular">
                          {formatInr(order.gst_amount_inr)}
                        </dd>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-[#DCE5EE] text-sm">
                        <dt className="font-bold text-[#0B1F35]">Total</dt>
                        <dd className="font-bold text-[#076864] sa-tabular">
                          {formatInr(order.total_inr)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </SectionCard>

                {/* Activity Timeline + Return Request */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
                  <SectionCard
                    className="lg:col-span-7"
                    kicker="Audit Trail"
                    title="Order Activity Log"
                  >
                    {!order.events || order.events.length === 0 ? (
                      <p className="text-xs text-[#5D6F82]">No activity updates recorded yet.</p>
                    ) : (
                      <ol className="space-y-3">
                        {order.events.map((ev) => (
                          <li
                            key={ev.id}
                            className="flex items-start gap-3 text-xs border-b border-[#EDF2F7] pb-3 last:border-none last:pb-0"
                          >
                            <Clock className="size-4 text-[#076864] shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-[#0B1F35]">
                                {getOrderStatusMeta(ev.status).label}
                              </p>
                              <p className="text-[#526477] mt-0.5">{ev.note}</p>
                              <p className="text-[11px] text-[#7B8FA3] mt-0.5">
                                {ev.actor_name} ·{" "}
                                {new Date(ev.created_at).toLocaleString("en-IN")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </SectionCard>

                  <SectionCard
                    className="lg:col-span-5"
                    kicker="After-Sales"
                    title="Return or Transit Damage Support"
                  >
                    {!returnOpen ? (
                      <div className="space-y-3 text-xs text-[#526477]">
                        <p className="leading-relaxed">
                          Need to report a transit discrepancy or request a return inspection?
                          Log a return request directly against this order reference.
                        </p>
                        <button
                          type="button"
                          onClick={() => setReturnOpen(true)}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-4 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                        >
                          <RotateCcw className="size-3.5" />
                          Request Return Inspection
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleRequestReturn} className="space-y-3">
                        <textarea
                          rows={3}
                          required
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          placeholder="Describe the SKU, carton condition, or discrepancy..."
                          className="w-full rounded-xl border border-[#C5D3E0] p-3 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={returnSubmitting}
                            className="min-h-[38px] rounded-lg bg-[#076864] px-4 text-xs font-semibold text-white cursor-pointer"
                          >
                            {returnSubmitting ? "Submitting..." : "Submit Request"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReturnOpen(false)}
                            className="min-h-[38px] rounded-lg border border-[#C5D3E0] px-3 text-xs font-semibold text-[#526477] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </SectionCard>
                </div>

                <div className="print:hidden">
                  <Link
                    href="/orders"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#076864] hover:underline"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back to All Orders
                  </Link>
                </div>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA]" />}>
      <OrderDetailContent />
    </Suspense>
  );
}
