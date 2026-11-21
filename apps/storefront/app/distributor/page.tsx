"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Search,
  ShoppingCart,
  Truck,
  UserPlus,
  Warehouse,
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
  WorkflowStepper,
} from "@/components/non-home/PortalPrimitives";
import { useStore } from "@/components/StoreProvider";
import {
  computeOpeningStockProgress,
  filterDistributorBuyStockCatalog,
  formatInr,
  getApprovalStatusMeta,
  getOrderStatusMeta,
  getProductSku,
  OPENING_STOCK_TARGET_INR,
  type PortalOrderRecord,
} from "@/lib/portal-helpers";

type DistributorTab =
  | "overview"
  | "buy-stock"
  | "purchase-orders"
  | "receipts"
  | "inventory"
  | "territory"
  | "dealers"
  | "profile";

interface PinResolutionResult {
  sellerType?: string;
  sellerName?: string;
  message?: string;
}

export default function DistributorPortalPage() {
  const router = useRouter();
  const {
    session: user,
    authLoading,
    signOut: logout,
    catalogProducts,
    wholesaleUnlocked,
    addToCart,
    getAuthorizedUnitPrice,
    cart,
    cartCount,
    showToast,
  } = useStore();
  const authLoaded = !authLoading;

  const [activeTab, setActiveTab] = useState<DistributorTab>("overview");
  const [orders, setOrders] = useState<PortalOrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Buy Stock filters & qty map
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState<
    "ALL" | "Door Closer & Floor Spring" | "Kitchen Basket"
  >("ALL");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  // Territory PIN lookup
  const [territoryPin, setTerritoryPin] = useState("");
  const [territoryResult, setTerritoryResult] = useState<PinResolutionResult | null>(null);
  const [checkingTerritory, setCheckingTerritory] = useState(false);

  // Dealer invitation form
  const [inviteForm, setInviteForm] = useState({
    dealerName: "",
    organization: "",
    phone: "",
    email: "",
    city: "",
    notes: "",
  });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccessRef, setInviteSuccessRef] = useState<string | null>(null);

  const isDistributor = user?.role === "DISTRIBUTOR";
  const isApprovedDistributor =
    isDistributor && user?.approvalStatus === "APPROVED" && wholesaleUnlocked;

  useEffect(() => {
    if (!user || user.role !== "DISTRIBUTOR") return;
    let cancelled = false;
    async function loadOrders() {
      setLoadingOrders(true);
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch {
        // Handled silently
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    }
    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const eligibleBuyStockSkus = useMemo(
    () =>
      filterDistributorBuyStockCatalog(catalogProducts, {
        query: stockSearch,
        category: stockCategory,
      }),
    [catalogProducts, stockSearch, stockCategory]
  );

  const totalEligibleBuyStockCount = useMemo(
    () =>
      filterDistributorBuyStockCatalog(catalogProducts, {
        query: "",
        category: "ALL",
      }).length,
    [catalogProducts]
  );

  const inboundCartValue = useMemo(
    () =>
      cart.reduce((sum, item) => sum + (item.unitPriceInr ?? 0) * item.quantity, 0),
    [cart]
  );

  const openingStock = useMemo(
    () => computeOpeningStockProgress(inboundCartValue, OPENING_STOCK_TARGET_INR),
    [inboundCartValue]
  );

  const dispatchedOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["DISPATCHED", "IN_TRANSIT", "CONFIRMED_TRADE_PO"].includes(
          (o.status || "").toUpperCase()
        )
      ),
    [orders]
  );

  async function handleCheckTerritory(e: React.FormEvent) {
    e.preventDefault();
    const clean = territoryPin.trim();
    if (!/^\d{6}$/.test(clean)) {
      showToast("Enter a valid 6-digit PIN code.");
      return;
    }
    setCheckingTerritory(true);
    try {
      const res = await fetch(
        `/api/seller-resolution?postalCode=${encodeURIComponent(clean)}&categorySlug=door-closer`
      );
      const data = await res.json();
      setTerritoryResult(data);
    } catch {
      showToast("Unable to verify territory PIN right now.");
    } finally {
      setCheckingTerritory(false);
    }
  }

  async function handleSendDealerInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!inviteForm.dealerName.trim() || !inviteForm.organization.trim() || !inviteForm.phone.trim()) {
      showToast("Dealer contact name, firm/shop name, and mobile number are required.");
      return;
    }
    setSendingInvite(true);
    setInviteSuccessRef(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteForm.dealerName,
          role: "Dealer Invitation (Submitted by Distributor)",
          organization: inviteForm.organization,
          phone: inviteForm.phone,
          email: inviteForm.email,
          city: inviteForm.city || user.businessCity || "Tamil Nadu",
          division: "Distributor Dealer Onboarding",
          notes: [
            `[Dealer Network Invitation]`,
            `Sponsoring Distributor: ${user.organization || user.name} (${user.email})`,
            inviteForm.notes.trim() ? `Notes: ${inviteForm.notes.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          source: "distributor-dealer-invite",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to submit dealer invitation.");
        return;
      }
      setInviteSuccessRef(data.id || "Logged");
      setInviteForm({
        dealerName: "",
        organization: "",
        phone: "",
        email: "",
        city: "",
        notes: "",
      });
      showToast("Dealer invitation logged for admin onboarding.");
    } catch {
      showToast("Network error submitting dealer invitation.");
    } finally {
      setSendingInvite(false);
    }
  }

  const navItems: PortalNavItem[] = [
    {
      id: "overview",
      label: "Operations Overview",
      icon: <LayoutDashboard className="size-4" />,
      group: "Operations",
    },
    {
      id: "buy-stock",
      label: "Buy Stock (House of Ajantha)",
      icon: <Boxes className="size-4" />,
      badge: totalEligibleBuyStockCount,
      group: "Inbound: Buy From Sai Ajantha",
    },
    {
      id: "purchase-orders",
      label: "Purchase Orders & UTR",
      icon: <FileText className="size-4" />,
      badge: orders.length || undefined,
      group: "Inbound: Buy From Sai Ajantha",
    },
    {
      id: "receipts",
      label: "Dispatch & Goods Receipts",
      icon: <Truck className="size-4" />,
      badge: dispatchedOrders.length || undefined,
      group: "Inbound: Buy From Sai Ajantha",
    },
    {
      id: "inventory",
      label: "My Warehouse Inventory",
      icon: <Warehouse className="size-4" />,
      group: "Own Operations & Territory",
    },
    {
      id: "territory",
      label: "Territory Coverage",
      icon: <MapPin className="size-4" />,
      group: "Own Operations & Territory",
    },
    {
      id: "dealers",
      label: "Dealers & Resale Quotes",
      icon: <UserPlus className="size-4" />,
      group: "Own Operations & Territory",
    },
    {
      id: "profile",
      label: "Account & Governance",
      icon: <Building2 className="size-4" />,
      group: "Settings",
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
                  Loading distributor operations console...
                </p>
              </div>
            </div>
          ) : !user || !isDistributor ? (
            <div className="sa-content-width py-12 sm:py-16">
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-2xl bg-[#0B1F35] text-white p-7 sm:p-9 space-y-6">
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#58DDE2]">
                      Enterprise Channel Console
                    </p>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                      House of Ajantha Distributor Portal
                    </h1>
                    <p className="text-sm text-[#C4D5E5] leading-relaxed">
                      {user
                        ? `You are currently signed in as ${user.role}. Distributor inbound purchasing, warehouse inventory tracking, and territory governance require an approved Distributor account.`
                        : "Dedicated B2B operations workspace for regional distributors managing House of Ajantha Door Closers and Kitchen Baskets stock, inbound purchase orders, territory PIN coverage, and dealer networks."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        title: "Inbound Buy Stock POs",
                        desc: "Order Door Closers & Kitchen Baskets at authorized Distributor tier with bank transfer settlement.",
                      },
                      {
                        title: "Isolated Warehouse Ledger",
                        desc: "Track Saleable, Reserved, In-Transit, and Damaged stock strictly separated from Central Warehouse.",
                      },
                      {
                        title: "Territory PIN Governance",
                        desc: "Verify assigned delivery PINs and manage regional quotation routing cleanly.",
                      },
                      {
                        title: "Dealer Network Onboarding",
                        desc: "Invite hardware dealers in your territory for verified admin approval.",
                      },
                    ].map((cap) => (
                      <div
                        key={cap.title}
                        className="rounded-xl border border-white/12 bg-white/[0.05] p-3.5"
                      >
                        <p className="text-xs font-bold text-white">{cap.title}</p>
                        <p className="mt-1 text-[11px] text-[#B5C8DB] leading-relaxed">
                          {cap.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {!user ? (
                      <>
                        <Link
                          href="/login?role=DISTRIBUTOR"
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#079D9A] px-5 text-sm font-semibold text-white hover:bg-[#05827F] transition-colors"
                        >
                          Distributor Sign In
                          <ArrowRight className="size-4" />
                        </Link>
                        <Link
                          href="/register?role=DISTRIBUTOR"
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                        >
                          Apply as Distributor
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={user.role === "DEALER" ? "/dealer" : "/account"}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#079D9A] px-5 text-sm font-semibold text-white hover:bg-[#05827F] transition-colors"
                      >
                        Return to Your Portal
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 sa-card p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <StatusTag label="Wholesale Governance" tone="info" />
                    <h2 className="font-display text-lg font-bold text-[#0B1F35]">
                      Commercial Scope &amp; Eligibility
                    </h2>
                    <ul className="space-y-2.5 text-xs text-[#526477]">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-[#076864] shrink-0 mt-0.5" />
                        <span>
                          <strong>Eligible Buy Stock Ranges:</strong> House of Ajantha Door Closers
                          and Kitchen Baskets.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-[#076864] shrink-0 mt-0.5" />
                        <span>
                          <strong>Opening Stock Guidance:</strong> Configurable opening PO target of{" "}
                          {formatInr(OPENING_STOCK_TARGET_INR)} settled via verified bank transfer
                          (UTR proof).
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-[#076864] shrink-0 mt-0.5" />
                        <span>
                          <strong>Hydraulic Floor Springs:</strong> Handled strictly as technical
                          quotations outside standard wholesale stock checkout.
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-[#E4ECF3] bg-[#F8FAFC] p-4 text-[11px] text-[#5D6F82]">
                    Distributor applications undergo thorough territory, GSTIN, and warehousing
                    verification by Sai Ajantha management prior to activation.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PortalShell
              roleTheme="distributor"
              portalLabel="Distributor Console"
              title={user.organization || user.name}
              subtitle="Enterprise workspace separating Inbound Stock Procurement from Your Own Warehouse Inventory & Regional Territory Operations."
              userName={user.organization || user.name}
              userMeta={`${user.name} · ${user.businessCity || "Assigned Territory"}${user.gstin ? ` · GSTIN ${user.gstin}` : ""}`}
              statusBadge={approvalMeta}
              priceTierLabel={
                isApprovedDistributor ? "Authorized Distributor Tier" : "Pending Verification"
              }
              navItems={navItems}
              activeTab={activeTab}
              onSelectTab={(id) => setActiveTab(id as DistributorTab)}
              onLogout={async () => {
                await logout();
                router.push("/");
              }}
              headerActions={
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("buy-stock")}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] transition-colors cursor-pointer"
                  >
                    <Boxes className="size-3.5" />
                    Buy Stock
                  </button>
                  <Link
                    href="/cart"
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
                  >
                    <ShoppingCart className="size-3.5" />
                    PO Cart ({cartCount})
                  </Link>
                </>
              }
              topBanner={
                !isApprovedDistributor ? (
                  <CommercialGateBanner
                    tone="warning"
                    title={`Distributor Account Status: ${approvalMeta.label}`}
                    description="Distributor wholesale rates and inbound stock PO placement remain restricted until your regional distributor agreement is approved."
                  />
                ) : (
                  <CommercialGateBanner
                    tone="info"
                    title="Warehouse Separation & Commercial Controls Active"
                    description="Inbound stock purchased here enters your isolated Distributor Warehouse after verified goods receipt. Online resale payment capture and automated refunds remain disabled; regional resale runs via quotation."
                  />
                )
              }
            >
              {/* TAB 1: OPERATIONS OVERVIEW */}
              {activeTab === "overview" && (
                <>
                  <KpiStatRow
                    items={[
                      {
                        label: "Eligible Buy-Stock SKUs",
                        value: totalEligibleBuyStockCount,
                        detail: "Door Closers & Kitchen Baskets",
                      },
                      {
                        label: "Active PO Cart Value",
                        value: formatInr(inboundCartValue),
                        detail: `${openingStock.percent}% of ${formatInr(openingStock.targetInr)} target`,
                        accent: openingStock.meetsThreshold,
                      },
                      {
                        label: "Recorded Purchase Orders",
                        value: orders.length,
                        detail: `${dispatchedOrders.length} active / in-progress`,
                      },
                      {
                        label: "Resale Online Checkout",
                        value: "Quotation Led",
                        detail: "Online resale payments off",
                      },
                    ]}
                  />

                  {/* Two Distinct Workspace Pillars */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SectionCard
                      kicker="Workspace A · Inbound Procurement"
                      title="Buy Stock from Sai Ajantha"
                      description="Procure House of Ajantha Door Closers & Kitchen Baskets directly from the Trichy central warehouse."
                      actions={
                        <button
                          type="button"
                          onClick={() => setActiveTab("buy-stock")}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#076864] hover:underline cursor-pointer"
                        >
                          Open Buy Stock
                          <ArrowRight className="size-3.5" />
                        </button>
                      }
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#354B62]">
                            Opening Stock Target Progress
                          </span>
                          <span className="font-bold text-[#0B1F35] sa-tabular">
                            {formatInr(openingStock.currentInr)} / {formatInr(openingStock.targetInr)}
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[#E7EEF4] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#076864] transition-all"
                            style={{ width: `${openingStock.percent}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-[#5D6F82]">
                          {openingStock.meetsThreshold
                            ? "Your draft PO cart meets the standard opening stock benchmark."
                            : `Add ${formatInr(openingStock.remainingInr)} more in eligible House of Ajantha SKUs to reach the ${formatInr(openingStock.targetInr)} opening stock benchmark.`}
                        </p>
                      </div>
                    </SectionCard>

                    <SectionCard
                      kicker="Workspace B · Own Operations"
                      title="Warehouse, Territory & Dealer Network"
                      description="Manage your isolated warehouse buckets, verify regional PIN coverage, and onboard local hardware dealers."
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab("inventory")}
                          className="rounded-xl border border-[#DCE5EE] bg-[#F9FBFD] p-3.5 text-left hover:border-[#076864] transition-colors cursor-pointer"
                        >
                          <Warehouse className="size-4 text-[#076864]" />
                          <p className="mt-2 text-xs font-bold text-[#0B1F35]">My Inventory</p>
                          <p className="mt-0.5 text-[11px] text-[#5D6F82]">5 isolated buckets</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("territory")}
                          className="rounded-xl border border-[#DCE5EE] bg-[#F9FBFD] p-3.5 text-left hover:border-[#076864] transition-colors cursor-pointer"
                        >
                          <MapPin className="size-4 text-[#076864]" />
                          <p className="mt-2 text-xs font-bold text-[#0B1F35]">Territory PINs</p>
                          <p className="mt-0.5 text-[11px] text-[#5D6F82]">Verify routing</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("dealers")}
                          className="rounded-xl border border-[#DCE5EE] bg-[#F9FBFD] p-3.5 text-left hover:border-[#076864] transition-colors cursor-pointer"
                        >
                          <UserPlus className="size-4 text-[#076864]" />
                          <p className="mt-2 text-xs font-bold text-[#0B1F35]">Invite Dealer</p>
                          <p className="mt-0.5 text-[11px] text-[#5D6F82]">Grow network</p>
                        </button>
                      </div>
                    </SectionCard>
                  </div>

                  {/* PO Lifecycle Guide */}
                  <SectionCard
                    kicker="Standard Operating Flow"
                    title="Inbound Stock Purchase Order Lifecycle"
                  >
                    <WorkflowStepper
                      steps={[
                        {
                          label: "1. Select Stock & Draft PO",
                          detail: "Pick House of Ajantha Door Closers & Kitchen Baskets at distributor rate.",
                          state: cartCount > 0 ? "done" : "active",
                        },
                        {
                          label: "2. Submit PO & Bank UTR",
                          detail: "Place offline Trade PO and submit NEFT/RTGS UTR proof for finance check.",
                          state: orders.length > 0 ? "done" : cartCount > 0 ? "active" : "upcoming",
                        },
                        {
                          label: "3. Finance & Dispatch",
                          detail: "Sai Ajantha finance clears payment and dispatches stock from Trichy hub.",
                          state: dispatchedOrders.length > 0 ? "active" : "upcoming",
                        },
                        {
                          label: "4. Warehouse Receipt",
                          detail: "Confirm received units & report any transit shortage to credit your ledger.",
                          state: "upcoming",
                        },
                      ]}
                    />
                  </SectionCard>
                </>
              )}

              {/* TAB 2: BUY STOCK FROM SAI AJANTHA */}
              {activeTab === "buy-stock" && (
                <div className="space-y-6">
                  <CommercialGateBanner
                    tone="info"
                    title="House of Ajantha Inbound Wholesale Scope"
                    description="Only Door Closers and Kitchen Baskets are eligible for Distributor Buy Stock. All 8 Hydraulic Floor Springs are excluded from online stock POs and must be requested via technical quotation."
                  />

                  {/* Opening Stock Benchmark Bar */}
                  <div className="sa-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0B1F35]">
                          Inbound Stock PO Cart vs Opening Benchmark
                        </span>
                        <span className="font-bold text-[#076864] sa-tabular">
                          {formatInr(openingStock.currentInr)} / {formatInr(openingStock.targetInr)} ({openingStock.percent}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-[#E7EEF4] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#076864] transition-all"
                          style={{ width: `${openingStock.percent}%` }}
                        />
                      </div>
                    </div>
                    <Link
                      href="/cart"
                      className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] shrink-0"
                    >
                      Review PO Cart ({cartCount})
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>

                  <SectionCard
                    kicker="Distributor Price List"
                    title="Eligible House of Ajantha Stock SKUs"
                    padded={false}
                  >
                    <div className="p-4 sm:p-5 border-b border-[#E7EEF4] bg-[#FAFBFD] flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                        <input
                          type="search"
                          value={stockSearch}
                          onChange={(e) => setStockSearch(e.target.value)}
                          placeholder="Search Door Closer or Kitchen Basket SKU..."
                          className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white pl-9 pr-3 text-sm text-[#0B1F35]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: "ALL", label: "All Eligible" },
                            { id: "Door Closer & Floor Spring", label: "Door Closers" },
                            { id: "Kitchen Basket", label: "Kitchen Baskets" },
                          ] as const
                        ).map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setStockCategory(cat.id)}
                            className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                              stockCategory === cat.id
                                ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                                : "border-[#DCE5EE] bg-white text-[#475569] hover:border-[#076864]"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {eligibleBuyStockSkus.length === 0 ? (
                      <div className="p-6">
                        <EmptyStatePanel
                          icon={<Boxes className="size-5" />}
                          title="No eligible SKUs matched your search"
                          description="Clear your search query to view all House of Ajantha Door Closers and Kitchen Baskets."
                          primaryAction={{
                            label: "Reset Filter",
                            onClick: () => {
                              setStockSearch("");
                              setStockCategory("ALL");
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <div className="sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>SKU &amp; Description</th>
                              <th>Category</th>
                              <th>Billing Unit</th>
                              <th className="text-right">Distributor Rate</th>
                              <th className="text-right">Order Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eligibleBuyStockSkus.slice(0, 60).map((item) => {
                              const sku = getProductSku(item);
                              const rate = isApprovedDistributor
                                ? getAuthorizedUnitPrice(item.id) ?? item.distributorPriceInr ?? item.unitPriceInr
                                : null;
                              const qty = qtyMap[item.id] ?? 10;
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
                                      {sku}
                                    </span>
                                  </td>
                                  <td className="text-xs text-[#526477]">{item.category}</td>
                                  <td className="text-xs text-[#526477]">{item.billingUnit || "1 unit"}</td>
                                  <td className="text-right font-bold text-[#0B1F35] sa-tabular">
                                    {isApprovedDistributor ? formatInr(rate) : "Pending Approval"}
                                  </td>
                                  <td className="text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        max={5000}
                                        aria-label={`Order quantity for ${sku}`}
                                        value={qty}
                                        onChange={(e) =>
                                          setQtyMap((prev) => ({
                                            ...prev,
                                            [item.id]: Math.max(1, Number(e.target.value) || 1),
                                          }))
                                        }
                                        className="w-16 h-9 rounded-lg border border-[#C5D3E0] px-2 text-center text-xs font-bold sa-tabular"
                                      />
                                      <button
                                        type="button"
                                        disabled={!isApprovedDistributor}
                                        onClick={() => addToCart(item, { quantity: qty })}
                                        className="min-h-[36px] rounded-lg bg-[#076864] px-3 text-xs font-semibold text-white hover:bg-[#05524F] disabled:opacity-40 cursor-pointer"
                                      >
                                        Add to PO
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}

              {/* TAB 3: PURCHASE ORDERS & PAYMENT PROOF */}
              {activeTab === "purchase-orders" && (
                <SectionCard
                  kicker="Inbound Settlement"
                  title="Purchase Orders & Bank Payment Verification"
                  description="Track submitted stock purchase orders, proforma values, and offline NEFT/RTGS payment verification status."
                  padded={false}
                >
                  {loadingOrders ? (
                    <div className="p-6 text-xs text-[#5D6F82]">Loading purchase orders...</div>
                  ) : orders.length === 0 ? (
                    <div className="p-6">
                      <EmptyStatePanel
                        icon={<FileText className="size-5" />}
                        title="No inbound purchase orders yet"
                        description="Build your first House of Ajantha stock order in the Buy Stock workspace and submit via Trade PO checkout."
                        primaryAction={{
                          label: "Go to Buy Stock",
                          onClick: () => setActiveTab("buy-stock"),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="sa-table-wrap">
                      <table className="sa-table">
                        <thead>
                          <tr>
                            <th>PO Number</th>
                            <th>Date</th>
                            <th>PO Status</th>
                            <th>Settlement</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Proforma</th>
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
                  )}
                </SectionCard>
              )}

              {/* TAB 4: DISPATCH & GOODS RECEIPTS */}
              {activeTab === "receipts" && (
                <SectionCard
                  kicker="Warehouse Receiving"
                  title="Inbound Shipments & Goods Receipt Queue"
                  description="Verify physical carton counts upon delivery from the Trichy central warehouse and log any transit damage or shortage before stock moves into Saleable inventory."
                >
                  {dispatchedOrders.length === 0 ? (
                    <EmptyStatePanel
                      icon={<PackageCheck className="size-5" />}
                      title="No inbound shipments awaiting receipt"
                      description="Once a submitted Purchase Order passes finance clearance and is dispatched from Trichy, its shipment details and goods receipt checklist will appear here."
                      primaryAction={{
                        label: "View Purchase Orders",
                        onClick: () => setActiveTab("purchase-orders"),
                      }}
                    />
                  ) : (
                    <div className="space-y-3">
                      {dispatchedOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="rounded-xl border border-[#DCE5EE] bg-[#FAFBFD] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                {ord.order_number}
                              </span>
                              <StatusTag
                                label={getOrderStatusMeta(ord.status).label}
                                tone={getOrderStatusMeta(ord.status).tone}
                                compact
                              />
                            </div>
                            <p className="mt-1 text-xs text-[#5D6F82]">
                              {ord.items?.length || 0} line item(s) · Value {formatInr(ord.total_inr)}
                            </p>
                          </div>
                          <Link
                            href={`/orders/${ord.id}`}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0B1F35] px-3.5 text-xs font-semibold text-white hover:bg-[#076864]"
                          >
                            Open Shipment Details
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 5: MY WAREHOUSE INVENTORY */}
              {activeTab === "inventory" && (
                <div className="space-y-6">
                  <SectionCard
                    kicker="Isolated Distributor Stock"
                    title="My Warehouse Stock Buckets"
                    description="Your distributor warehouse inventory is strictly isolated from Sai Ajantha Central Warehouse stock. Units credit into Saleable stock only after confirmed goods receipt."
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {[
                        {
                          label: "Saleable",
                          count: "0",
                          desc: "Verified units ready for regional allocation",
                        },
                        {
                          label: "Reserved",
                          count: "0",
                          desc: "Allocated against confirmed dealer orders",
                        },
                        {
                          label: "In-Transit",
                          count: String(dispatchedOrders.length),
                          desc: "Inbound shipments en route from Trichy",
                        },
                        {
                          label: "Damaged",
                          count: "0",
                          desc: "Quarantined pending inspection claim",
                        },
                        {
                          label: "Shortage",
                          count: "0",
                          desc: "Reported receipt discrepancies",
                        },
                      ].map((bucket) => (
                        <div
                          key={bucket.label}
                          className="rounded-xl border border-[#DCE5EE] bg-[#FAFBFD] p-4"
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#5D6F82]">
                            {bucket.label}
                          </p>
                          <p className="mt-1 font-display text-2xl font-bold text-[#0B1F35] sa-tabular">
                            {bucket.count}
                          </p>
                          <p className="mt-1 text-[11px] text-[#64748B] leading-snug">
                            {bucket.desc}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5">
                      <EmptyStatePanel
                        icon={<Warehouse className="size-5" />}
                        title="No received warehouse stock on hand yet"
                        description="Complete an inbound Purchase Order and confirm goods receipt to populate your SKU-level distributor warehouse ledger."
                        primaryAction={{
                          label: "Order Stock from Sai Ajantha",
                          onClick: () => setActiveTab("buy-stock"),
                        }}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* TAB 6: TERRITORY COVERAGE */}
              {activeTab === "territory" && (
                <SectionCard
                  kicker="Regional Governance"
                  title="Territory PIN Coverage & Routing Check"
                  description="Test how customer and dealer enquiries for House of Ajantha products route across delivery PIN codes."
                >
                  <form onSubmit={handleCheckTerritory} className="max-w-xl space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={territoryPin}
                        onChange={(e) =>
                          setTerritoryPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="Enter 6-digit PIN code (e.g. 620001)"
                        aria-label="Territory PIN code"
                        className="flex-1 min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-4 text-sm sa-tabular"
                      />
                      <button
                        type="submit"
                        disabled={checkingTerritory}
                        className="min-h-[44px] rounded-xl bg-[#0B1F35] px-5 text-xs font-semibold text-white hover:bg-[#076864] cursor-pointer"
                      >
                        {checkingTerritory ? "Checking..." : "Verify PIN"}
                      </button>
                    </div>

                    {territoryResult && (
                      <div className="rounded-xl border border-[#C5E3E0] bg-[#F1FAF9] p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <StatusTag
                            label={territoryResult.sellerType || "ROUTED"}
                            tone="info"
                            compact
                          />
                          <p className="text-sm font-bold text-[#0B1F35]">
                            {territoryResult.sellerName}
                          </p>
                        </div>
                        <p className="text-xs text-[#354B62]">{territoryResult.message}</p>
                      </div>
                    )}
                  </form>
                </SectionCard>
              )}

              {/* TAB 7: DEALER INVITATIONS & RESALE PIPELINE */}
              {activeTab === "dealers" && (
                <div className="space-y-6">
                  <CommercialGateBanner
                    tone="warning"
                    title="Distributor Online Resale Checkout & Payment Capture Are Disabled"
                    description="Per commercial policy, distributor-to-dealer online payment capture, automated settlement, and self-service refunds remain off. Regional resale operates through verified dealer onboarding and offline quotations."
                  />

                  <SectionCard
                    kicker="Dealer Network"
                    title="Invite a Hardware Dealer into Your Territory"
                    description="Submit verified dealer business details so the Sai Ajantha admin team can review and onboard them under your regional network."
                  >
                    {inviteSuccessRef && (
                      <div className="mb-5 rounded-xl border border-[#A7DFD0] bg-[#E6F6F2] p-4 flex items-start gap-3">
                        <ClipboardCheck className="size-5 text-[#065F46] shrink-0 mt-0.5" />
                        <div className="text-xs text-[#065F46]">
                          <p className="font-bold">Dealer Invitation Logged</p>
                          <p className="mt-0.5">
                            Reference <strong className="font-mono">{inviteSuccessRef}</strong> has
                            been forwarded to the Sai Ajantha onboarding desk for approval.
                          </p>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSendDealerInvite} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="inv-name" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Dealer Contact Name *
                          </label>
                          <input
                            id="inv-name"
                            type="text"
                            required
                            value={inviteForm.dealerName}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, dealerName: e.target.value })
                            }
                            placeholder="Proprietor / Manager Name"
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="inv-org" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Hardware Shop / Firm Name *
                          </label>
                          <input
                            id="inv-org"
                            type="text"
                            required
                            value={inviteForm.organization}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, organization: e.target.value })
                            }
                            placeholder="e.g. Sri Murugan Hardware"
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="inv-phone" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Mobile Number *
                          </label>
                          <input
                            id="inv-phone"
                            type="tel"
                            required
                            value={inviteForm.phone}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, phone: e.target.value })
                            }
                            placeholder="10-digit mobile"
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="inv-email" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Email Address
                          </label>
                          <input
                            id="inv-email"
                            type="email"
                            value={inviteForm.email}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, email: e.target.value })
                            }
                            placeholder="dealer@shop.com"
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="inv-city" className="block text-xs font-semibold text-[#354B62] mb-1">
                            City / Operating PINs
                          </label>
                          <input
                            id="inv-city"
                            type="text"
                            value={inviteForm.city}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, city: e.target.value })
                            }
                            placeholder="e.g. Thanjavur, 613001"
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="inv-notes" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Territory / Category Notes
                          </label>
                          <input
                            id="inv-notes"
                            type="text"
                            value={inviteForm.notes}
                            onChange={(e) =>
                              setInviteForm({ ...inviteForm, notes: e.target.value })
                            }
                            placeholder="Door Closers, Kitchen Baskets..."
                            className="w-full min-h-[42px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={sendingInvite}
                        className="min-h-[44px] rounded-xl bg-[#076864] px-5 text-xs font-semibold text-white hover:bg-[#05524F] disabled:opacity-50 cursor-pointer"
                      >
                        {sendingInvite ? "Submitting Invitation..." : "Submit Dealer Invitation"}
                      </button>
                    </form>
                  </SectionCard>
                </div>
              )}

              {/* TAB 8: ACCOUNT & GOVERNANCE */}
              {activeTab === "profile" && (
                <SectionCard
                  kicker="Business Identity"
                  title="Distributor Account & Commercial Governance"
                >
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5D6F82]">
                        Organization
                      </dt>
                      <dd className="mt-1 font-bold text-[#0B1F35]">
                        {user.organization || user.name}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5D6F82]">
                        GSTIN
                      </dt>
                      <dd className="mt-1 font-mono font-bold text-[#0B1F35]">
                        {user.gstin || "Not provided"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5D6F82]">
                        Primary Territory / City
                      </dt>
                      <dd className="mt-1 font-bold text-[#0B1F35]">
                        {user.businessCity || "Tamil Nadu"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-[#E4ECF3] bg-[#FAFBFD] p-4">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#5D6F82]">
                        Registered Contact
                      </dt>
                      <dd className="mt-1 font-bold text-[#0B1F35]">
                        {user.name} · {user.email}
                      </dd>
                    </div>
                  </dl>
                </SectionCard>
              )}
            </PortalShell>
          )}
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
