"use client";

import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";

import { PageHeader } from "@/components/non-home/PageHeader";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StateFeedback } from "@/components/StateFeedback";
import { useStore } from "@/components/StoreProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  COMMERCIAL_FLAGS,
  groupCartItemsBySeller,
  type SellerGroupKey,
} from "@/lib/commercial-policy";
import { formatInr } from "@/lib/productSpecs";

interface QuoteResponse {
  priceTierApplied: string;
  wholesaleUnlocked: boolean;
  items: {
    productId: string;
    sku: string;
    name: string;
    finish: string;
    quantity: number;
    lineTotalInr: number;
    unitPriceInr: number | null;
  }[];
  subtotalInr: number;
  gstAmountInr: number;
  totalInr: number;
  hasQuoteItems: boolean;
}

type PaymentMethodOption =
  | "Razorpay Online Checkout"
  | "Proforma Invoice / Trade PO"
  | "Formal BOQ Quote First";

const CHECKOUT_STEPS = [
  "Delivery & PIN",
  "Seller Group",
  "Price & Stock",
  "Method & Terms",
  "Verification",
] as const;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSeller = (searchParams.get("seller") as SellerGroupKey | null) || "sai_ajantha";
  const urlPincode = searchParams.get("pincode") || "";

  const {
    cart,
    session,
    authLoading,
    addresses,
    deliveryPincode,
    setDeliveryPincode,
    removeCartKeys,
    showToast,
  } = useStore();

  const [pincodeInput, setPincodeInput] = useState(urlPincode || deliveryPincode);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [gstin, setGstin] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption>(
    COMMERCIAL_FLAGS.liveRazorpayEnabled
      ? "Razorpay Online Checkout"
      : "Proforma Invoice / Trade PO"
  );
  const [notes, setNotes] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [checkoutIntentId] = useState<string>(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `intent_${Date.now()}`
  );

  const [prevSessionId, setPrevSessionId] = useState("");
  const [prevAddrId, setPrevAddrId] = useState("");

  if (session && session.id !== prevSessionId) {
    setPrevSessionId(session.id);
    if (!customerName) setCustomerName(session.name);
    if (!customerEmail) setCustomerEmail(session.email);
    if (!customerPhone) setCustomerPhone(session.phone);
    if (!organization) setOrganization(session.organization);
    if (!gstin && session.gstin) setGstin(session.gstin);
  }

  if (addresses[0] && addresses[0].id !== prevAddrId) {
    setPrevAddrId(addresses[0].id);
    if (!shippingAddress) {
      const a = addresses[0];
      setShippingAddress(`${a.line1}, ${a.city}, ${a.state} - ${a.pincode}`);
      if (!pincodeInput && a.pincode) setPincodeInput(a.pincode);
    }
  }

  const effectivePin = (pincodeInput || deliveryPincode).trim();
  const sellerGroups = useMemo(
    () =>
      groupCartItemsBySeller(cart, {
        pincode: effectivePin,
        userRole: session?.role ?? null,
      }),
    [cart, effectivePin, session?.role]
  );

  const activeGroup = useMemo(
    () =>
      sellerGroups.find((g) => g.groupKey === requestedSeller) ||
      sellerGroups.find((g) => g.groupKey === "sai_ajantha") ||
      sellerGroups[0] ||
      null,
    [sellerGroups, requestedSeller]
  );

  const activeItems = useMemo(() => activeGroup?.items ?? [], [activeGroup]);
  const otherGroupsCount = Math.max(0, sellerGroups.length - (activeGroup ? 1 : 0));

  useEffect(() => {
    if (activeItems.length === 0) {
      return;
    }
    let active = true;
    void fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: activeItems.map((c) => ({
          productId: c.productId,
          finish: c.finish,
          packLabel: c.packLabel,
          packMultiplier: c.packMultiplier,
          quantity: c.quantity,
        })),
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!active) return;
        if (!r.ok) {
          setQuoteError(d.error || "Failed to validate seller group cart.");
          return;
        }
        setQuoteError("");
        setQuote(d as QuoteResponse);
        if ((d as QuoteResponse).hasQuoteItems) {
          setPaymentMethod("Formal BOQ Quote First");
        }
      })
      .catch(() => {
        if (active) setQuoteError("Unable to compute server seller quote.");
      });
    return () => {
      active = false;
    };
  }, [activeItems]);

  const isDistributorOrEnquiry =
    activeGroup?.groupKey === "distributor" || activeGroup?.groupKey === "enquiry";
  const pinValid = /^\d{6}$/.test(effectivePin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || activeItems.length === 0 || !activeGroup) return;

    if (!pinValid) {
      setSubmitError("Enter a valid 6-digit delivery PIN code before submitting.");
      return;
    }
    if (!termsAccepted) {
      setSubmitError("Please accept the Return Policy and Terms before placing your order.");
      return;
    }
    if (isDistributorOrEnquiry) {
      setSubmitError(
        "Online checkout is disabled for this seller group. Please submit an enquiry via Quotations."
      );
      return;
    }
    if (paymentMethod === "Razorpay Online Checkout" && !COMMERCIAL_FLAGS.liveRazorpayEnabled) {
      setSubmitError(
        "Live online Razorpay capture is currently disabled by commercial policy. Use Proforma / Bank Transfer Reference or Formal BOQ Quote."
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setDeliveryPincode(effectivePin);

    const itemPayload = activeItems.map((c) => ({
      productId: c.productId,
      finish: c.finish,
      packLabel: c.packLabel,
      packMultiplier: c.packMultiplier,
      quantity: c.quantity,
    }));

    const combinedNotes = [
      `Seller Group: ${activeGroup.sellerName}`,
      `Delivery PIN: ${effectivePin}`,
      bankReference.trim()
        ? `Bank Transfer Ref (Awaiting Finance Verification): ${bankReference.trim()}`
        : "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutIntentId,
        },
        body: JSON.stringify({
          items: itemPayload,
          customerName,
          customerEmail,
          customerPhone,
          organization,
          gstin,
          shippingAddress: `${shippingAddress.trim()} (PIN: ${effectivePin})`,
          paymentMethod,
          notes: combinedNotes,
          checkoutIntentId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Order submission failed.");
        return;
      }

      // Remove ONLY this seller group's items; other seller groups remain in cart!
      removeCartKeys(activeItems.map((i) => i.key));
      showToast(
        bankReference.trim()
          ? `Order ${data.order.order_number} logged (Awaiting Finance Verification).`
          : `Order ${data.order.order_number} logged for ${activeGroup.sellerName}.`
      );
      router.push(`/orders/${data.order.id}`);
    } catch {
      setSubmitError("Network error during checkout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sa-content-width pt-6 sm:pt-8 space-y-6">

      {/* Checkout Steps Indicator */}
      <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <ol aria-label="Checkout steps" className="flex flex-wrap items-center gap-2 text-xs">
          {CHECKOUT_STEPS.map((step, idx) => (
            <li
              key={step}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F6FA] px-3 py-1 font-semibold text-[#102D4D]"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#079D9A] text-[10px] font-bold text-white">
                {idx + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" size="sm">
          <Link href="/cart">
            <ArrowLeft className="size-3.5" /> Back to cart
          </Link>
        </Button>
      </div>

      {authLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="lg:col-span-7 h-[520px] rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-[420px] rounded-2xl" />
        </div>
      ) : !session ? (
        <Card className="mx-auto max-w-lg text-center p-10">
          <CardContent className="p-0 space-y-4">
            <Badge variant="teal">Account required</Badge>
            <h2 className="font-display text-2xl font-bold text-[#102D4D]">
              Sign In to Continue Checkout
            </h2>
            <p className="text-xs sm:text-sm text-[#526274]">
              Sign in to place your order and find it in your account later.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline-navy">
                <Link href="/register">Register Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !activeGroup || activeItems.length === 0 ? (
        <StateFeedback
          kind="empty"
          title="No items in this seller group"
          description="Return to your cart or browse products to add eligible items."
          actionLabel="View Cart"
          actionHref="/cart"
          secondaryLabel="Browse Products"
          secondaryHref="/products"
        />
      ) : isDistributorOrEnquiry ? (
        <StateFeedback
          kind="quote_only"
          badgeLabel={activeGroup.sellerBadge}
          title={`Online Checkout Disabled for ${activeGroup.sellerName}`}
          description={
            activeGroup.blockedReason ||
            "Distributor resale checkout and quote-only items cannot be charged online. Submit a formal enquiry without payment; any other eligible seller groups remain in your cart."
          }
          actionLabel="Submit Enquiry / Quote"
          actionHref={`/quotes?seller=${activeGroup.groupKey}${effectivePin ? `&pincode=${encodeURIComponent(effectivePin)}` : ""}`}
          secondaryLabel="Back to Cart"
          secondaryHref="/cart"
        />
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          <Card className="lg:col-span-7 p-0">
            <CardHeader className="border-b border-[#C6CAD5]/60 p-6 sm:p-8 pb-5 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="teal">
                  Seller: {activeGroup.sellerName}
                </Badge>
                <Badge variant="outline">
                  Price Tier: {quote?.priceTierApplied ?? session.role}
                </Badge>
              </div>
              <CardTitle className="text-2xl">
                Single-Seller Checkout &amp; Confirmation
              </CardTitle>
              {otherGroupsCount > 0 && (
                <p className="text-xs text-[#079D9A] font-medium">
                  Note: You have {otherGroupsCount} other seller group(s) in your cart. Completing this checkout will leave those items untouched in your cart.
                </p>
              )}
            </CardHeader>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {addresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#102D4D] flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-[#079D9A]" /> Quick-Fill Saved Address
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {addresses.map((addr) => (
                      <Button
                        key={addr.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setShippingAddress(`${addr.line1}, ${addr.city}, ${addr.state}`);
                          setPincodeInput(addr.pincode || "");
                        }}
                      >
                        {addr.label} ({addr.pincode})
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name" htmlFor="co-name" required>
                  <Input
                    id="co-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </FormField>
                <FormField label="Delivery PIN Code" htmlFor="co-pin" required>
                  <Input
                    id="co-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={pincodeInput}
                    onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit PIN"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Work / Contact Email" htmlFor="co-email" required>
                  <Input
                    id="co-email"
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </FormField>
                <FormField label="Mobile Number" htmlFor="co-phone" required>
                  <Input
                    id="co-phone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Business / Organization (Optional)" htmlFor="co-org">
                  <Input
                    id="co-org"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </FormField>
                <FormField label="Buyer GSTIN (Optional)" htmlFor="co-gstin">
                  <Input
                    id="co-gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 33XXXXX0000X1Z5"
                  />
                </FormField>
              </div>

              <FormField label="Delivery Address" htmlFor="co-addr" required>
                <Textarea
                  id="co-addr"
                  rows={3}
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                />
              </FormField>

              <div className="space-y-2.5">
                <Label>Payment &amp; Order Method</Label>
                {!COMMERCIAL_FLAGS.liveRazorpayEnabled && (
                  <Alert variant="teal" className="py-2.5">
                    <AlertDescription className="text-xs">
                      <strong>Live online gateway is disabled pending owner launch sign-off.</strong> Eligible orders can be submitted as a Trade PO / Bank Transfer (Awaiting Finance Verification) or Formal BOQ Quote.
                    </AlertDescription>
                  </Alert>
                )}
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(val) => setPaymentMethod(val as PaymentMethodOption)}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <label
                    className={`flex flex-col gap-1.5 rounded-xl border p-3.5 ${
                      !COMMERCIAL_FLAGS.liveRazorpayEnabled
                        ? "opacity-50 cursor-not-allowed bg-[#F4F6F9]"
                        : paymentMethod === "Razorpay Online Checkout"
                          ? "border-[#079D9A] bg-[#E5F7F6]/40 cursor-pointer"
                          : "border-[#C6CAD5] bg-white cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#102D4D] flex items-center gap-1">
                        <CreditCard className="size-3.5" /> Razorpay Online
                      </span>
                      <RadioGroupItem
                        value="Razorpay Online Checkout"
                        disabled={!COMMERCIAL_FLAGS.liveRazorpayEnabled || Boolean(quote?.hasQuoteItems)}
                      />
                    </div>
                    <span className="text-[11px] text-[#526274]">
                      {COMMERCIAL_FLAGS.liveRazorpayEnabled
                        ? "UPI, Cards & NetBanking"
                        : "Disabled pending launch sign-off"}
                    </span>
                  </label>

                  <label
                    className={`flex flex-col gap-1.5 rounded-xl border p-3.5 cursor-pointer ${
                      paymentMethod === "Proforma Invoice / Trade PO"
                        ? "border-[#079D9A] bg-[#E5F7F6]/40 ring-1 ring-[#079D9A]"
                        : "border-[#C6CAD5] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#102D4D] flex items-center gap-1">
                        <Landmark className="size-3.5" /> Bank Transfer / PO
                      </span>
                      <RadioGroupItem value="Proforma Invoice / Trade PO" />
                    </div>
                    <span className="text-[11px] text-[#526274]">
                      NEFT/RTGS reference — Awaiting Finance Verification
                    </span>
                  </label>

                  <label
                    className={`flex flex-col gap-1.5 rounded-xl border p-3.5 cursor-pointer ${
                      paymentMethod === "Formal BOQ Quote First"
                        ? "border-[#079D9A] bg-[#E5F7F6]/40 ring-1 ring-[#079D9A]"
                        : "border-[#C6CAD5] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#102D4D] flex items-center gap-1">
                        <FileText className="size-3.5" /> Formal Quote
                      </span>
                      <RadioGroupItem value="Formal BOQ Quote First" />
                    </div>
                    <span className="text-[11px] text-[#526274]">
                      Confirm freight, stock &amp; invoice before payment
                    </span>
                  </label>
                </RadioGroup>
              </div>

              {paymentMethod === "Proforma Invoice / Trade PO" && (
                <FormField
                  label="Bank Transfer UTR / PO Reference (Optional)"
                  htmlFor="co-bank-ref"
                  hint="Entering a reference marks payment as Awaiting Finance Verification — never auto-marked Paid."
                >
                  <Input
                    id="co-bank-ref"
                    type="text"
                    value={bankReference}
                    onChange={(e) => setBankReference(e.target.value)}
                    placeholder="e.g. UTR1234567890 or PO-2026-01"
                  />
                </FormField>
              )}

              <FormField label="Delivery Instructions (Optional)" htmlFor="co-notes">
                <Input
                  id="co-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred delivery window or site contact..."
                />
              </FormField>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#C6CAD5]/80 bg-[#F4F6F9]/60 p-3.5">
                <Checkbox
                  id="co-terms"
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(Boolean(v))}
                />
                <label
                  htmlFor="co-terms"
                  className="text-xs text-[#102D4D] leading-relaxed cursor-pointer"
                >
                  I confirm the variant, billing unit, seller ({activeGroup.sellerName}), and acknowledge the{" "}
                  <Link href="/return-policy" className="underline font-semibold text-[#079D9A]">
                    Return Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="underline font-semibold text-[#079D9A]">
                    Terms &amp; Conditions
                  </Link>
                  .
                </label>
              </div>

              {(submitError || quoteError) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{submitError || quoteError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Right Summary Panel */}
          <Card className="lg:col-span-5 p-0">
            <CardHeader className="border-b border-[#C6CAD5]/60 p-6 sm:p-8 pb-5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#079D9A] uppercase tracking-wider">
                <Building2 className="size-4" />
                <span>Legal Seller: {activeGroup.sellerName}</span>
              </div>
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#079D9A]" />
                Server-Authoritative Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-5">
              <ul className="divide-y divide-[#C6CAD5]/60 max-h-80 overflow-y-auto">
                {(quote?.items || []).map((item, idx) => (
                  <li
                    key={`${item.productId}-${idx}`}
                    className="py-3 flex justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#102D4D]">{item.name}</p>
                      <p className="text-[#526274]">
                        {item.sku} · {item.finish} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-[#102D4D] shrink-0 tabular-nums">
                      {item.unitPriceInr !== null ? (
                        formatInr(item.lineTotalInr)
                      ) : (
                        <Badge variant="secondary">BOQ Quote</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <Separator />

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[#526274]">Subtotal (Excl. GST)</dt>
                  <dd className="font-bold text-[#102D4D] tabular-nums">
                    {formatInr(quote?.subtotalInr ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#526274]">Estimated GST (18%)</dt>
                  <dd className="font-bold text-[#102D4D] tabular-nums">
                    {formatInr(quote?.gstAmountInr ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#526274]">Delivery / Freight</dt>
                  <dd className="font-medium text-[#526274]">
                    Confirmed on invoice / quote
                  </dd>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-baseline">
                  <dt className="font-bold text-[#102D4D]">Group Total</dt>
                  <dd className="font-display text-xl font-extrabold text-[#102D4D] tabular-nums">
                    {formatInr(quote?.totalInr ?? 0)}
                  </dd>
                </div>
              </dl>

              <Button
                type="submit"
                disabled={submitting || !quote}
                variant="teal"
                size="lg"
                className="w-full"
              >
                <CheckCircle2 className="size-4" />
                {submitting
                  ? "Submitting..."
                  : paymentMethod === "Proforma Invoice / Trade PO"
                    ? "Submit Trade PO / Bank Ref"
                    : "Submit Formal Order Quote"}
                <ArrowRight className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <StorefrontSurface family="commerce">
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 pb-12 sm:pb-16">
        <PageHeader
          title="Checkout"
          section="Place an order"
          description="Verify your delivery address, seller group, and pricing summary before submitting your order."
          parents={[{ label: "Cart", href: "/cart" }]}
        />

        <Suspense
          fallback={
            <div className="sa-content-width pt-6 sm:pt-8">
              <Skeleton className="h-[480px] w-full rounded-2xl" />
            </div>
          }
        >
          <CheckoutContent />
        </Suspense>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
