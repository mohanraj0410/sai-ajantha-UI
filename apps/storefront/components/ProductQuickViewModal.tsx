"use client";

import { useState, type RefObject } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Heart,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import { useStore } from "@/components/StoreProvider";
import { ProductPhoto } from "@/components/non-home/ProductPhoto";
import { getWorkbookProductPhotoFallback } from "@/lib/product-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductItem } from "@/lib/products";
import { formatInr, getProductSpecData } from "@/lib/productSpecs";

interface ProductQuickViewModalProps {
  item: ProductItem | null;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ProductQuickViewModal({
  item,
  onClose,
  returnFocusRef,
}: ProductQuickViewModalProps) {
  const {
    addToCart,
    toggleWishlist,
    isWishlisted,
    getAuthorizedUnitPrice,
    getProductImage,
    effectivePriceTier,
    wholesaleUnlocked,
  } = useStore();

  const [selectedFinishIdx, setSelectedFinishIdx] = useState(0);
  const [selectedPackIdx, setSelectedPackIdx] = useState(0);
  const [prevItemId, setPrevItemId] = useState<string | null>(item?.id ?? null);

  if ((item?.id ?? null) !== prevItemId) {
    setPrevItemId(item?.id ?? null);
    setSelectedFinishIdx(0);
    setSelectedPackIdx(0);
  }

  const spec = item ? getProductSpecData(item) : null;
  const skuCode = item ? (item.code ?? item.id.toUpperCase()) : "";
  const activeFinish = spec
    ? (spec.finishOptions[selectedFinishIdx] ?? spec.finishOptions[0])
    : "";
  const activePack = spec
    ? (spec.packOptions[selectedPackIdx] ?? spec.packOptions[0])
    : { label: "", multiplier: 1 };
  const saved = item ? isWishlisted(item.id) : false;
  const authorizedUnit = item ? getAuthorizedUnitPrice(item.id) : null;
  const effectiveUnit =
    spec && authorizedUnit !== undefined && authorizedUnit !== null
      ? authorizedUnit
      : (spec?.verifiedPriceInr ?? null);

  const packPrice =
    effectiveUnit !== null
      ? Math.round(effectiveUnit * activePack.multiplier * 100) / 100
      : null;

  // WhatsApp quick inquiry link
  const waHref = item
    ? `https://wa.me/919842406588?text=${encodeURIComponent(
        [
          `Hello Sai Ajantha Technical Desk,`,
          ``,
          `I am inquiring about this item from the catalogue:`,
          `• Product: ${item.name}`,
          `• SKU: ${skuCode}`,
          `• Category: ${item.category}`,
          `• Finish: ${activeFinish}`,
          `• Supply Lot: ${activePack.label}`,
          packPrice !== null ? `• Price Basis: ${formatInr(packPrice)}` : "",
          ``,
          `Please confirm sample availability and delivery lead time.`,
        ]
          .filter(Boolean)
          .join("\n"),
      )}`
    : "";

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current?.isConnected) return;
          event.preventDefault();
          if (!document.querySelector('[role="dialog"][data-state="open"]')) {
            returnFocusRef.current.focus();
          }
        }}
        className="max-w-4xl p-0 overflow-hidden gap-0 max-h-[92vh] overflow-y-auto rounded-3xl border border-[#EAF0F6] bg-white shadow-2xl"
      >
        <div className="sa-card-accent-top" aria-hidden="true" />

        {item && spec && (
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Visual Media Studio Stage (5 cols) */}
            <div
              className="lg:col-span-5 relative border-b lg:border-b-0 lg:border-r border-[#EAF0F6] p-6 sm:p-8 flex flex-col justify-between overflow-hidden"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, #FFFFFF 0%, #F5F8FC 65%, #EAF0F6 100%)",
              }}
            >
              {/* Top Badges */}
              <div className="flex items-center justify-between gap-2">
                <Badge variant={spec.isWorkbookApproved ? "teal" : "default"}>
                  {spec.badgeLabel}
                </Badge>

                {/* Floating Heart Button */}
                <button
                  type="button"
                  onClick={() => toggleWishlist(item.id, item.name)}
                  aria-label={
                    saved
                      ? `Remove ${item.name} from shortlist`
                      : `Save ${item.name} to shortlist`
                  }
                  aria-pressed={saved}
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xs ${
                    saved
                      ? "bg-rose-50 border border-rose-300 text-rose-600 ring-2 ring-rose-200/60 shadow-sm scale-105"
                      : "bg-white/95 border border-[#DCE4EE] text-[#7B8896] hover:text-[#102D4D] hover:bg-white hover:border-[#079D9A]"
                  }`}
                  title={saved ? "Saved in Shortlist" : "Save to Shortlist"}
                >
                  <Heart
                    className={`h-4.5 w-4.5 transition-all duration-300 ${
                      saved
                        ? "fill-rose-500 text-rose-500 scale-110"
                        : "fill-transparent text-[#7B8896]"
                    }`}
                  />
                </button>
              </div>

              {/* Central Product Image */}
              <div className="relative my-6 aspect-square w-full max-w-[320px] mx-auto rounded-2xl bg-white p-6 border border-[#EAF0F6] shadow-xs flex items-center justify-center group overflow-hidden">
                <ProductPhoto
                  src={getProductImage(item.id, item.src)}
                  fallbackSrc={getWorkbookProductPhotoFallback(
                    getProductImage(item.id, item.src),
                  )}
                  alt={`${item.name} (${skuCode})`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 360px"
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-106"
                />
              </div>

              {/* Bottom Media Footers */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0] text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8896]">
                    Finish Preview:
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#102D4D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#079D9A]" />
                    {activeFinish}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5D6B7B]">
                  <span>Trichy Logistics Hub</span>
                  <span className="font-semibold text-[#079D9A]">
                    Same-Day Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Specification Details & Fast Ordering (7 cols) */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div>
                <DialogHeader className="p-0 text-left">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#079D9A]">
                    <span>{item.category}</span>
                    {item.subcategory && (
                      <>
                        <span className="text-[#C6CAD5]">·</span>
                        <span>{item.subcategory}</span>
                      </>
                    )}
                    <span className="text-[#C6CAD5]">·</span>
                    <span className="font-mono rounded-md bg-[#EAF0F6] px-1.5 py-0.5 text-[#102D4D]">
                      {skuCode}
                    </span>
                  </div>

                  <DialogTitle className="mt-2 font-display text-xl sm:text-2xl font-extrabold text-[#102D4D] leading-tight">
                    {item.name}
                  </DialogTitle>

                  <DialogDescription className="mt-2 text-xs sm:text-[13px] text-[#5D6B7B] leading-relaxed">
                    {spec.overviewSummary}
                  </DialogDescription>
                </DialogHeader>

                {/* Price Display */}
                <div className="mt-4 rounded-2xl border border-[#EAF0F6] bg-[#F8FAFC] p-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#079D9A]">
                      {wholesaleUnlocked
                        ? `Approved ${effectivePriceTier} Rate`
                        : "Customer Rate"}
                    </span>
                    <div className="font-display text-2xl font-extrabold text-[#102D4D] tabular-nums">
                      {packPrice !== null
                        ? formatInr(packPrice)
                        : "Price on Request"}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[#7B8896]">
                    <span>Unit: {activePack.label}</span>
                    <span className="block">{spec.gstNote}</span>
                  </div>
                </div>

                {/* Finish / Variant Pills */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#102D4D]">
                      Surface Finish:
                    </span>
                    <span className="text-[#079D9A] font-semibold">
                      {activeFinish}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.finishOptions.map((finish, idx) => {
                      const active = idx === selectedFinishIdx;
                      return (
                        <button
                          key={finish}
                          type="button"
                          onClick={() => setSelectedFinishIdx(idx)}
                          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? "sa-btn-gradient text-white shadow-xs"
                              : "border border-[#DCE4EE] bg-white text-[#102D4D] hover:border-[#079D9A]"
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          <span>{finish}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Order Lot Selector */}
                <div className="mt-4 space-y-1.5">
                  <span className="text-xs font-bold text-[#102D4D]">
                    Supply Lot:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {spec.packOptions.map((pack, idx) => {
                      const active = idx === selectedPackIdx;
                      return (
                        <button
                          key={pack.label}
                          type="button"
                          onClick={() => setSelectedPackIdx(idx)}
                          className={`rounded-xl border p-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                            active
                              ? "border-[#079D9A] bg-[#E5F7F6]/50 ring-1 ring-[#079D9A]"
                              : "border-[#EAF0F6] bg-white hover:border-[#DCE4EE]"
                          }`}
                        >
                          <span className="text-[11px] font-bold text-[#102D4D] truncate">
                            {pack.label}
                          </span>
                          <span className="text-[10px] text-[#7B8896]">
                            {pack.multiplier} × {spec.billingUnit}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fast Facts Grid */}
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-[#EAF0F6] bg-[#F8FAFC] p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8896] block">
                      Core Alloy
                    </span>
                    <span className="font-semibold text-[#102D4D] truncate block">
                      {spec.material}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#EAF0F6] bg-[#F8FAFC] p-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B8896] block">
                      Testing Standard
                    </span>
                    <span className="font-semibold text-[#102D4D] truncate block">
                      {spec.gradeStandard}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#EAF0F6] space-y-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    size="lg"
                    className="flex-1 rounded-xl sa-btn-gradient text-white font-bold py-3 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => {
                      addToCart(item, {
                        finish: activeFinish,
                        packIndex: selectedPackIdx,
                        openDrawer: true,
                      });
                      onClose();
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Add to BOQ Cart
                  </Button>

                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE4EE] bg-white px-3.5 py-3 text-xs font-bold text-[#102D4D] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
                    title="Inquire via WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    <span>WhatsApp</span>
                  </a>
                </div>

                <Link
                  href={`/products/${item.id}`}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#DCE4EE] bg-[#F8FAFC] px-4 py-2.5 text-xs font-bold text-[#102D4D] hover:bg-white hover:border-[#079D9A] hover:text-[#079D9A] transition-all"
                >
                  <span>Open Complete Specification &amp; Cut-Sheet</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
