"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  LayoutGrid,
  MapPin,
  Network,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  CheckCircle,
  Printer,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PortalShell, type PortalNavItem } from "@/components/non-home/PortalShell";
import {
  CommercialGateBanner,
  EmptyStatePanel,
  KpiStatRow,
  SectionCard,
  StatusTag,
} from "@/components/non-home/PortalPrimitives";
import { useStore, type SavedAddress } from "@/components/StoreProvider";
import type { ProductItem } from "@/lib/products";
import {
  filterDealerCatalog,
  formatInr,
  getApprovalStatusMeta,
  getOrderStatusMeta,
  getProductSku,
  HOUSE_OF_AJANTHA_CATEGORIES,
  isFloorSpringProduct,
  summarizeOrders,
  type PortalOrderRecord,
} from "@/lib/portal-helpers";

type DealerTab = "overview" | "catalogue" | "rfq" | "quotes" | "orders" | "sites";

interface SellerLookupResult {
  sellerType?: string;
  sellerName?: string;
  canCheckoutDirectly?: boolean;
  message?: string;
}

export default function DealerPortalPage() {
  const router = useRouter();
  const {
    session: user,
    authLoading,
    signOut: logout,
    catalogProducts,
    effectivePriceTier,
    wholesaleUnlocked,
    addToCart,
    getAuthorizedUnitPrice,
    cartCount,
    showToast,
  } = useStore();
  const authLoaded = !authLoading;

  const [activeTab, setActiveTab] = useState<DealerTab>("overview");
  const [orders, setOrders] = useState<PortalOrderRecord[]>([]);
  const [realQuotes, setRealQuotes] = useState<any[]>([]);
  const [revisionQuoteId, setRevisionQuoteId] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [respondingToQuote, setRespondingToQuote] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Wholesale Catalogue filters & quick qty map
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState<
    "ALL" | "DIRECT" | "HOUSE_OF_AJANTHA" | "ENQUIRY_ONLY"
  >("ALL");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  // Guided RFQ / BOQ Builder state
  const [rfqLines, setRfqLines] = useState<
    Array<{ product: ProductItem; qty: number }>
  >([]);
  const [rfqSearch, setRfqSearch] = useState("");
  const [rfqPincode, setRfqPincode] = useState("");
  const [rfqSellerInfo, setRfqSellerInfo] = useState<SellerLookupResult | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [rfqNotes, setRfqNotes] = useState("");
  const [submittingRfq, setSubmittingRfq] = useState(false);
  const [rfqSuccessRef, setRfqSuccessRef] = useState<string | null>(null);

  // Delivery site lookup & creation
  const [sitePin, setSitePin] = useState("");
  const [siteLookup, setSiteLookup] = useState<SellerLookupResult | null>(null);
  const [addingSite, setAddingSite] = useState(false);
  const [siteForm, setSiteForm] = useState({
    label: "Trade Warehouse / Shop",
    recipient: "",
    organization: "",
    line1: "",
    city: "Trichy",
    state: "Tamil Nadu",
    pincode: "",
    phone: "",
  });

  const isDealer = user?.role === "DEALER";
  const isApprovedDealer = isDealer && user?.approvalStatus === "APPROVED" && wholesaleUnlocked;

  useEffect(() => {
    if (!user || user.role !== "DEALER") return;
    let cancelled = false;
    async function loadDealerData() {
      setLoadingData(true);
      try {
        const [ordRes, addrRes, quoteRes] = await Promise.all([
          fetch("/api/orders", { cache: "no-store" }),
          fetch("/api/addresses", { cache: "no-store" }),
          fetch("/api/quotes", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        setSiteForm((prev) => ({
          ...prev,
          recipient: prev.recipient || user?.name || "",
          organization: prev.organization || user?.organization || "",
          phone: prev.phone || user?.phone || "",
        }));
        if (ordRes.ok) {
          const data = await ordRes.json();
          setOrders(data.orders || []);
        }
        if (addrRes.ok) {
          const data = await addrRes.json();
          setAddresses(data.addresses || []);
        }
        if (quoteRes.ok) {
          const qData = await quoteRes.json();
          setRealQuotes(qData.quotes || []);
        }
      } catch {
        // Handled silently
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    loadDealerData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleRespondQuote(
    quoteId: string,
    action: "ACCEPT" | "REJECT" | "REQUEST_REVISION",
    notes?: string
  ) {
    setRespondingToQuote(true);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to update quotation response.");
        return;
      }
      showToast(data.message || "Quotation response recorded successfully.");
      setRevisionQuoteId(null);
      setRevisionNotes("");
      const qRes = await fetch("/api/quotes", { cache: "no-store" });
      if (qRes.ok) {
        const qData = await qRes.json();
        setRealQuotes(qData.quotes || []);
      }
    } catch {
      showToast("Network error submitting response. Please try again.");
    } finally {
      setRespondingToQuote(false);
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(catalogProducts.map((p) => p.category))).sort(),
    [catalogProducts]
  );

  const filteredCatalogue = useMemo(
    () =>
      filterDealerCatalog(catalogProducts, {
        query: searchQuery,
        category: selectedCategory,
        routeFilter,
      }),
    [catalogProducts, searchQuery, selectedCategory, routeFilter]
  );

  const rfqQuickMatches = useMemo(() => {
    const q = rfqSearch.trim().toLowerCase();
    if (!q) return catalogProducts.slice(0, 6);
    return catalogProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          getProductSku(p).toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [catalogProducts, rfqSearch]);

  const orderSummary = useMemo(() => summarizeOrders(orders), [orders]);

  const channelCounts = useMemo(() => {
    let direct = 0;
    let house = 0;
    let enquiryOnly = 0;
    for (const p of catalogProducts) {
      if (isFloorSpringProduct(p)) enquiryOnly += 1;
      else if (HOUSE_OF_AJANTHA_CATEGORIES.has(p.category)) house += 1;
      else direct += 1;
    }
    return { direct, house, enquiryOnly };
  }, [catalogProducts]);

  function addProductToRfq(product: ProductItem, qty = 1) {
    setRfqLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { product, qty }];
    });
    setRfqSuccessRef(null);
    showToast(`Added ${getProductSku(product)} to RFQ builder.`);
  }

  async function verifyPinRouting(
    pin: string,
    target: "rfq" | "site"
  ) {
    const clean = pin.trim();
    if (!/^\d{6}$/.test(clean)) {
      showToast("Enter a valid 6-digit PIN code.");
      return;
    }
    setCheckingPin(true);
    try {
      const res = await fetch(
        `/api/seller-resolution?postalCode=${encodeURIComponent(clean)}&categorySlug=door-closer`
      );
      const data = await res.json();
      if (target === "rfq") setRfqSellerInfo(data);
      else setSiteLookup(data);
    } catch {
      showToast("Unable to verify PIN coverage right now.");
    } finally {
      setCheckingPin(false);
    }
  }

  async function handleSubmitRfq(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (rfqLines.length === 0) {
      showToast("Add at least one SKU to your RFQ before submitting.");
      return;
    }
    setSubmittingRfq(true);
    setRfqSuccessRef(null);
    try {
      const lineSummary = rfqLines
        .map(
          (l) =>
            `${getProductSku(l.product)} — ${l.product.name} (${l.product.category}) x ${l.qty} ${l.product.billingUnit || "unit"}`
        )
        .join("\n");

      const notes = [
        "[Dealer Trade RFQ / BOQ Submission]",
        `Dealer Tier: ${effectivePriceTier}`,
        rfqPincode ? `Delivery PIN: ${rfqPincode}` : "",
        rfqSellerInfo?.sellerName ? `Resolved Channel: ${rfqSellerInfo.sellerName}` : "",
        `Requested SKUs:\n${lineSummary}`,
        rfqNotes.trim() ? `Project Notes: ${rfqNotes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          role: "Dealer / Hardware Retailer",
          organization: user.organization || user.name,
          phone: user.phone || "",
          email: user.email,
          city: user.businessCity || "Trichy",
          division: "Dealer Trade BOQ",
          notes,
          source: "dealer-portal-rfq",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to submit RFQ right now.");
        return;
      }
      setRfqSuccessRef(data.id || "Logged");
      setRfqLines([]);
      setRfqNotes("");
      showToast("Dealer RFQ submitted to the trade desk.");
    } catch {
      showToast("Network error while submitting RFQ.");
    } finally {
      setSubmittingRfq(false);
    }
  }

  async function handleAddDeliverySite(e: React.FormEvent) {
    e.preventDefault();
    if (!siteForm.line1.trim() || !siteForm.city.trim()) {
      showToast("Address line and city are required.");
      return;
    }
    setAddingSite(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to save delivery site.");
        return;
      }
      setAddresses((prev) => [data.address, ...prev]);
      setSiteForm((prev) => ({ ...prev, line1: "", pincode: "" }));
      showToast("Delivery site saved.");
    } catch {
      showToast("Network error saving delivery site.");
    } finally {
      setAddingSite(false);
    }
  }

  async function handleRemoveSite(id: string) {
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        showToast("Delivery site removed.");
      }
    } catch {
      showToast("Unable to delete site.");
    }
  }

  const navItems: PortalNavItem[] = [
    {
      id: "overview",
      label: "Trade Overview",
      icon: <LayoutGrid className="size-4" />,
      group: "Procurement",
    },
    {
      id: "catalogue",
      label: "Wholesale Catalogue",
      icon: <FileSpreadsheet className="size-4" />,
      badge: catalogProducts.length,
      group: "Procurement",
    },
    {
      id: "rfq",
      label: "RFQ / BOQ Builder",
      icon: <ClipboardList className="size-4" />,
      badge: rfqLines.length || undefined,
      group: "Procurement",
    },
    {
      id: "quotes",
      label: "Trade Quotations",
      icon: <ClipboardList className="size-4" />,
      badge: realQuotes.filter((q) => q.status === "SHARED_NONPAYABLE").length || undefined,
      group: "Procurement",
    },
    {
      id: "orders",
      label: "Orders & Proformas",
      icon: <Package className="size-4" />,
      badge: orders.length || undefined,
      group: "Fulfillment",
    },
    {
      id: "sites",
      label: "Distributor & Sites",
      icon: <Network className="size-4" />,
      badge: addresses.length || undefined,
      group: "Fulfillment",
    },
  ];

  const approvalMeta = getApprovalStatusMeta(user?.approvalStatus);

  return (
    <StorefrontSurface family="account">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          {!authLoaded ? (
            <div className="sa-content-width py-16">
              <div className="sa-card p-8 max-w-lg mx-auto text-center space-y-3">
                <div className="mx-auto size-10 rounded-full border-2 border-[#076864] border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-[#0B1F35]">
                  Verifying dealer trade session...
                </p>
              </div>
            </div>
          ) : !user || !isDealer ? (
            <div className="sa-content-width py-12 sm:py-16">
              <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 sa-card p-6 sm:p-8 space-y-6">
                  <div className="space-y-2.5">
                    <p className="sa-group-label">B2B Trade Workspace</p>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F35] tracking-tight">
                      Dealer Procurement Portal
                    </h1>
                    <p className="text-sm text-[#526477] leading-relaxed">
                      {user
                        ? `You are currently signed in as ${user.role}. Authorized Dealer trade pricing, wholesale quick reorder, and BOQ submission tools require an approved Dealer account.`
                        : "Built for hardware retailers, fabricators, and interior trade contractors. Sign in with an approved Dealer account to unlock wholesale trade slabs and guided BOQ workflows."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        title: "Verified Trade Pricing",
                        desc: "Dealer-tier rates across 9 Sai Ajantha Direct categories and 2 House of Ajantha ranges once approved.",
                      },
                      {
                        title: "Guided RFQ / BOQ Builder",
                        desc: "Assemble multi-SKU project lists, verify delivery PIN routing, and log formal quote requests.",
                      },
                      {
                        title: "Seller-Split Order Tracking",
                        desc: "Keep Direct Sai Ajantha orders clearly separated from Regional Distributor routing.",
                      },
                      {
                        title: "Saved Site Delivery Book",
                        desc: "Store shop, godown, and active project site addresses for repeat dispatches.",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-xl border border-[#E4ECF3] bg-[#F9FBFD] p-3.5"
                      >
                        <p className="text-xs font-bold text-[#0B1F35]">{item.title}</p>
                        <p className="mt-1 text-[11px] text-[#5D6F82] leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {!user ? (
                      <>
                        <Link
                          href="/login?role=DEALER"
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0B1F35] px-5 text-sm font-semibold text-white hover:bg-[#076864] transition-colors"
                        >
                          Dealer Sign In
                          <ArrowRight className="size-4" />
                        </Link>
                        <Link
                          href="/register?role=DEALER"
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#C5D3E0] bg-white px-5 text-sm font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
                        >
                          Apply as Dealer
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={user.role === "DISTRIBUTOR" ? "/distributor" : "/account"}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0B1F35] px-5 text-sm font-semibold text-white hover:bg-[#076864] transition-colors"
                      >
                        Return to Your Portal
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-[#DCE5EE] bg-white p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <StatusTag label="Admin Verification Required" tone="warning" />
                    <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                      How Dealer Onboarding Works
                    </h2>
                    <ol className="space-y-3 text-xs text-[#526477]">
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F35] text-[10px] font-bold text-white">
                          1
                        </span>
                        <span>Submit your shop/firm details, GSTIN (if applicable), and service city.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F35] text-[10px] font-bold text-white">
                          2
                        </span>
                        <span>Our Trichy trade desk reviews and verifies your business credentials.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#076864] text-[10px] font-bold text-white">
                          3
                        </span>
                        <span>Once approved, Dealer pricing unlocks automatically across eligible SKUs.</span>
                      </li>
                    </ol>
                  </div>
                  <p className="text-[11px] text-[#64748B] border-t border-[#E7EEF4] pt-3">
                    Public retail browsing remains open while trade applications are under review.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <PortalShell
              roleTheme="dealer"
              portalLabel="Dealer Trade Portal"
              title={user.organization || user.name}
              subtitle="Wholesale procurement workspace for Sai Ajantha Direct hardware and House of Ajantha distributor-routed ranges."
              userName={user.organization || user.name}
              userMeta={`${user.name} · ${user.businessCity || "Tamil Nadu"}${user.gstin ? ` · GSTIN ${user.gstin}` : ""}`}
              statusBadge={approvalMeta}
              priceTierLabel={isApprovedDealer ? "Authorized Dealer Tier" : "Pending Tier Unlock"}
              navItems={navItems}
              activeTab={activeTab}
              onSelectTab={(id) => setActiveTab(id as DealerTab)}
              onLogout={async () => {
                await logout();
                router.push("/");
              }}
              headerActions={
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("rfq")}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#076864] px-4 text-xs font-semibold text-white hover:bg-[#05524F] transition-colors cursor-pointer"
                  >
                    <ClipboardList className="size-3.5" />
                    Build RFQ ({rfqLines.length})
                  </button>
                  <Link
                    href="/cart"
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
                  >
                    <ShoppingCart className="size-3.5" />
                    Cart ({cartCount})
                  </Link>
                </>
              }
              topBanner={
                !isApprovedDealer ? (
                  <CommercialGateBanner
                    tone={
                      user.approvalStatus === "REJECTED" || user.approvalStatus === "SUSPENDED"
                        ? "restricted"
                        : "warning"
                    }
                    title={`Dealer Account Status: ${approvalMeta.label}`}
                    description={
                      user.approvalStatus === "PENDING_APPROVAL"
                        ? "Your trade registration is awaiting admin verification. Dealer wholesale rates remain masked until approval is complete."
                        : "Wholesale pricing and trade checkout are currently unavailable for this account. Contact the Trichy trade desk for assistance."
                    }
                    action={
                      <Link
                        href="/contact"
                        className="inline-flex min-h-[38px] items-center rounded-lg border border-current/25 bg-white/80 px-3.5 text-xs font-bold"
                      >
                        Contact Trade Desk
                      </Link>
                    }
                  />
                ) : (
                  <CommercialGateBanner
                    tone="info"
                    title="Dealer Trade Pricing Active"
                    description="Direct orders across 9 Sai Ajantha categories checkout directly via Trade PO / Proforma. House of Ajantha Door Closers & Kitchen Baskets route by delivery PIN, and Hydraulic Floor Springs remain Quotation Only."
                  />
                )
              }
            >
              {/* TAB 1: TRADE OVERVIEW */}
              {activeTab === "overview" && (
                <>
                  <KpiStatRow
                    items={[
                      {
                        label: "Trade Pricing Tier",
                        value: isApprovedDealer ? "Dealer" : "Locked",
                        detail: approvalMeta.label,
                        accent: isApprovedDealer,
                      },
                      {
                        label: "Direct Catalogue",
                        value: channelCounts.direct,
                        detail: "9 Sai Ajantha direct categories",
                      },
                      {
                        label: "House of Ajantha",
                        value: channelCounts.house,
                        detail: "Door Closers & Kitchen Baskets",
                      },
                      {
                        label: "Recorded Orders",
                        value: orderSummary.totalCount,
                        detail:
                          orderSummary.totalValueInr > 0
                            ? `${formatInr(orderSummary.totalValueInr)} cumulative`
                            : "No orders placed yet",
                      },
                    ]}
                  />

                  {/* Channel Routing Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="sa-card p-5 space-y-2.5">
                      <p className="sa-group-label">Direct Supply</p>
                      <h2 className="font-display text-base font-bold text-[#0B1F35]">
                        9 Sai Ajantha Categories
                      </h2>
                      <p className="text-xs text-[#526477] leading-relaxed">
                        Aluminium profiles, insect screens, hardware fittings, FGM connectors,
                        ladders, gaskets &amp; accessories supplied directly from Trichy.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRouteFilter("DIRECT");
                          setActiveTab("catalogue");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#076864] hover:underline pt-1 cursor-pointer"
                      >
                        Browse {channelCounts.direct} Direct SKUs
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>

                    <div className="sa-card p-5 space-y-2.5">
                      <p className="sa-group-label">Regional Distributor Route</p>
                      <h2 className="font-display text-base font-bold text-[#0B1F35]">
                        House of Ajantha Ranges
                      </h2>
                      <p className="text-xs text-[#526477] leading-relaxed">
                        Door Closers &amp; Kitchen Baskets route to an authorized regional
                        distributor by 6-digit delivery PIN (quotation-led until online resale opens).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRouteFilter("HOUSE_OF_AJANTHA");
                          setActiveTab("catalogue");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#076864] hover:underline pt-1 cursor-pointer"
                      >
                        Browse {channelCounts.house} House SKUs
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>

                    <div className="sa-card p-5 space-y-2.5">
                      <p className="sa-group-label">Technical Quotation</p>
                      <h2 className="font-display text-base font-bold text-[#0B1F35]">
                        Hydraulic Floor Springs ({channelCounts.enquiryOnly})
                      </h2>
                      <p className="text-xs text-[#526477] leading-relaxed">
                        All 8 Floor Spring assemblies are supplied strictly via confirmed technical
                        quotation to verify door weight, glass cutout, and spindle spec.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRouteFilter("ENQUIRY_ONLY");
                          setActiveTab("catalogue");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#076864] hover:underline pt-1 cursor-pointer"
                      >
                        Build Floor Spring RFQ
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <SectionCard
                    kicker="Order Activity"
                    title="Recent Trade Orders & Quotes"
                    actions={
                      <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className="text-xs font-semibold text-[#076864] hover:underline cursor-pointer"
                      >
                        View all orders
                      </button>
                    }
                    padded={false}
                  >
                    {loadingData ? (
                      <div className="p-6 text-xs text-[#5D6F82]">Loading trade orders...</div>
                    ) : orders.length === 0 ? (
                      <div className="p-6">
                        <EmptyStatePanel
                          icon={<Package className="size-5" />}
                          title="No trade orders recorded yet"
                          description="Add wholesale SKUs from the Wholesale Catalogue to your cart or submit a project BOQ via the RFQ Builder."
                          primaryAction={{
                            label: "Open Wholesale Catalogue",
                            onClick: () => setActiveTab("catalogue"),
                          }}
                          secondaryAction={{
                            label: "Open RFQ Builder",
                            onClick: () => setActiveTab("rfq"),
                          }}
                        />
                      </div>
                    ) : (
                      <div className="sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>Order Ref</th>
                              <th>Date</th>
                              <th>Status</th>
                              <th className="text-right">Total</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.slice(0, 5).map((ord) => {
                              const status = getOrderStatusMeta(ord.status);
                              return (
                                <tr key={ord.id}>
                                  <td className="font-mono text-xs font-bold">{ord.order_number}</td>
                                  <td className="text-xs text-[#5D6F82]">
                                    {new Date(ord.created_at).toLocaleDateString("en-IN")}
                                  </td>
                                  <td>
                                    <StatusTag label={status.label} tone={status.tone} compact />
                                  </td>
                                  <td className="text-right font-bold sa-tabular">
                                    {formatInr(ord.total_inr)}
                                  </td>
                                  <td className="text-right">
                                    <Link
                                      href={`/orders/${ord.id}`}
                                      className="text-xs font-semibold text-[#076864] hover:underline"
                                    >
                                      Open
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </SectionCard>
                </>
              )}

              {/* TAB 2: WHOLESALE CATALOGUE & QUICK REORDER */}
              {activeTab === "catalogue" && (
                <SectionCard
                  kicker="Trade Pricing Sheet"
                  title="Wholesale Catalogue & Quick Reorder"
                  description="Search across all 281 verified SKUs by name, code, or channel route. Dealer-tier pricing appears automatically for approved accounts."
                  padded={false}
                >
                  {/* Filter Toolbar */}
                  <div className="p-4 sm:p-5 border-b border-[#E7EEF4] bg-[#FAFBFD] space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5 relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search SKU code, product name, or range..."
                          aria-label="Search dealer wholesale catalogue"
                          className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white pl-9 pr-3 text-sm text-[#0B1F35]"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <select
                          aria-label="Filter by category"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                        >
                          <option value="ALL">All Categories ({catalogProducts.length})</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3 flex items-center justify-end text-xs font-semibold text-[#526477]">
                        Showing {filteredCatalogue.length} SKU(s)
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: "ALL", label: "All Channels" },
                          { id: "DIRECT", label: "Sai Ajantha Direct" },
                          { id: "HOUSE_OF_AJANTHA", label: "House of Ajantha" },
                          { id: "ENQUIRY_ONLY", label: "Floor Springs (Quote Only)" },
                        ] as const
                      ).map((rf) => (
                        <button
                          key={rf.id}
                          type="button"
                          onClick={() => setRouteFilter(rf.id)}
                          className={`min-h-[34px] rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                            routeFilter === rf.id
                              ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                              : "border-[#DCE5EE] bg-white text-[#475569] hover:border-[#076864]"
                          }`}
                        >
                          {rf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredCatalogue.length === 0 ? (
                    <div className="p-6">
                      <EmptyStatePanel
                        icon={<Search className="size-5" />}
                        title="No matching SKUs"
                        description="Try clearing your search term or switching the channel filter."
                        primaryAction={{
                          label: "Reset Filters",
                          onClick: () => {
                            setSearchQuery("");
                            setSelectedCategory("ALL");
                            setRouteFilter("ALL");
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>SKU &amp; Product</th>
                              <th>Channel Route</th>
                              <th>Unit</th>
                              <th className="text-right">Trade Rate</th>
                              <th className="text-right">Qty &amp; Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCatalogue.slice(0, 60).map((item) => {
                              const sku = getProductSku(item);
                              const floorSpring = isFloorSpringProduct(item);
                              const isHouse = HOUSE_OF_AJANTHA_CATEGORIES.has(item.category) && !floorSpring;
                              const unitPrice = isApprovedDealer
                                ? getAuthorizedUnitPrice(item.id) ?? item.dealerPriceInr ?? item.unitPriceInr
                                : item.customerPriceInr;
                              const qty = qtyMap[item.id] ?? 1;

                              return (
                                <tr key={item.id}>
                                  <td>
                                    <Link
                                      href={`/products/${item.id}`}
                                      className="font-semibold text-[#0B1F35] hover:text-[#076864] block"
                                    >
                                      {item.name}
                                    </Link>
                                    <span className="font-mono text-[11px] text-[#64748B]">
                                      {sku} · {item.category}
                                    </span>
                                  </td>
                                  <td>
                                    {floorSpring ? (
                                      <StatusTag label="Quotation Only" tone="warning" compact />
                                    ) : isHouse ? (
                                      <StatusTag label="Distributor Routed" tone="info" compact />
                                    ) : (
                                      <StatusTag label="Sai Ajantha Direct" tone="success" compact />
                                    )}
                                  </td>
                                  <td className="text-xs text-[#526477]">{item.billingUnit || "1 unit"}</td>
                                  <td className="text-right font-bold text-[#0B1F35] sa-tabular">
                                    {floorSpring
                                      ? "Quote Only"
                                      : isApprovedDealer
                                        ? formatInr(unitPrice)
                                        : "Pending Approval"}
                                  </td>
                                  <td className="text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        aria-label={`Quantity for ${sku}`}
                                        value={qty}
                                        onChange={(e) =>
                                          setQtyMap((prev) => ({
                                            ...prev,
                                            [item.id]: Math.max(1, Number(e.target.value) || 1),
                                          }))
                                        }
                                        className="w-16 h-9 rounded-lg border border-[#C5D3E0] px-2 text-center text-xs font-bold sa-tabular"
                                      />
                                      {floorSpring || isHouse ? (
                                        <button
                                          type="button"
                                          onClick={() => addProductToRfq(item, qty)}
                                          className="min-h-[36px] rounded-lg border border-[#0B1F35] bg-white px-3 text-xs font-semibold text-[#0B1F35] hover:bg-[#0B1F35] hover:text-white transition-colors cursor-pointer"
                                        >
                                          Add to RFQ
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={!isApprovedDealer}
                                          onClick={() => addToCart(item, { quantity: qty })}
                                          className="min-h-[36px] rounded-lg bg-[#076864] px-3 text-xs font-semibold text-white hover:bg-[#05524F] disabled:opacity-40 cursor-pointer"
                                        >
                                          Add to Cart
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden divide-y divide-[#E7EEF4]">
                        {filteredCatalogue.slice(0, 40).map((item) => {
                          const sku = getProductSku(item);
                          const floorSpring = isFloorSpringProduct(item);
                          const isHouse = HOUSE_OF_AJANTHA_CATEGORIES.has(item.category) && !floorSpring;
                          const unitPrice = isApprovedDealer
                            ? getAuthorizedUnitPrice(item.id) ?? item.dealerPriceInr ?? item.unitPriceInr
                            : item.customerPriceInr;
                          const qty = qtyMap[item.id] ?? 1;

                          return (
                            <div key={item.id} className="p-4 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-mono text-[11px] text-[#64748B]">{sku}</p>
                                  <Link
                                    href={`/products/${item.id}`}
                                    className="text-sm font-bold text-[#0B1F35]"
                                  >
                                    {item.name}
                                  </Link>
                                </div>
                                <span className="text-sm font-bold text-[#076864] sa-tabular shrink-0">
                                  {floorSpring
                                    ? "Quote"
                                    : isApprovedDealer
                                      ? formatInr(unitPrice)
                                      : "Locked"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <StatusTag
                                  label={
                                    floorSpring
                                      ? "Quotation Only"
                                      : isHouse
                                        ? "Distributor Routed"
                                        : "Sai Ajantha Direct"
                                  }
                                  tone={floorSpring ? "warning" : isHouse ? "info" : "success"}
                                  compact
                                />
                                {floorSpring || isHouse ? (
                                  <button
                                    type="button"
                                    onClick={() => addProductToRfq(item, qty)}
                                    className="min-h-[38px] rounded-lg border border-[#0B1F35] px-3 text-xs font-semibold text-[#0B1F35] cursor-pointer"
                                  >
                                    Add to RFQ
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!isApprovedDealer}
                                    onClick={() => addToCart(item, { quantity: qty })}
                                    className="min-h-[38px] rounded-lg bg-[#076864] px-3 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
                                  >
                                    Add to Cart
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {filteredCatalogue.length > 60 && (
                        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E7EEF4] text-xs text-[#5D6F82]">
                          Showing first 60 of {filteredCatalogue.length} matching SKUs. Use the
                          search bar or category filter to narrow down quickly.
                        </div>
                      )}
                    </>
                  )}
                </SectionCard>
              )}

              {/* TAB 3: GUIDED RFQ / BOQ BUILDER */}
              {activeTab === "rfq" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  <SectionCard
                    className="xl:col-span-5"
                    kicker="Step 1"
                    title="Select Products for RFQ"
                    description="Quickly search and add SKUs (including Floor Springs & House of Ajantha items)."
                  >
                    <div className="relative mb-4">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                      <input
                        type="search"
                        value={rfqSearch}
                        onChange={(e) => setRfqSearch(e.target.value)}
                        placeholder="Type SKU or product name..."
                        className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white pl-9 pr-3 text-sm text-[#0B1F35]"
                      />
                    </div>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {rfqQuickMatches.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0B1F35] truncate">{item.name}</p>
                            <p className="font-mono text-[11px] text-[#64748B]">
                              {getProductSku(item)} · {item.category}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addProductToRfq(item, 1)}
                            className="shrink-0 min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-[#0B1F35] px-2.5 text-[11px] font-semibold text-white hover:bg-[#076864] cursor-pointer"
                          >
                            <Plus className="size-3" />
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    className="xl:col-span-7"
                    kicker="Step 2 & 3"
                    title="Delivery PIN & RFQ Submission"
                    description="Quotations never reserve stock. Confirmed availability and final landed rates are shared by the assigned seller."
                  >
                    {rfqSuccessRef && (
                      <div className="mb-5 rounded-xl border border-[#A7DFD0] bg-[#E6F6F2] p-4 flex items-start gap-3">
                        <CheckCircle2 className="size-5 text-[#065F46] shrink-0 mt-0.5" />
                        <div className="text-xs text-[#065F46]">
                          <p className="font-bold">RFQ Submitted Successfully</p>
                          <p className="mt-0.5">
                            Reference ID: <strong className="font-mono">{rfqSuccessRef}</strong>. Our
                            trade desk will prepare your formal quotation shortly.
                          </p>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmitRfq} className="space-y-5">
                      {/* Selected Lines */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-[#0B1F35]">
                          Selected BOQ Line Items ({rfqLines.length})
                        </p>
                        {rfqLines.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[#CBD7E3] bg-[#F9FBFD] p-4 text-xs text-[#5D6F82]">
                            No SKUs added yet. Select products from the left list or from the
                            Wholesale Catalogue.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {rfqLines.map((line) => (
                              <div
                                key={line.product.id}
                                className="rounded-xl border border-[#DCE5EE] bg-white p-3 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#0B1F35] truncate">
                                    {line.product.name}
                                  </p>
                                  <p className="font-mono text-[11px] text-[#64748B]">
                                    {getProductSku(line.product)} · {line.product.billingUnit || "1 unit"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="number"
                                    min={1}
                                    value={line.qty}
                                    onChange={(e) =>
                                      setRfqLines((prev) =>
                                        prev.map((l) =>
                                          l.product.id === line.product.id
                                            ? { ...l, qty: Math.max(1, Number(e.target.value) || 1) }
                                            : l
                                        )
                                      )
                                    }
                                    className="w-16 h-9 rounded-lg border border-[#C5D3E0] text-center text-xs font-bold sa-tabular"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRfqLines((prev) =>
                                        prev.filter((l) => l.product.id !== line.product.id)
                                      )
                                    }
                                    aria-label={`Remove ${getProductSku(line.product)}`}
                                    className="p-2 text-[#64748B] hover:text-[#B91C1C] cursor-pointer"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Delivery PIN Check */}
                      <div className="space-y-2">
                        <label htmlFor="rfq-pin" className="block text-xs font-bold text-[#0B1F35]">
                          Delivery Site 6-Digit PIN Code (Seller Resolution)
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="rfq-pin"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={rfqPincode}
                            onChange={(e) =>
                              setRfqPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            placeholder="e.g. 620001"
                            className="flex-1 min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm sa-tabular"
                          />
                          <button
                            type="button"
                            disabled={checkingPin}
                            onClick={() => verifyPinRouting(rfqPincode, "rfq")}
                            className="min-h-[42px] rounded-xl border border-[#0B1F35] bg-white px-4 text-xs font-semibold text-[#0B1F35] hover:bg-[#0B1F35] hover:text-white transition-colors cursor-pointer"
                          >
                            {checkingPin ? "Checking..." : "Check Seller"}
                          </button>
                        </div>
                        {rfqSellerInfo && (
                          <div className="rounded-xl border border-[#C5E3E0] bg-[#F1FAF9] px-3.5 py-2.5 text-xs text-[#0F3942]">
                            <p className="font-bold">{rfqSellerInfo.sellerName || "Channel Resolved"}</p>
                            {rfqSellerInfo.message && (
                              <p className="mt-0.5 text-[11px]">{rfqSellerInfo.message}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label htmlFor="rfq-notes" className="block text-xs font-bold text-[#0B1F35] mb-1">
                          Project Timeline / Finish Specifications
                        </label>
                        <textarea
                          id="rfq-notes"
                          rows={3}
                          value={rfqNotes}
                          onChange={(e) => setRfqNotes(e.target.value)}
                          placeholder="Mention preferred finishes, door weights, dispatch timeline, or billing instructions..."
                          className="w-full rounded-xl border border-[#C5D3E0] bg-white p-3 text-sm text-[#0B1F35]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingRfq || rfqLines.length === 0}
                        className="w-full min-h-[46px] rounded-xl bg-[#076864] px-5 text-sm font-semibold text-white hover:bg-[#05524F] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {submittingRfq ? "Submitting RFQ..." : "Submit Trade RFQ to Desk"}
                      </button>
                    </form>
                  </SectionCard>
                </div>
              )}

              {/* TAB 4: TRADE QUOTATIONS */}
              {activeTab === "quotes" && (
                <SectionCard
                  kicker="Trade Estimates"
                  title="Issued BOQ Quotations & Pricing Approvals"
                  description="Review verified trade quotations issued to your firm. Accept confirmed pricing, request technical revisions, or download official estimates."
                  actions={
                    <button
                      type="button"
                      onClick={() => setActiveTab("rfq")}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0B1F35] px-3.5 text-xs font-semibold text-white hover:bg-[#076864] cursor-pointer"
                    >
                      New RFQ
                      <ArrowRight className="size-3.5" />
                    </button>
                  }
                >
                  {realQuotes.length === 0 ? (
                    <EmptyStatePanel
                      icon={<ClipboardList className="size-5" />}
                      title="No issued quotations found"
                      description="When our sales desk or authorized regional distributor prepares a formal BOQ quotation for your enquiry or RFQ, it will appear here."
                      primaryAction={{
                        label: "Open RFQ Builder",
                        onClick: () => setActiveTab("rfq"),
                      }}
                      secondaryAction={{
                        label: "Browse Catalogue",
                        onClick: () => setActiveTab("catalogue"),
                      }}
                    />
                  ) : (
                    <div className="space-y-6">
                      {realQuotes.map((q) => {
                        const isService = q.is_service_quote;
                        const isActionable = q.status === "SHARED_NONPAYABLE";
                        const isAccepted = q.status === "ACCEPTED";
                        const isConverted = q.status === "CONVERTED_TO_ORDER";
                        const isRevisionRequested = q.status === "REVISION_REQUESTED";
                        const isDeclined = q.status === "REJECTED";
                        const totalVal =
                          q.total_inr ||
                          (q.subtotal_inr || 0) +
                            (q.tax_inr || Math.round((q.subtotal_inr || 0) * 0.18));

                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-[#DCE5EE] bg-white overflow-hidden shadow-sm"
                          >
                            <div className="p-4 sm:p-5 bg-[#FAFBFD] border-b border-[#E7EEF4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-[#0B1F35]">
                                    {q.quote_number || q.id}
                                  </span>
                                  {isService ? (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                      Installation Service Quote · {q.contractor_name || "Verified Contractor"}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                                      {q.seller_name || "Sai Ajantha Central"}
                                    </span>
                                  )}
                                  {q.enquiry_id && (
                                    <span className="text-[11px] font-mono text-[#5D6F82]">
                                      Enquiry #{q.enquiry_id.slice(-8)}
                                    </span>
                                  )}
                                </div>
                                <h3 className="mt-1 text-sm font-bold text-[#0B1F35]">
                                  {q.title || "Wholesale Commercial Quotation"}
                                </h3>
                                <p className="mt-0.5 text-xs text-[#5D6F82]">
                                  Issued: {q.created_at ? new Date(q.created_at).toLocaleDateString("en-IN") : "Recent"}
                                  {q.valid_until ? ` · Valid until: ${new Date(q.valid_until).toLocaleDateString("en-IN")}` : " · Validity: 15 Days"}
                                  {q.postal_code ? ` · Delivery PIN: ${q.postal_code}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isActionable && <StatusTag label="Awaiting Your Response" tone="warning" />}
                                {isAccepted && <StatusTag label="Quote Accepted" tone="success" />}
                                {isConverted && <StatusTag label="Converted to Order" tone="success" />}
                                {isRevisionRequested && <StatusTag label="Revision Requested" tone="warning" />}
                                {isDeclined && <StatusTag label="Declined" tone="danger" />}
                                {!isActionable && !isAccepted && !isConverted && !isRevisionRequested && !isDeclined && (
                                  <StatusTag label={q.status} tone="neutral" />
                                )}
                              </div>
                            </div>

                            <div className="p-4 sm:p-5">
                              {q.items && q.items.length > 0 ? (
                                <div className="sa-table-wrap border rounded-lg border-[#E7EEF4] overflow-x-auto">
                                  <table className="sa-table w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#F8FAFC] border-b border-[#E7EEF4]">
                                        <th className="text-left py-2.5 px-3">Item / SKU</th>
                                        <th className="text-left py-2.5 px-3">Specification</th>
                                        <th className="text-right py-2.5 px-3">Qty</th>
                                        <th className="text-right py-2.5 px-3">Rate (INR)</th>
                                        <th className="text-right py-2.5 px-3">Total (INR)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E7EEF4]">
                                      {q.items.map((it: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-3 font-semibold text-[#0B1F35]">
                                            {it.title || it.name || it.description || `Line #${idx + 1}`}
                                          </td>
                                          <td className="py-2.5 px-3 text-[#5D6F82] font-mono">
                                            {it.sku || it.size || "Standard"}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-medium">
                                            {it.quantity || 1}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono sa-tabular">
                                            {formatInr(it.unit_price_inr || it.rate || 0)}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0B1F35] sa-tabular">
                                            {formatInr(
                                              it.total_inr ||
                                                (it.quantity || 1) * (it.unit_price_inr || it.rate || 0)
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-[#5D6F82] italic">
                                  Wholesale BOQ estimate as per enquiry specifications.
                                </p>
                              )}

                              <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-3 border-t border-[#E7EEF4]">
                                <div className="text-xs text-[#5D6F82] space-y-1">
                                  <p>Applied Tier: Authorized Dealer Wholesale Pricing. Verified GST 18%.</p>
                                  {q.notes && (
                                    <p className="text-[#354B62]">
                                      <span className="font-semibold">Desk Remarks:</span> {q.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right space-y-1 sm:min-w-[200px]">
                                  <div className="flex justify-between text-xs text-[#5D6F82]">
                                    <span>Subtotal:</span>
                                    <span className="font-mono">{formatInr(q.subtotal_inr || 0)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs text-[#5D6F82]">
                                    <span>GST (18%):</span>
                                    <span className="font-mono">
                                      {formatInr(q.tax_inr || Math.round((q.subtotal_inr || 0) * 0.18))}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm font-bold text-[#076864] pt-1 border-t border-[#DCE5EE]">
                                    <span>Total Value:</span>
                                    <span className="font-mono text-base">{formatInr(totalVal)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="px-4 py-3 bg-[#FAFBFD] border-t border-[#E7EEF4]">
                              {isActionable && (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-[#354B62] font-medium">
                                      Review wholesale pricing and terms to confirm this quotation.
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                                      >
                                        <Printer className="size-3.5" />
                                        Print / PDF
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respondingToQuote}
                                        onClick={() => {
                                          if (revisionQuoteId === q.id) {
                                            setRevisionQuoteId(null);
                                          } else {
                                            setRevisionQuoteId(q.id);
                                            setRevisionNotes("");
                                          }
                                        }}
                                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                                      >
                                        Request Revision
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respondingToQuote}
                                        onClick={() => {
                                          if (confirm("Are you sure you want to decline this trade quotation?")) {
                                            handleRespondQuote(q.id, "REJECT");
                                          }
                                        }}
                                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                                      >
                                        Decline
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respondingToQuote}
                                        onClick={() => handleRespondQuote(q.id, "ACCEPT")}
                                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#076864] px-4 text-xs font-semibold text-white hover:bg-[#05524F] shadow-sm cursor-pointer disabled:opacity-60"
                                      >
                                        <CheckCircle className="size-3.5" />
                                        {respondingToQuote ? "Processing..." : "Accept Quotation"}
                                      </button>
                                    </div>
                                  </div>

                                  {revisionQuoteId === q.id && (
                                    <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                                      <label className="block text-xs font-bold text-amber-950">
                                        Specify required modifications or price/qty adjustment:
                                      </label>
                                      <textarea
                                        rows={3}
                                        value={revisionNotes}
                                        onChange={(e) => setRevisionNotes(e.target.value)}
                                        placeholder="e.g. Please update quantity or adjust billing terms..."
                                        className="w-full rounded-md border border-amber-300 bg-white p-2 text-xs text-[#0B1F35]"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setRevisionQuoteId(null)}
                                          className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={respondingToQuote || !revisionNotes.trim()}
                                          onClick={() => handleRespondQuote(q.id, "REQUEST_REVISION", revisionNotes)}
                                          className="px-3 py-1.5 rounded bg-amber-700 text-xs font-semibold text-white hover:bg-amber-800 cursor-pointer disabled:opacity-60"
                                        >
                                          Submit Revision Request
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {isAccepted && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 text-[#076864] font-medium">
                                    <CheckCircle className="size-4 text-[#076864]" />
                                    <span>
                                      Quotation accepted on {q.customer_response_at ? new Date(q.customer_response_at).toLocaleDateString("en-IN") : "record"}. Order processing initiated.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="inline-flex items-center gap-1 rounded border border-[#C5D3E0] bg-white px-2.5 py-1 text-xs font-medium text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                                  >
                                    <Printer className="size-3" />
                                    Print Copy
                                  </button>
                                </div>
                              )}

                              {isConverted && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 text-[#076864] font-medium">
                                    <CheckCircle className="size-4 text-[#076864]" />
                                    <span>
                                      Converted to Official Trade Order #{q.converted_order_id}. Offline PO settlement processing.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="inline-flex items-center gap-1 rounded border border-[#C5D3E0] bg-white px-2.5 py-1 text-xs font-medium text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                                  >
                                    <Printer className="size-3" />
                                    Print Quote Record
                                  </button>
                                </div>
                              )}

                              {isRevisionRequested && (
                                <div className="text-xs text-amber-800 space-y-1">
                                  <p className="font-semibold">
                                    Revision request submitted on {q.customer_response_at ? new Date(q.customer_response_at).toLocaleDateString("en-IN") : "record"}.
                                  </p>
                                  {q.customer_response_notes && (
                                    <p className="text-slate-700 bg-amber-50 p-2 rounded border border-amber-200">
                                      Notes: {q.customer_response_notes}
                                    </p>
                                  )}
                                </div>
                              )}

                              {isDeclined && (
                                <p className="text-xs text-red-700 font-medium">
                                  Quotation declined on {q.customer_response_at ? new Date(q.customer_response_at).toLocaleDateString("en-IN") : "record"}.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 5: ORDERS & PROFORMAS */}
              {activeTab === "orders" && (
                <SectionCard
                  kicker="Trade Orders"
                  title="Orders & Printable Proforma Invoices"
                  description="All orders submitted under your Dealer account with applied pricing tier and payment status."
                  padded={false}
                >
                  {loadingData ? (
                    <div className="p-6 text-xs text-[#5D6F82]">Loading orders...</div>
                  ) : orders.length === 0 ? (
                    <div className="p-6">
                      <EmptyStatePanel
                        icon={<Package className="size-5" />}
                        title="No trade orders yet"
                        description="Once you submit a Trade PO or BOQ order, it will appear here with full status tracking and printable proforma links."
                        primaryAction={{
                          label: "Browse Wholesale Catalogue",
                          onClick: () => setActiveTab("catalogue"),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="sa-table-wrap">
                      <table className="sa-table">
                        <thead>
                          <tr>
                            <th>Order Ref</th>
                            <th>Date</th>
                            <th>Tier</th>
                            <th>Order Status</th>
                            <th>Payment Status</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Document</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((ord) => {
                            const status = getOrderStatusMeta(ord.status);
                            const pay = getOrderStatusMeta(ord.payment_status);
                            return (
                              <tr key={ord.id}>
                                <td className="font-mono text-xs font-bold">{ord.order_number}</td>
                                <td className="text-xs text-[#5D6F82]">
                                  {new Date(ord.created_at).toLocaleDateString("en-IN")}
                                </td>
                                <td className="text-xs font-semibold">{ord.price_tier_applied}</td>
                                <td>
                                  <StatusTag label={status.label} tone={status.tone} compact />
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
                                    View
                                    <ExternalLink className="size-3" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 5: DISTRIBUTOR LINKAGE & DELIVERY SITES */}
              {activeTab === "sites" && (
                <div className="space-y-6">
                  <SectionCard
                    kicker="Channel Assignment"
                    title="Distributor Linkage & Territory Lookup"
                    description="Check which authorized regional distributor services a 6-digit delivery PIN for House of Ajantha Door Closers & Kitchen Baskets."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      <div className="md:col-span-5 rounded-xl border border-[#DCE5EE] bg-[#F9FBFD] p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F35]">
                          <Building2 className="size-4 text-[#076864]" />
                          Dealer Profile Summary
                        </div>
                        <dl className="space-y-1.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#5D6F82]">Firm</dt>
                            <dd className="font-semibold text-[#0B1F35]">
                              {user.organization || "Not set"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#5D6F82]">GSTIN</dt>
                            <dd className="font-mono font-semibold text-[#0B1F35]">
                              {user.gstin || "Unregistered"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[#5D6F82]">Base City</dt>
                            <dd className="font-semibold text-[#0B1F35]">
                              {user.businessCity || "Tamil Nadu"}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="md:col-span-7 space-y-3">
                        <label htmlFor="site-pin-check" className="block text-xs font-bold text-[#0B1F35]">
                          Verify Regional Distributor Coverage by PIN
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="site-pin-check"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={sitePin}
                            onChange={(e) =>
                              setSitePin(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            placeholder="Enter 6-digit PIN (e.g. 620001)"
                            className="flex-1 min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm sa-tabular"
                          />
                          <button
                            type="button"
                            disabled={checkingPin}
                            onClick={() => verifyPinRouting(sitePin, "site")}
                            className="min-h-[42px] rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] cursor-pointer"
                          >
                            {checkingPin ? "Checking..." : "Lookup"}
                          </button>
                        </div>
                        {siteLookup && (
                          <div className="rounded-xl border border-[#C5E3E0] bg-[#F1FAF9] p-3.5 text-xs text-[#0F3942]">
                            <p className="font-bold">{siteLookup.sellerName}</p>
                            <p className="mt-0.5">{siteLookup.message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    kicker="Dispatch Locations"
                    title={`Saved Shop & Project Sites (${addresses.length})`}
                  >
                    <form
                      onSubmit={handleAddDeliverySite}
                      className="mb-5 grid grid-cols-1 sm:grid-cols-12 gap-3 rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-4"
                    >
                      <input
                        type="text"
                        required
                        value={siteForm.label}
                        onChange={(e) => setSiteForm({ ...siteForm, label: e.target.value })}
                        placeholder="Label (e.g. Main Shop)"
                        className="sm:col-span-3 min-h-[40px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={siteForm.line1}
                        onChange={(e) => setSiteForm({ ...siteForm, line1: e.target.value })}
                        placeholder="Street address / godown"
                        className="sm:col-span-4 min-h-[40px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={siteForm.city}
                        onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                        placeholder="City"
                        className="sm:col-span-2 min-h-[40px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-xs"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={siteForm.pincode}
                        onChange={(e) =>
                          setSiteForm({
                            ...siteForm,
                            pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                          })
                        }
                        placeholder="PIN"
                        className="sm:col-span-1 min-h-[40px] rounded-lg border border-[#C5D3E0] bg-white px-2 text-xs sa-tabular"
                      />
                      <button
                        type="submit"
                        disabled={addingSite}
                        className="sm:col-span-2 min-h-[40px] rounded-lg bg-[#076864] px-3 text-xs font-semibold text-white hover:bg-[#05524F] cursor-pointer"
                      >
                        {addingSite ? "Saving..." : "Save Site"}
                      </button>
                    </form>

                    {addresses.length === 0 ? (
                      <EmptyStatePanel
                        icon={<MapPin className="size-5" />}
                        title="No saved trade sites yet"
                        description="Add your showroom, warehouse, or project site address above for repeat orders."
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {addresses.map((addr) => (
                          <div
                            key={addr.id}
                            className="rounded-xl border border-[#DCE5EE] bg-white p-4 flex items-start justify-between gap-3"
                          >
                            <div className="text-xs">
                              <p className="font-bold text-[#076864] uppercase tracking-wider text-[10px]">
                                {addr.label}
                              </p>
                              <p className="mt-1 font-bold text-[#0B1F35] text-sm">{addr.recipient}</p>
                              <p className="mt-0.5 text-[#526477]">
                                {addr.line1}, {addr.city} {addr.pincode}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSite(addr.id)}
                              aria-label={`Remove ${addr.label}`}
                              className="p-1.5 text-[#64748B] hover:text-[#B91C1C] cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}
            </PortalShell>
          )}
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
