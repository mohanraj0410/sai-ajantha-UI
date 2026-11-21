"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Heart,
  LayoutDashboard,
  Lock,
  MapPin,
  Package,
  Plus,
  Printer,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PortalShell, type PortalNavItem } from "@/components/non-home/PortalShell";
import {
  EmptyStatePanel,
  KpiStatRow,
  SectionCard,
  StatusTag,
} from "@/components/non-home/PortalPrimitives";
import { useStore, type SavedAddress } from "@/components/StoreProvider";
import {
  formatInr,
  getApprovalStatusMeta,
  getOrderStatusMeta,
  getProductSku,
  isFloorSpringProduct,
  summarizeOrders,
  type PortalOrderRecord,
} from "@/lib/portal-helpers";

type CustomerTab = "overview" | "orders" | "shortlist" | "quotes" | "addresses" | "profile";

export default function CustomerAccountPage() {
  const router = useRouter();
  const {
    session: user,
    authLoading,
    signOut: logout,
    refreshAuthAndCatalog: refreshSession,
    showToast,
    wishlistIds,
    toggleWishlist,
    cart,
    cartCount,
    catalogProducts,
    addToCart,
    getAuthorizedUnitPrice: getEffectiveProductPrice,
    effectivePriceTier,
  } = useStore();
  const authLoaded = !authLoading;

  const [activeTab, setActiveTab] = useState<CustomerTab>("overview");
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [orders, setOrders] = useState<PortalOrderRecord[]>([]);
  const [realQuotes, setRealQuotes] = useState<any[]>([]);
  const [realEnquiries, setRealEnquiries] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [revisionQuoteId, setRevisionQuoteId] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [respondingToQuote, setRespondingToQuote] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"ALL" | "ACTIVE" | "QUOTES" | "DELIVERED" | "CANCELLED">("ALL");

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    organization: "",
    gstin: "",
    businessCity: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "Home / Site Delivery",
    recipient: "",
    organization: "",
    line1: "",
    city: "Trichy",
    state: "Tamil Nadu",
    pincode: "",
    phone: "",
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadAccountData() {
      setLoadingData(true);
      try {
        const [addrRes, ordRes, quoteRes, enqRes] = await Promise.all([
          fetch("/api/addresses", { cache: "no-store" }),
          fetch("/api/orders", { cache: "no-store" }),
          fetch("/api/quotes", { cache: "no-store" }),
          fetch("/api/enquiries", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        setProfileForm({
          name: user?.name || "",
          phone: user?.phone || "",
          organization: user?.organization || "",
          gstin: user?.gstin || "",
          businessCity: user?.businessCity || "",
        });
        setNewAddress((prev) => ({
          ...prev,
          recipient: prev.recipient || user?.name || "",
          organization: prev.organization || user?.organization || "",
          phone: prev.phone || user?.phone || "",
        }));
        if (addrRes.ok) {
          const data = await addrRes.json();
          setAddresses(data.addresses || []);
        }
        if (ordRes.ok) {
          const data = await ordRes.json();
          setOrders(data.orders || []);
        }
        if (quoteRes.ok) {
          const qData = await quoteRes.json();
          setRealQuotes(qData.quotes || []);
        }
        if (enqRes && enqRes.ok) {
          const enqData = await enqRes.json();
          setRealEnquiries(enqData.enquiries || []);
        }
      } catch {
        // Handled silently; empty states show cleanly
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }
    loadAccountData();
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

  const orderSummary = useMemo(() => summarizeOrders(orders), [orders]);

  const shortlistedProducts = useMemo(() => {
    const idSet = new Set(wishlistIds);
    return catalogProducts.filter((p) => idSet.has(p.id));
  }, [catalogProducts, wishlistIds]);

  const quoteOrders = useMemo(
    () => orders.filter((o) => (o.status || "").toUpperCase() === "QUOTE_REQUESTED"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (orderFilter === "ALL") return orders;
    return orders.filter((o) => {
      const s = (o.status || "").toUpperCase();
      if (orderFilter === "QUOTES") return s === "QUOTE_REQUESTED";
      if (orderFilter === "DELIVERED") return s === "DELIVERED" || s === "COMPLETED";
      if (orderFilter === "CANCELLED") return s === "CANCELLED" || s === "REJECTED";
      return s !== "QUOTE_REQUESTED" && s !== "DELIVERED" && s !== "COMPLETED" && s !== "CANCELLED" && s !== "REJECTED";
    });
  }, [orders, orderFilter]);

  const cartEstimate = useMemo(() => {
    return cart.reduce((acc, item) => {
      const unit = item.unitPriceInr ?? 0;
      return acc + unit * item.quantity;
    }, 0);
  }, [cart]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      showToast("Full name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to update profile.");
        return;
      }
      await refreshSession();
      showToast("Profile updated successfully.");
    } catch {
      showToast("Network error while saving profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddress.recipient.trim() || !newAddress.line1.trim() || !newAddress.city.trim()) {
      showToast("Recipient name, street address, and city are required.");
      return;
    }
    if (newAddress.pincode && !/^\d{6}$/.test(newAddress.pincode.trim())) {
      showToast("Please enter a valid 6-digit PIN code.");
      return;
    }
    setSavingAddress(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Unable to save address.");
        return;
      }
      setAddresses((prev) => [data.address, ...prev]);
      setNewAddress({
        label: "Home / Site Delivery",
        recipient: user?.name || "",
        organization: user?.organization || "",
        line1: "",
        city: "Trichy",
        state: "Tamil Nadu",
        pincode: "",
        phone: user?.phone || "",
      });
      setShowAddressForm(false);
      showToast("Delivery address saved.");
    } catch {
      showToast("Network error while saving address.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleDeleteAddress(id: string) {
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        showToast("Address removed.");
      }
    } catch {
      showToast("Unable to delete address.");
    }
  }

  const navItems: PortalNavItem[] = [
    {
      id: "overview",
      label: "Account Overview",
      icon: <LayoutDashboard className="size-4" />,
      group: "My Account",
    },
    {
      id: "orders",
      label: "Orders & Tracking",
      icon: <Package className="size-4" />,
      badge: orders.length || undefined,
      group: "My Account",
    },
    {
      id: "shortlist",
      label: "Saved Shortlist",
      icon: <Heart className="size-4" />,
      badge: wishlistIds.length || undefined,
      group: "My Account",
    },
    {
      id: "quotes",
      label: "Quotes & Enquiries",
      icon: <ClipboardList className="size-4" />,
      badge: quoteOrders.length || undefined,
      group: "My Account",
    },
    {
      id: "addresses",
      label: "Saved Addresses",
      icon: <MapPin className="size-4" />,
      badge: addresses.length || undefined,
      group: "Settings",
    },
    {
      id: "profile",
      label: "Profile & Security",
      icon: <User className="size-4" />,
      group: "Settings",
    },
  ];

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
                  Loading your account workspace...
                </p>
              </div>
            </div>
          ) : !user ? (
            <div className="sa-content-width py-12 sm:py-16">
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                <div className="md:col-span-7 sa-card p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <p className="sa-group-label">Customer Account</p>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F35] tracking-tight">
                      Sign in to manage orders, delivery sites &amp; saved products
                    </h1>
                    <p className="text-sm text-[#526477] leading-relaxed">
                      Access your Sai Ajantha buyer account to track orders across Tamil Nadu,
                      review submitted BOQ quotations, manage saved addresses, and reorder
                      architectural hardware seamlessly.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      {
                        title: "Order & Dispatch Tracking",
                        desc: "View confirmed orders, proforma references, and status updates.",
                      },
                      {
                        title: "Saved Delivery Addresses",
                        desc: "Store home or project site addresses for faster checkout.",
                      },
                      {
                        title: "Product Shortlist",
                        desc: "Save profiles, screens, and hardware to compare or quote.",
                      },
                      {
                        title: "Direct Consultation History",
                        desc: "Review BOQ requests and follow up with our Trichy desk.",
                      },
                    ].map((feat) => (
                      <div
                        key={feat.title}
                        className="rounded-xl border border-[#E4ECF3] bg-[#F9FBFD] p-3.5"
                      >
                        <p className="text-xs font-bold text-[#0B1F35]">{feat.title}</p>
                        <p className="mt-1 text-[11px] text-[#5D6F82] leading-relaxed">
                          {feat.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href="/login"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0B1F35] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#076864] transition-colors"
                    >
                      Sign In
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href="/register"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#C5D3E0] bg-white px-5 py-2.5 text-sm font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
                    >
                      Create Buyer Account
                    </Link>
                  </div>
                </div>

                <div className="md:col-span-5 rounded-2xl bg-[#0B1F35] text-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#58DDE2]">
                      Trade &amp; Channel Accounts
                    </p>
                    <h2 className="font-display text-xl font-bold">
                      Ordering for a hardware shop or regional distribution?
                    </h2>
                    <p className="text-xs sm:text-sm text-[#C3D3E3] leading-relaxed">
                      Dealers and Distributors use dedicated portals with role-verified wholesale
                      pricing, BOQ workflows, and territory routing after admin approval.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <Link
                      href="/dealer"
                      className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-xs font-semibold hover:bg-white/[0.12] transition-colors"
                    >
                      <span>Dealer Trade Portal</span>
                      <ArrowRight className="size-4 text-[#58DDE2]" />
                    </Link>
                    <Link
                      href="/distributor"
                      className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-xs font-semibold hover:bg-white/[0.12] transition-colors"
                    >
                      <span>Distributor Operations Portal</span>
                      <ArrowRight className="size-4 text-[#58DDE2]" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PortalShell
              roleTheme="customer"
              portalLabel="Customer Portal"
              title={`Welcome back, ${user.name.split(" ")[0]}`}
              subtitle="Track orders, manage saved delivery sites, review quotations, and access your shortlisted architectural products."
              userName={user.name}
              userMeta={user.email}
              statusBadge={getApprovalStatusMeta(user.approvalStatus)}
              priceTierLabel={effectivePriceTier === "CUSTOMER" ? "Standard Retail" : effectivePriceTier}
              navItems={navItems}
              activeTab={activeTab}
              onSelectTab={(id) => setActiveTab(id as CustomerTab)}
              onLogout={async () => {
                await logout();
                router.push("/");
              }}
              headerActions={
                <>
                  <Link
                    href="/products"
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#076864] px-4 text-xs font-semibold text-white hover:bg-[#05524F] transition-colors"
                  >
                    <ShoppingBag className="size-3.5" />
                    Browse Catalogue
                  </Link>
                  <Link
                    href="/cart"
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
                  >
                    Cart ({cartCount})
                  </Link>
                </>
              }
              sidebarFooter={
                (user.role === "DEALER" || user.role === "DISTRIBUTOR") && (
                  <Link
                    href={user.role === "DEALER" ? "/dealer" : "/distributor"}
                    className="w-full min-h-[40px] flex items-center justify-between rounded-xl bg-[#E9F6F5] border border-[#BFE4E0] px-3 py-2 text-xs font-bold text-[#076864] hover:bg-[#DAF0EE] transition-colors"
                  >
                    <span>
                      Open {user.role === "DEALER" ? "Dealer" : "Distributor"} Portal
                    </span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                )
              }
            >
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <>
                  <KpiStatRow
                    items={[
                      {
                        label: "Total Orders",
                        value: orderSummary.totalCount,
                        detail: `${orderSummary.activeCount} active · ${orderSummary.deliveredCount} delivered`,
                      },
                      {
                        label: "Open Quotations",
                        value: orderSummary.quoteCount,
                        detail: "BOQ & project pricing requests",
                      },
                      {
                        label: "Saved Shortlist",
                        value: wishlistIds.length,
                        detail: "Products bookmarked",
                      },
                      {
                        label: "Active Cart",
                        value: cartCount,
                        detail:
                          cartCount > 0
                            ? `Est. ${formatInr(cartEstimate)}`
                            : "Ready to add products",
                        accent: cartCount > 0,
                      },
                    ]}
                  />

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Recent Orders */}
                    <SectionCard
                      className="xl:col-span-7"
                      kicker="Activity"
                      title="Recent Orders & Quotations"
                      description="Latest orders and BOQ quotes recorded under your account."
                      actions={
                        <button
                          type="button"
                          onClick={() => setActiveTab("orders")}
                          className="text-xs font-semibold text-[#076864] hover:underline cursor-pointer"
                        >
                          View all ({orders.length})
                        </button>
                      }
                      padded={false}
                    >
                      {loadingData ? (
                        <div className="p-6 text-xs text-[#5D6F82]">Loading your order history...</div>
                      ) : orders.length === 0 ? (
                        <div className="p-6">
                          <EmptyStatePanel
                            icon={<Package className="size-5" />}
                            title="No orders placed yet"
                            description="Explore our architectural hardware, insect screens, aluminium profiles, and kitchen wireware to place an order or request a custom BOQ quote."
                            primaryAction={{ label: "Explore Catalogue", href: "/products" }}
                            secondaryAction={{ label: "Request Consultation", href: "/contact" }}
                          />
                        </div>
                      ) : (
                        <div className="divide-y divide-[#EDF2F7]">
                          {orders.slice(0, 5).map((ord) => {
                            const statusMeta = getOrderStatusMeta(ord.status);
                            return (
                              <Link
                                key={ord.id}
                                href={`/orders/${ord.id}`}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 hover:bg-[#F8FAFC] transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                      {ord.order_number}
                                    </span>
                                    <StatusTag label={statusMeta.label} tone={statusMeta.tone} compact />
                                  </div>
                                  <p className="mt-1 text-xs text-[#5D6F82]">
                                    {new Date(ord.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}{" "}
                                    · {ord.items?.length || 0} line item(s) · {ord.payment_method}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-bold text-[#0B1F35] sa-tabular">
                                    {formatInr(ord.total_inr)}
                                  </span>
                                  <ArrowRight className="size-4 text-[#7B8FA3]" />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>

                    {/* Right Side: Cart Summary + Saved Addresses Snapshot */}
                    <div className="xl:col-span-5 space-y-6">
                      <SectionCard
                        kicker="Active Basket"
                        title="Cart & Quick Actions"
                        actions={
                          <Link
                            href="/cart"
                            className="text-xs font-semibold text-[#076864] hover:underline"
                          >
                            Open Cart
                          </Link>
                        }
                      >
                        {cart.length === 0 ? (
                          <p className="text-xs text-[#5D6F82] leading-relaxed">
                            Your shopping cart is empty. Browse 281 verified SKUs across 11 product
                            categories to build an order or BOQ shortlist.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#5D6F82]">Items in cart</span>
                              <span className="font-bold text-[#0B1F35] sa-tabular">
                                {cartCount} units ({cart.length} SKUs)
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#5D6F82]">Estimated subtotal</span>
                              <span className="font-bold text-[#076864] sa-tabular">
                                {formatInr(cartEstimate)}
                              </span>
                            </div>
                            <Link
                              href="/checkout"
                              className="mt-2 w-full inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] transition-colors"
                            >
                              Continue to Checkout
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-[#E7EEF4] grid grid-cols-2 gap-2">
                          <Link
                            href="/quotes"
                            className="rounded-xl border border-[#DCE5EE] bg-[#F8FAFC] px-3 py-2.5 text-center text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
                          >
                            Request Quote
                          </Link>
                          <Link
                            href="/contact"
                            className="rounded-xl border border-[#DCE5EE] bg-[#F8FAFC] px-3 py-2.5 text-center text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
                          >
                            Support Desk
                          </Link>
                        </div>
                      </SectionCard>

                      <SectionCard
                        kicker="Delivery Book"
                        title="Saved Addresses"
                        actions={
                          <button
                            type="button"
                            onClick={() => setActiveTab("addresses")}
                            className="text-xs font-semibold text-[#076864] hover:underline cursor-pointer"
                          >
                            Manage ({addresses.length})
                          </button>
                        }
                      >
                        {addresses.length === 0 ? (
                          <div className="space-y-3">
                            <p className="text-xs text-[#5D6F82]">
                              No delivery site or home address saved yet.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab("addresses");
                                setShowAddressForm(true);
                              }}
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#C5D3E0] px-3 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                            >
                              <Plus className="size-3.5" />
                              Add Delivery Address
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {addresses.slice(0, 2).map((addr) => (
                              <div
                                key={addr.id}
                                className="rounded-xl border border-[#E4ECF3] bg-[#F9FBFD] p-3 text-xs"
                              >
                                <p className="font-bold text-[#0B1F35]">
                                  {addr.label} · {addr.recipient}
                                </p>
                                <p className="mt-0.5 text-[#5D6F82]">
                                  {addr.line1}, {addr.city} {addr.pincode}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </SectionCard>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: ORDERS & TRACKING */}
              {activeTab === "orders" && (
                <SectionCard
                  kicker="Order History"
                  title="My Orders & Dispatch Tracking"
                  description="Review every order, proforma reference, and status timeline associated with your account."
                  actions={
                    <div className="flex flex-wrap gap-1.5">
                      {(["ALL", "ACTIVE", "QUOTES", "DELIVERED", "CANCELLED"] as const).map(
                        (f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setOrderFilter(f)}
                            className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-semibold border transition-colors cursor-pointer ${
                              orderFilter === f
                                ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                                : "border-[#DCE5EE] bg-white text-[#475569] hover:border-[#076864]"
                            }`}
                          >
                            {f === "ALL"
                              ? `All (${orders.length})`
                              : f.charAt(0) + f.slice(1).toLowerCase()}
                          </button>
                        )
                      )}
                    </div>
                  }
                  padded={false}
                >
                  {loadingData ? (
                    <div className="p-6 text-xs text-[#5D6F82]">Loading orders...</div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="p-6">
                      <EmptyStatePanel
                        icon={<Package className="size-5" />}
                        title="No matching orders"
                        description={
                          orders.length === 0
                            ? "You haven't placed an order yet. Browse our catalogue to get started."
                            : "No orders match the selected status filter."
                        }
                        primaryAction={
                          orders.length === 0
                            ? { label: "Browse Catalogue", href: "/products" }
                            : { label: "Show All Orders", onClick: () => setOrderFilter("ALL") }
                        }
                      />
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>Order Ref</th>
                              <th>Date</th>
                              <th>Items</th>
                              <th>Status</th>
                              <th>Payment</th>
                              <th className="text-right">Total</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.map((ord) => {
                              const statusMeta = getOrderStatusMeta(ord.status);
                              const payMeta = getOrderStatusMeta(ord.payment_status);
                              return (
                                <tr key={ord.id}>
                                  <td className="font-mono text-xs font-bold text-[#0B1F35]">
                                    {ord.order_number}
                                  </td>
                                  <td className="text-xs text-[#5D6F82] whitespace-nowrap">
                                    {new Date(ord.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td className="text-xs text-[#3D4F63] sa-tabular">
                                    {ord.items?.length || 0} item(s)
                                  </td>
                                  <td>
                                    <StatusTag label={statusMeta.label} tone={statusMeta.tone} compact />
                                  </td>
                                  <td>
                                    <StatusTag label={payMeta.label} tone={payMeta.tone} compact />
                                  </td>
                                  <td className="text-right font-bold text-[#0B1F35] sa-tabular">
                                    {formatInr(ord.total_inr)}
                                  </td>
                                  <td className="text-right">
                                    <Link
                                      href={`/orders/${ord.id}`}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#076864] hover:underline"
                                    >
                                      Details
                                      <ExternalLink className="size-3" />
                                    </Link>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked Cards */}
                      <div className="md:hidden divide-y divide-[#E7EEF4]">
                        {filteredOrders.map((ord) => {
                          const statusMeta = getOrderStatusMeta(ord.status);
                          return (
                            <div key={ord.id} className="p-4 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                  {ord.order_number}
                                </span>
                                <StatusTag label={statusMeta.label} tone={statusMeta.tone} compact />
                              </div>
                              <div className="flex items-center justify-between text-xs text-[#5D6F82]">
                                <span>
                                  {new Date(ord.created_at).toLocaleDateString("en-IN")} ·{" "}
                                  {ord.items?.length || 0} item(s)
                                </span>
                                <span className="font-bold text-[#0B1F35] sa-tabular">
                                  {formatInr(ord.total_inr)}
                                </span>
                              </div>
                              <Link
                                href={`/orders/${ord.id}`}
                                className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-semibold text-[#076864]"
                              >
                                View Order &amp; Tracking
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </SectionCard>
              )}

              {/* TAB 3: SAVED SHORTLIST */}
              {activeTab === "shortlist" && (
                <SectionCard
                  kicker="Wishlist"
                  title={`Saved Shortlist (${shortlistedProducts.length})`}
                  description="Products bookmarked for your home or renovation project."
                  actions={
                    <Link
                      href="/products"
                      className="text-xs font-semibold text-[#076864] hover:underline"
                    >
                      Browse more products
                    </Link>
                  }
                >
                  {shortlistedProducts.length === 0 ? (
                    <EmptyStatePanel
                      icon={<Bookmark className="size-5" />}
                      title="Your shortlist is empty"
                      description="Tap the heart icon on any product in our catalogue to save it here for quick comparison or ordering."
                      primaryAction={{ label: "Browse Products", href: "/products" }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {shortlistedProducts.map((item) => {
                        const floorSpring = isFloorSpringProduct(item);
                        const price = getEffectiveProductPrice(item.id);
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-[#DCE5EE] bg-white overflow-hidden flex flex-col"
                          >
                            <Link
                              href={`/products/${item.id}`}
                              className="relative aspect-[4/3] bg-[#F6F9FC] border-b border-[#EDF2F7] block"
                            >
                              <Image
                                src={item.src}
                                alt={item.name}
                                fill
                                sizes="(max-width: 640px) 100vw, 33vw"
                                className="object-contain p-4"
                              />
                            </Link>
                            <div className="p-4 flex-1 flex flex-col gap-2">
                              <p className="text-[11px] font-semibold text-[#5D6F82]">
                                {item.category} · <span className="font-mono">{getProductSku(item)}</span>
                              </p>
                              <Link
                                href={`/products/${item.id}`}
                                className="text-sm font-bold text-[#0B1F35] hover:text-[#076864] line-clamp-2"
                              >
                                {item.name}
                              </Link>
                              <p className="text-sm font-bold text-[#076864] sa-tabular">
                                {floorSpring ? "Enquiry / Quote Only" : formatInr(price)}
                              </p>
                              <div className="mt-auto pt-2 flex items-center gap-2">
                                {floorSpring ? (
                                  <Link
                                    href={`/contact?sku=${encodeURIComponent(getProductSku(item))}`}
                                    className="flex-1 min-h-[38px] inline-flex items-center justify-center rounded-lg bg-[#0B1F35] px-3 text-xs font-semibold text-white hover:bg-[#076864]"
                                  >
                                    Request Quote
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item, { quantity: 1 })}
                                    className="flex-1 min-h-[38px] rounded-lg bg-[#076864] px-3 text-xs font-semibold text-white hover:bg-[#05524F] cursor-pointer"
                                  >
                                    Add to Cart
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleWishlist(item.id)}
                                  aria-label={`Remove ${item.name} from shortlist`}
                                  className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#DCE5EE] text-[#64748B] hover:border-[#FCA5A5] hover:text-[#B91C1C] cursor-pointer"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 4: QUOTES & ENQUIRIES */}
              {activeTab === "quotes" && (
                <SectionCard
                  kicker="Quotations"
                  title="BOQ Quotations & Project Enquiries"
                  description="Review verified trade quotations issued by Sai Ajantha and authorized regional distributors. Accept, request revisions, or download official estimates."
                  actions={
                    <Link
                      href="/contact"
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0B1F35] px-3.5 text-xs font-semibold text-white hover:bg-[#076864]"
                    >
                      New Enquiry
                      <ArrowRight className="size-3.5" />
                    </Link>
                  }
                >
                  {realQuotes.length === 0 && quoteOrders.length === 0 ? (
                    <EmptyStatePanel
                      icon={<ClipboardList className="size-5" />}
                      title="No saved quotation records yet"
                      description="For custom door schedules, hydraulic floor springs, or multi-room mosquito screen packages, submit a quote request to our Trichy desk."
                      primaryAction={{ label: "Open Quotation Desk", href: "/quotes" }}
                      secondaryAction={{ label: "Contact Technical Desk", href: "/contact" }}
                    />
                  ) : (
                    <div className="space-y-6">
                      {/* Real Trade Quotes from Medusa */}
                      {realQuotes.map((q) => {
                        const isService = q.is_service_quote;
                        const isActionable = q.status === "SHARED_NONPAYABLE";
                        const isAccepted = q.status === "ACCEPTED";
                        const isConverted = q.status === "CONVERTED_TO_ORDER";
                        const isRevisionRequested = q.status === "REVISION_REQUESTED";
                        const isDeclined = q.status === "REJECTED";
                        const totalVal = q.total_inr || (q.subtotal_inr + (q.tax_inr || Math.round((q.subtotal_inr || 0) * 0.18)));

                        return (
                          <div
                            key={q.id}
                            className="rounded-xl border border-[#DCE5EE] bg-white overflow-hidden shadow-sm"
                          >
                            {/* Card Header */}
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
                                  {q.title || (isService ? "Installation & Site Fitting Estimate" : "Commercial Material Quotation")}
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

                            {/* Card Body - Line Items */}
                            <div className="p-4 sm:p-5">
                              {q.items && q.items.length > 0 ? (
                                <div className="sa-table-wrap border rounded-lg border-[#E7EEF4] overflow-x-auto">
                                  <table className="sa-table w-full text-xs">
                                    <thead>
                                      <tr className="bg-[#F8FAFC] border-b border-[#E7EEF4]">
                                        <th className="text-left py-2.5 px-3">Item / Description</th>
                                        <th className="text-left py-2.5 px-3">SKU / Size</th>
                                        <th className="text-right py-2.5 px-3">Qty</th>
                                        <th className="text-right py-2.5 px-3">Rate (INR)</th>
                                        <th className="text-right py-2.5 px-3">Amount (INR)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E7EEF4]">
                                      {q.items.map((it: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-3 font-semibold text-[#0B1F35]">
                                            {it.title || it.name || it.description || `Item #${idx + 1}`}
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
                                            {formatInr(it.total_inr || (it.quantity || 1) * (it.unit_price_inr || it.rate || 0))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-[#5D6F82] italic">
                                  Lump sum quotation estimate as per enquiry specifications.
                                </p>
                              )}

                              {/* Price breakdown */}
                              <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-3 border-t border-[#E7EEF4]">
                                <div className="text-xs text-[#5D6F82] space-y-1">
                                  {isService ? (
                                    <p className="text-amber-800 font-medium">
                                      ⚠️ Installation service fee is billed directly by verified independent contractor.
                                    </p>
                                  ) : (
                                    <p>Applicable GST (18%) and transit freight included in calculated totals.</p>
                                  )}
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
                                    <span className="font-mono">{formatInr(q.tax_inr || Math.round((q.subtotal_inr || 0) * 0.18))}</span>
                                  </div>
                                  <div className="flex justify-between text-sm font-bold text-[#076864] pt-1 border-t border-[#DCE5EE]">
                                    <span>Total Value:</span>
                                    <span className="font-mono text-base">{formatInr(totalVal)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer / Actions */}
                            <div className="px-4 py-3 bg-[#FAFBFD] border-t border-[#E7EEF4]">
                              {isActionable && (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-[#354B62] font-medium">
                                      Please review terms and respond to confirm this quotation.
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
                                          if (confirm("Are you sure you want to decline this quotation?")) {
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
                                        placeholder="e.g. Please update quantity to 20 units and include delivery to Thillai Nagar site..."
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
                                      Quotation accepted on {q.customer_response_at ? new Date(q.customer_response_at).toLocaleDateString("en-IN") : "record"}. Sai Ajantha desk is preparing dispatch proforma.
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

                      {/* Real Trade Enquiries from dms_trade_enquiry */}
                      {realEnquiries.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-[#E7EEF4]">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5D6F82]">
                            My Product & Project Enquiries ({realEnquiries.length})
                          </h4>
                          {realEnquiries.map((enq) => {
                            const isInstall = enq.lead_type === "INSTALLATION";
                            const itemsArr = Array.isArray(enq.items) ? enq.items : [];
                            return (
                              <div
                                key={enq.id}
                                className="rounded-xl border border-[#DCE5EE] bg-[#FAFBFD] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                      #{enq.id.slice(-8).toUpperCase()}
                                    </span>
                                    <span className="text-xs text-[#5D6F82]">
                                      {enq.division || "Hardware Enquiry"}
                                    </span>
                                    <StatusTag
                                      label={enq.status.replace(/_/g, " ")}
                                      tone={
                                        enq.status === "QUOTED" || enq.status === "QUOTE_ACCEPTED" || enq.status === "CONVERTED_TO_ORDER"
                                          ? "success"
                                          : enq.status === "NEW" || enq.status === "IN_REVIEW" || enq.status === "QUOTE_PREPARING"
                                          ? "warning"
                                          : "neutral"
                                      }
                                      compact
                                    />
                                    {isInstall ? (
                                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                        Installation Request
                                      </span>
                                    ) : enq.assigned_seller_name ? (
                                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                        Seller: {enq.assigned_seller_name}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                        Awaiting Regional Seller
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-[#5D6F82]">
                                    Submitted: {enq.created_at ? new Date(enq.created_at).toLocaleDateString("en-IN") : "Recent"}
                                    {enq.postal_code ? ` · Delivery PIN: ${enq.postal_code}` : ""}
                                    {itemsArr.length > 0 ? ` · ${itemsArr.length} Product item(s)` : ""}
                                  </p>
                                  {itemsArr.length > 0 && (
                                    <div className="mt-2 text-xs text-[#354B62] font-medium">
                                      {itemsArr.map((it: any, idx: number) => (
                                        <span key={idx} className="mr-3">
                                          • {it.name || it.sku} ({it.quantity || 1} qty)
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {enq.notes && (
                                    <p className="mt-1 text-xs text-[#5D6F82] italic">
                                      {enq.notes.slice(0, 120)}{enq.notes.length > 120 ? "..." : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Legacy Quote Requests */}
                      {quoteOrders.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-[#E7EEF4]">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#5D6F82]">
                            Storefront Enquiry Requests ({quoteOrders.length})
                          </h4>
                          {quoteOrders.map((q) => (
                            <div
                              key={q.id}
                              className="rounded-xl border border-[#DCE5EE] bg-[#FAFBFD] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-[#0B1F35]">
                                    {q.order_number}
                                  </span>
                                  <StatusTag label="Enquiry Submitted" tone="warning" compact />
                                </div>
                                <p className="mt-1 text-xs text-[#5D6F82]">
                                  Submitted {new Date(q.created_at).toLocaleDateString("en-IN")} ·{" "}
                                  {q.items?.length || 0} item(s)
                                </p>
                              </div>
                              <Link
                                href={`/orders/${q.id}`}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864]"
                              >
                                View Enquiry
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 5: SAVED ADDRESSES */}
              {activeTab === "addresses" && (
                <SectionCard
                  kicker="Delivery Book"
                  title="Saved Home & Project Addresses"
                  description="Manage delivery addresses for faster checkout and PIN-based seller routing."
                  actions={
                    <button
                      type="button"
                      onClick={() => setShowAddressForm((v) => !v)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#076864] px-3.5 text-xs font-semibold text-white hover:bg-[#05524F] cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      {showAddressForm ? "Close Form" : "Add Address"}
                    </button>
                  }
                >
                  {showAddressForm && (
                    <form
                      onSubmit={handleAddAddress}
                      className="mb-6 rounded-xl border border-[#C5E3E0] bg-[#F5FBFA] p-4 sm:p-5 space-y-4"
                    >
                      <p className="text-xs font-bold text-[#0B1F35]">Add New Delivery Address</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label htmlFor="addr-label" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Address Label *
                          </label>
                          <input
                            id="addr-label"
                            type="text"
                            required
                            value={newAddress.label}
                            onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                            placeholder="e.g. Home, Site Office"
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="addr-recipient" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Recipient Name *
                          </label>
                          <input
                            id="addr-recipient"
                            type="text"
                            required
                            value={newAddress.recipient}
                            onChange={(e) => setNewAddress({ ...newAddress, recipient: e.target.value })}
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="addr-line1" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Street Address / Site Location *
                          </label>
                          <input
                            id="addr-line1"
                            type="text"
                            required
                            value={newAddress.line1}
                            onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                            placeholder="Door No., Street, Landmark"
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="addr-city" className="block text-xs font-semibold text-[#354B62] mb-1">
                            City / District *
                          </label>
                          <input
                            id="addr-city"
                            type="text"
                            required
                            value={newAddress.city}
                            onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="addr-pin" className="block text-xs font-semibold text-[#354B62] mb-1">
                            6-Digit PIN Code *
                          </label>
                          <input
                            id="addr-pin"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={newAddress.pincode}
                            onChange={(e) =>
                              setNewAddress({
                                ...newAddress,
                                pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                              })
                            }
                            placeholder="620001"
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35] sa-tabular"
                          />
                        </div>
                        <div>
                          <label htmlFor="addr-phone" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Contact Mobile
                          </label>
                          <input
                            id="addr-phone"
                            type="tel"
                            value={newAddress.phone}
                            onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="addr-state" className="block text-xs font-semibold text-[#354B62] mb-1">
                            State
                          </label>
                          <input
                            id="addr-state"
                            type="text"
                            value={newAddress.state}
                            onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                            className="w-full min-h-[42px] rounded-lg border border-[#C5D3E0] bg-white px-3 text-sm text-[#0B1F35]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(false)}
                          className="min-h-[40px] rounded-lg border border-[#C5D3E0] bg-white px-4 text-xs font-semibold text-[#475569] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingAddress}
                          className="min-h-[40px] rounded-lg bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864] disabled:opacity-60 cursor-pointer"
                        >
                          {savingAddress ? "Saving..." : "Save Address"}
                        </button>
                      </div>
                    </form>
                  )}

                  {addresses.length === 0 ? (
                    <EmptyStatePanel
                      icon={<MapPin className="size-5" />}
                      title="No saved delivery addresses"
                      description="Save your home, office, or construction site address so you don't have to re-enter it during checkout."
                      primaryAction={{
                        label: "Add Your First Address",
                        onClick: () => setShowAddressForm(true),
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="rounded-xl border border-[#DCE5EE] bg-white p-4 flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#076864]">
                                {addr.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAddress(addr.id)}
                                aria-label={`Delete ${addr.label}`}
                                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#B91C1C] cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <p className="mt-1.5 text-sm font-bold text-[#0B1F35]">
                              {addr.recipient}
                            </p>
                            <p className="mt-1 text-xs text-[#526477] leading-relaxed">
                              {addr.line1}
                              <br />
                              {addr.city}, {addr.state} {addr.pincode}
                            </p>
                            {addr.phone && (
                              <p className="mt-1.5 text-xs text-[#5D6F82]">Phone: {addr.phone}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 6: PROFILE & SECURITY */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <SectionCard
                    kicker="Personal Details"
                    title="Profile & Billing Information"
                    description="Keep your contact details and optional GSTIN updated for smooth dispatch and invoice coordination."
                  >
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="prof-name" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Full Name *
                          </label>
                          <input
                            id="prof-name"
                            type="text"
                            required
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="prof-email" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Email Address
                          </label>
                          <input
                            id="prof-email"
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full min-h-[44px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-sm text-[#64748B]"
                          />
                        </div>
                        <div>
                          <label htmlFor="prof-phone" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Mobile Number
                          </label>
                          <input
                            id="prof-phone"
                            type="tel"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="prof-city" className="block text-xs font-semibold text-[#354B62] mb-1">
                            City / District
                          </label>
                          <input
                            id="prof-city"
                            type="text"
                            value={profileForm.businessCity}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, businessCity: e.target.value })
                            }
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="prof-org" className="block text-xs font-semibold text-[#354B62] mb-1">
                            Company / Firm Name (Optional)
                          </label>
                          <input
                            id="prof-org"
                            type="text"
                            value={profileForm.organization}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, organization: e.target.value })
                            }
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm text-[#0B1F35]"
                          />
                        </div>
                        <div>
                          <label htmlFor="prof-gst" className="block text-xs font-semibold text-[#354B62] mb-1">
                            GSTIN (Optional for B2C)
                          </label>
                          <input
                            id="prof-gst"
                            type="text"
                            value={profileForm.gstin}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                gstin: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="33XXXXX0000X1Z5"
                            className="w-full min-h-[44px] rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-sm font-mono text-[#0B1F35]"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#5D6F82]">
                          <CheckCircle2 className="size-4 text-[#076864]" />
                          Changes sync directly with your storefront account.
                        </span>
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="min-h-[44px] rounded-xl bg-[#0B1F35] px-5 text-xs font-semibold text-white hover:bg-[#076864] disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {savingProfile ? "Saving Changes..." : "Save Profile"}
                        </button>
                      </div>
                    </form>
                  </SectionCard>

                  <SectionCard
                    kicker="Account Security"
                    title="Password & Access Controls"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#0B1F35]">
                          <Lock className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0B1F35]">Password Recovery</p>
                          <p className="text-xs text-[#5D6F82]">
                            Need to update or reset your account password? Request a secure reset
                            link via email.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/forgot-password"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#C5D3E0] bg-white px-4 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] shrink-0"
                      >
                        Reset Password
                      </Link>
                    </div>
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
