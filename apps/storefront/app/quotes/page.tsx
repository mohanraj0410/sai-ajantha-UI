"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, FileText, Phone } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import {
  CommercialGateBanner,
  EmptyStatePanel,
  SectionCard,
  StatusTag,
} from "@/components/non-home/PortalPrimitives";
import { useStore } from "@/components/StoreProvider";
import { BRAND_CONTACT } from "@/lib/brand";
import { formatInr, type PortalOrderRecord } from "@/lib/portal-helpers";

export default function QuotesPage() {
  const { session, showToast } = useStore();
  const [quotes, setQuotes] = useState<PortalOrderRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    organization: "",
    city: "Trichy",
    division: "Hydraulic Floor Springs & Door Controls",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function loadQuotes() {
      setLoading(true);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!active) return;
        setForm((prev) => ({
          ...prev,
          name: prev.name || session?.name || "",
          phone: prev.phone || session?.phone || "",
          email: prev.email || session?.email || "",
          organization: prev.organization || session?.organization || "",
          city: prev.city || session?.businessCity || "Trichy",
        }));
        if (res.ok) {
          const data = await res.json();
          const all: PortalOrderRecord[] = data.orders || [];
          setQuotes(
            all.filter((o) => (o.status || "").toUpperCase() === "QUOTE_REQUESTED")
          );
        }
      } catch {
        // Handled cleanly
      } finally {
        if (active) setLoading(false);
      }
    }
    loadQuotes();
    return () => {
      active = false;
    };
  }, [session]);

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      showToast("Full name and mobile number are required.");
      return;
    }
    setSubmitting(true);
    setSubmittedRef(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: session?.role || "Buyer / Project Specifier",
          notes: `[BOQ Quotation Desk] ${form.notes || "Requested formal BOQ quotation."}`,
          source: "quotes-page",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to submit quotation request.");
        return;
      }
      setSubmittedRef(data.id || "Logged");
      setForm((prev) => ({ ...prev, notes: "" }));
      showToast("Quotation request logged with our Trichy desk.");
    } catch {
      showToast("Network error submitting quotation request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StorefrontSurface family="account">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="Project & Trade Pricing"
            title="BOQ & Quotation Desk"
            description="Submit custom door schedules, Hydraulic Floor Spring specifications, or bulk multi-SKU requirements. Quotations do not reserve inventory."
            parents={[{ label: "Products", href: "/products" }]}
            actions={
              <a
                href={BRAND_CONTACT.phoneHref}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-4 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
              >
                <Phone className="size-3.5 text-[#076864]" />
                {BRAND_CONTACT.phone}
              </a>
            }
          />

          <div className="sa-content-width py-7 sm:py-9 space-y-6">
            <CommercialGateBanner
              tone="info"
              title="Quotation & Inventory Policy"
              description="Submitting a quotation request logs your BOQ with our Trichy trade desk or assigned regional distributor without reserving warehouse stock. Final rates and dispatch schedules are confirmed upon quote acceptance."
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Submit New BOQ Quotation */}
              <SectionCard
                className="lg:col-span-7"
                kicker="New Request"
                title="Request a Formal BOQ Quotation"
                description="Share SKU codes, quantities, finish preferences, or 6-digit delivery PIN."
              >
                {submittedRef && (
                  <div className="mb-5 rounded-xl border border-[#A7DFD0] bg-[#E6F6F2] p-4 flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-[#065F46] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#065F46]">
                      <p className="font-bold">Quotation Request Recorded</p>
                      <p className="mt-0.5">
                        Reference ID: <strong className="font-mono">{submittedRef}</strong>. Our
                        desk will respond with a detailed quote.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="q-name" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Full Name *
                      </label>
                      <input
                        id="q-name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="q-phone" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Mobile Number *
                      </label>
                      <input
                        id="q-phone"
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="q-email" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Work / Personal Email
                      </label>
                      <input
                        id="q-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="q-org" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Firm / Project Name
                      </label>
                      <input
                        id="q-org"
                        type="text"
                        value={form.organization}
                        onChange={(e) => setForm({ ...form, organization: e.target.value })}
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="q-city" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Delivery City &amp; PIN
                      </label>
                      <input
                        id="q-city"
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="e.g. Trichy 620001"
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="q-div" className="block text-xs font-semibold text-[#354B62] mb-1">
                        Primary Category
                      </label>
                      <select
                        id="q-div"
                        value={form.division}
                        onChange={(e) => setForm({ ...form, division: e.target.value })}
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3 text-sm"
                      >
                        <option>Hydraulic Floor Springs &amp; Door Controls</option>
                        <option>Kitchen Baskets &amp; Wireware</option>
                        <option>Finished Insect Screens</option>
                        <option>Aluminium Extrusions &amp; Profiles</option>
                        <option>Architectural Hardware &amp; Fittings</option>
                        <option>Multi-Category Project BOQ</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="q-notes" className="block text-xs font-semibold text-[#354B62] mb-1">
                      SKU List, Door Weights &amp; Quantities *
                    </label>
                    <textarea
                      id="q-notes"
                      rows={4}
                      required
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="List SKU codes, counts, sizes, finishes, or required delivery timeline..."
                      className="w-full rounded-xl border border-[#C5D3E0] bg-white p-3.5 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#076864] text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? "Submitting Quotation Request..." : "Submit Quotation Request"}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              </SectionCard>

              {/* Right: Saved Quotation Orders */}
              <SectionCard
                className="lg:col-span-5"
                kicker="Your Records"
                title="Saved Checkout Quotations"
                description="BOQ quotations submitted via cart checkout appear here when signed in."
              >
                {!session ? (
                  <EmptyStatePanel
                    icon={<ClipboardList className="size-5" />}
                    title="Sign in to track saved quotes"
                    description="Sign in to view formal checkout quotations tied to your account."
                    primaryAction={{ label: "Sign In", href: "/login?next=/quotes" }}
                  />
                ) : loading ? (
                  <p className="text-xs text-[#5D6F82]">Loading saved quotations...</p>
                ) : quotes.length === 0 ? (
                  <EmptyStatePanel
                    icon={<FileText className="size-5" />}
                    title="No checkout quotes recorded"
                    description="You can submit a direct BOQ request using the form on the left, or build a multi-item quote via your shopping cart."
                    primaryAction={{ label: "Browse Products", href: "/products" }}
                  />
                ) : (
                  <div className="space-y-3">
                    {quotes.map((q) => (
                      <Link
                        key={q.id}
                        href={`/orders/${q.id}`}
                        className="block rounded-xl border border-[#DCE5EE] bg-[#FAFBFD] p-4 hover:border-[#076864] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#0B1F35]">
                            {q.order_number}
                          </span>
                          <StatusTag label="Quotation Requested" tone="warning" compact />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-[#5D6F82]">
                          <span>{new Date(q.created_at).toLocaleDateString("en-IN")}</span>
                          <span className="font-bold text-[#0B1F35] sa-tabular">
                            {formatInr(q.total_inr)}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
