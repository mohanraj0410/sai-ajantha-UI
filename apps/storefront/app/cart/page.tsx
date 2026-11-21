"use client";

import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";

import { PageHeader } from "@/components/non-home/PageHeader";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  FileQuestion,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StateFeedback } from "@/components/StateFeedback";
import { useStore } from "@/components/StoreProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  COMMERCIAL_FLAGS,
  groupCartItemsBySeller,
} from "@/lib/commercial-policy";
import { formatInr } from "@/lib/productSpecs";

interface ServerQuoteState {
  priceTierApplied: string;
  subtotalInr: number;
  gstAmountInr: number;
  totalInr: number;
  hasQuoteItems: boolean;
}

export default function CartPage() {
  const {
    cart,
    cartCount,
    effectivePriceTier,
    session,
    deliveryPincode,
    setDeliveryPincode,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    showToast,
  } = useStore();

  const [pinOverride, setPinOverride] = useState<string | null>(null);
  const pinDraft = pinOverride ?? deliveryPincode;
  const setPinDraft = (val: string) => setPinOverride(val);
  const [pinError, setPinError] = useState<string | null>(null);
  const [revalidatedNote, setRevalidatedNote] = useState<string | null>(null);
  const [serverQuote, setServerQuote] = useState<ServerQuoteState | null>(null);
  const [resolvedDistributorName, setResolvedDistributorName] = useState<string | null>(null);

  useEffect(() => {
    if (!deliveryPincode || !/^\d{6}$/.test(deliveryPincode)) {
      setResolvedDistributorName(null);
      return;
    }
    let active = true;
    void fetch(`/api/seller-resolution?postalCode=${encodeURIComponent(deliveryPincode)}&categorySlug=door-closer`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.resolution?.serviceable) {
          setResolvedDistributorName(data.resolution.sellerName || null);
        } else if (active) {
          setResolvedDistributorName(null);
        }
      })
      .catch(() => {
        if (active) setResolvedDistributorName(null);
      });
    return () => {
      active = false;
    };
  }, [deliveryPincode]);

  useEffect(() => {
    if (cart.length === 0) return;
    let active = true;
    void fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((c) => ({
          productId: c.productId,
          finish: c.finish,
          packLabel: c.packLabel,
          packMultiplier: c.packMultiplier,
          quantity: c.quantity,
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ServerQuoteState | null) => {
        if (active && data) setServerQuote(data);
      });
    return () => {
      active = false;
    };
  }, [cart, effectivePriceTier]);

  const sellerGroups = useMemo(
    () =>
      groupCartItemsBySeller(cart, {
        pincode: deliveryPincode,
        userRole: session?.role ?? null,
        distributorSellerName: resolvedDistributorName,
      }),
    [cart, deliveryPincode, session?.role, resolvedDistributorName]
  );

  async function handleApplyPincode(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = pinDraft.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setPinError("Enter a valid 6-digit delivery PIN code.");
      return;
    }
    setPinError(null);
    const changed = cleaned !== deliveryPincode;
    setDeliveryPincode(cleaned);

    try {
      if (cart.length > 0) {
        await fetch("/api/cart/postal-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postalCode: cleaned }),
        });
      }
    } catch {
      // ignore
    }

    if (changed) {
      setRevalidatedNote(
        `Delivery PIN updated to ${cleaned}. Seller routes and totals have been revalidated against authoritative coverage.`
      );
      showToast(`Delivery PIN ${cleaned} applied`);
    }
  }

  return (
    <StorefrontSurface family="commerce">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 pb-12 sm:pb-16">
        <PageHeader
          title={`Your cart (${cartCount})`}
          section="Shopping cart"
          description="Each seller group is checked out separately so Sai Ajantha Direct and distributor-routed items remain cleanly isolated."
          parents={[{ label: "Products", href: "/products" }]}
          actions={
            <span className="inline-flex items-center rounded-lg border border-[#BDD6EE] bg-[#EAF3FA] px-3 py-1.5 text-xs font-bold text-[#144470]">
              Price Tier: {serverQuote?.priceTierApplied ?? effectivePriceTier}
            </span>
          }
        />

        <div className="sa-content-width pt-6 sm:pt-8 space-y-6">
          {cart.length > 0 && (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Trash2 className="size-3.5" /> Clear Cart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Entire Cart?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes all {cartCount} items across all seller groups.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearCart}>Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Delivery PIN Revalidation Bar */}
          <Card className="p-5 sm:p-6">
            <form
              onSubmit={handleApplyPincode}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5F7F6] text-[#079D9A]">
                  <MapPin className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-sm sm:text-base font-bold text-[#102D4D]">
                    Delivery PIN Code &amp; Seller Assignment
                  </h2>
                  <p className="text-xs text-[#526274]">
                    Required to match Door Closers &amp; Kitchen Baskets to an active distributor and check Sai Ajantha direct delivery coverage.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit PIN"
                  aria-label="Delivery PIN code"
                  className="w-40 bg-[#F8FAFC]"
                />
                <Button type="submit" variant="teal" size="sm">
                  Verify PIN
                </Button>
              </div>
            </form>
            {pinError && (
              <p className="mt-2 text-xs font-semibold text-red-700">{pinError}</p>
            )}
            {revalidatedNote && (
              <Alert variant="teal" className="mt-4">
                <AlertDescription className="text-xs">{revalidatedNote}</AlertDescription>
              </Alert>
            )}
          </Card>

          {cart.length === 0 ? (
            <StateFeedback
              kind="empty"
              title="Your cart is currently empty"
              description="Browse our 9 Sai Ajantha Direct categories or House of Ajantha ranges to add items or request a quotation."
              actionLabel="Browse Catalogue"
              actionHref="/products"
              secondaryLabel="Request Custom Quote"
              secondaryHref="/quotes"
            />
          ) : (
            <div className="space-y-8">
              {sellerGroups.map((group) => (
                <Card key={group.groupKey} className="overflow-hidden border-[#C6CAD5]/80">
                  {/* Seller Group Header */}
                  <CardHeader className="bg-[#0B1F35] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#24C6D0] text-[#0B1F35]">
                          {group.sellerBadge}
                        </Badge>
                        {group.groupKey === "enquiry" && (
                          <Badge variant="warning">Excluded from Payable Total</Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl text-white flex items-center gap-2 pt-1">
                        {group.groupKey === "enquiry" ? (
                          <FileQuestion className="size-5 text-[#24C6D0]" />
                        ) : (
                          <Building2 className="size-5 text-[#24C6D0]" />
                        )}
                        {group.sellerName}
                      </CardTitle>
                      <p className="text-xs text-[#C6CAD5]">{group.policySummary}</p>
                    </div>

                    {group.groupKey !== "enquiry" && (
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] uppercase tracking-wider text-[#24C6D0] block">
                          Group Payable (Incl. Est. GST)
                        </span>
                        <span className="font-display text-2xl font-extrabold tabular-nums">
                          {formatInr(group.payableTotalInr)}
                        </span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Line Items */}
                    <div className="lg:col-span-8 divide-y divide-[#E8EDF3]">
                      {group.items.map((item) => (
                        <div
                          key={item.key}
                          className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4"
                        >
                          <Link
                            href={`/products/${item.productId}`}
                            className="relative h-24 w-24 shrink-0 rounded-xl bg-[#F8FAFC] border border-[#E8EDF3] p-2"
                          >
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="96px"
                              className="object-contain p-1.5"
                            />
                          </Link>

                          <div className="flex flex-1 flex-col justify-between gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#079D9A]">
                                  {item.sku} · {item.category}
                                </p>
                                <Link
                                  href={`/products/${item.productId}`}
                                  className="mt-0.5 block font-display text-base font-bold text-[#102D4D] hover:text-[#079D9A]"
                                >
                                  {item.name}
                                </Link>
                                <p className="text-xs text-[#526274]">
                                  Finish: <strong>{item.finish}</strong> · Unit:{" "}
                                  <strong>{item.packLabel}</strong>
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromCart(item.key)}
                                className="text-[#526274] hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                              <div className="inline-flex items-center rounded-lg border border-[#C6CAD5] bg-[#F4F6F9]">
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.key, -1)}
                                  aria-label="Decrease quantity"
                                  className="px-3 py-1.5 text-[#102D4D] hover:bg-white cursor-pointer"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <span className="px-3.5 text-xs font-bold tabular-nums text-[#102D4D]">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.key, 1)}
                                  aria-label="Increase quantity"
                                  className="px-3 py-1.5 text-[#102D4D] hover:bg-white cursor-pointer"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>

                              <div className="text-right">
                                {group.groupKey === "enquiry" || item.unitPriceInr === null ? (
                                  <Badge variant="warning">Quote / Verification Required</Badge>
                                ) : (
                                  <>
                                    <p className="font-display text-base font-bold text-[#102D4D] tabular-nums">
                                      {formatInr(item.unitPriceInr * item.quantity)}
                                    </p>
                                    <p className="text-[11px] text-[#526274] tabular-nums">
                                      {formatInr(item.unitPriceInr)} per unit/lot
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Seller Group Summary & Independent Action */}
                    <div className="lg:col-span-4 rounded-2xl border border-[#E8EDF3] bg-[#F8FAFC] p-5 space-y-4">
                      <h3 className="font-display text-sm font-bold text-[#102D4D] flex items-center gap-2">
                        <ShieldCheck className="size-4 text-[#079D9A]" />
                        Seller Summary
                      </h3>

                      {group.groupKey !== "enquiry" ? (
                        <dl className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <dt className="text-[#526274]">Items Subtotal</dt>
                            <dd className="font-bold text-[#102D4D] tabular-nums">
                              {formatInr(group.pricedSubtotalInr)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[#526274]">Est. GST (18%)</dt>
                            <dd className="font-bold text-[#102D4D] tabular-nums">
                              {formatInr(group.estimatedGstInr)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-[#526274]">Delivery / Freight</dt>
                            <dd className="font-medium text-[#526274]">
                              Confirmed at checkout
                            </dd>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-baseline">
                            <dt className="font-bold text-[#102D4D]">Group Total</dt>
                            <dd className="font-display text-lg font-extrabold text-[#102D4D] tabular-nums">
                              {formatInr(group.payableTotalInr)}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-xs text-[#526274] leading-relaxed">
                          Quote-only items are never billed online or included in payable totals.
                        </p>
                      )}

                      {group.blockedReason && (
                        <Alert variant="teal" className="py-2.5">
                          <AlertCircle className="size-4" />
                          <AlertDescription className="text-[11px] leading-relaxed">
                            {group.blockedReason}
                          </AlertDescription>
                        </Alert>
                      )}

                      {group.groupKey === "sai_ajantha" && (
                        <Button asChild size="lg" variant="teal" className="w-full">
                          <Link
                            href={`/checkout?seller=sai_ajantha${deliveryPincode ? `&pincode=${encodeURIComponent(deliveryPincode)}` : ""}`}
                          >
                            {COMMERCIAL_FLAGS.liveRazorpayEnabled
                              ? "Pay Sai Ajantha"
                              : "Checkout / Submit PO (Sai Ajantha)"}
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      )}

                      {group.groupKey === "distributor" && (
                        <Button asChild size="lg" variant="outline-navy" className="w-full">
                          <Link
                            href={`/quotes?seller=distributor${deliveryPincode ? `&pincode=${encodeURIComponent(deliveryPincode)}` : ""}`}
                          >
                            Submit Enquiry to Distributor
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      )}

                      {group.groupKey === "enquiry" && (
                        <Button asChild size="lg" variant="outline-navy" className="w-full">
                          <Link
                            href={`/quotes${deliveryPincode ? `?pincode=${encodeURIComponent(deliveryPincode)}` : ""}`}
                          >
                            Request Formal Quotation
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      )}

                      <p className="text-[11px] text-[#526274]">
                        Return &amp; cancellation terms:{" "}
                        <Link href="/return-policy" className="underline text-[#079D9A] font-medium">
                          View Return Policy
                        </Link>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Separate Installation Notice */}
              <div className="rounded-2xl border border-[#DCE4EE] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-display text-sm font-bold text-[#102D4D]">
                    Need Installation Support?
                  </p>
                  <p className="text-xs text-[#526274]">
                    Installation is handled separately by an independent verified contractor who quotes, bills, and collects independently. It is never added to your product cart.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/installation">Request Installation Separately</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
