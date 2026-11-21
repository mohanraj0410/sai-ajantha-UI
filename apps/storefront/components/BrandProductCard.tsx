"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  GitCompareArrows,
  Heart,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { ProductPhoto } from "@/components/non-home/ProductPhoto";
import { useStore } from "@/components/StoreProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProductItem } from "@/lib/products";
import { evaluateProductPolicy } from "@/lib/commercial-policy";
import { formatInr, getProductSpecData } from "@/lib/productSpecs";
import { getWorkbookProductPhotoFallback } from "@/lib/product-media";

interface BrandProductCardProps {
  item: ProductItem;
  onQuickView?: (item: ProductItem) => void;
  showCompareToggle?: boolean;
  presentation?: "default" | "catalogue";
}

export function BrandProductCard({
  item,
  onQuickView,
  showCompareToggle = false,
  presentation = "default",
}: BrandProductCardProps) {
  const {
    addToCart,
    toggleWishlist,
    isWishlisted,
    toggleCompare,
    isCompared,
    getAuthorizedUnitPrice,
    getProductImage,
    effectivePriceTier,
    session,
  } = useStore();

  const spec = getProductSpecData(item);
  const resolvedImageSrc = getProductImage(item.id, item.src);
  const authorizedPrice = getAuthorizedUnitPrice(item.id);
  const displayPrice =
    authorizedPrice !== undefined ? authorizedPrice : spec.verifiedPriceInr;
  const policy = evaluateProductPolicy(item, {
    resolvedPriceInr: displayPrice,
    userRole: session?.role ?? null,
  });
  const saved = isWishlisted(item.id);
  const compared = isCompared(item.id);
  const skuCode = item.code ?? item.id.toUpperCase();
  const isCatalogue = presentation === "catalogue";
  const quoteOnly = policy.ctaMode === "REQUEST_QUOTE" || displayPrice === null;

  const channelLabel = policy.isFloorSpring
    ? "Quote Only · Floor Spring"
    : policy.isDistributorCategory
      ? "House of Ajantha"
      : spec.badgeLabel;
  const catalogueChannelLabel =
    policy.isDistributorCategory || policy.isFloorSpring
      ? "House of Ajantha"
      : item.brand || channelLabel;

  return (
    <Card
      data-presentation={presentation}
      data-quote-only={quoteOnly}
      data-category={item.category}
      data-price-tier={effectivePriceTier}
      className={`sa-product-card ${isCatalogue ? "sa-catalogue-card" : ""} group h-full flex flex-col gap-0 py-0 overflow-hidden rounded-2xl border-[#DCE5EE] bg-white shadow-[0_1px_2px_rgba(11,31,53,0.04)] hover:border-[#A8C4D4] hover:shadow-[0_12px_28px_-16px_rgba(11,31,53,0.16)] transition-all duration-200`}
    >
      {/* Clean Architectural Photography Stage — No heavy pill blocking the image */}
      <div className="sa-product-image sa-card-photo relative aspect-[4/3] w-full overflow-hidden border-b border-[#E9EFF5] bg-[#F7F9FC] flex items-center justify-center p-4 sm:p-5">
        <div className="sa-card-toolbar absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleWishlist(item.id, item.name);
                }}
                aria-label={
                  saved
                    ? `Remove ${item.name} from shortlist`
                    : `Save ${item.name} to shortlist`
                }
                aria-pressed={saved}
                className={`sa-card-wishlist h-9 w-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  saved
                    ? "bg-rose-50 border border-rose-200 text-rose-600"
                    : "bg-white/95 border border-[#DCE5EE] text-[#64748B] hover:text-[#0B1F35] hover:border-[#076864]"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${
                    saved ? "fill-rose-500 text-rose-500" : "fill-transparent"
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {saved ? "Saved in Shortlist" : "Save to Shortlist"}
            </TooltipContent>
          </Tooltip>

          {onQuickView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickView(item);
                  }}
                  aria-label={`Quick view ${item.name}`}
                  className="sa-card-quickview h-9 w-9 rounded-lg flex items-center justify-center bg-white/95 border border-[#DCE5EE] text-[#64748B] hover:text-[#076864] hover:border-[#076864] cursor-pointer transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Quick view</TooltipContent>
            </Tooltip>
          )}

          {isCatalogue && quoteOnly && showCompareToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggleCompare(item.id)}
                  aria-label={`Compare ${item.name}`}
                  aria-pressed={compared}
                  className={`sa-card-compare-overlay h-9 w-9 rounded-lg flex items-center justify-center border cursor-pointer transition-colors ${
                    compared
                      ? "border-[#076864] bg-[#076864] text-white"
                      : "border-[#DCE5EE] bg-white/95 text-[#64748B] hover:text-[#076864] hover:border-[#076864]"
                  }`}
                >
                  <GitCompareArrows className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {compared ? "Remove comparison" : "Compare specification"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Link
          href={`/products/${item.id}`}
          aria-label={`View specifications for ${item.name}`}
          className="sa-card-photo-link block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#076864]"
        >
          <div className="relative h-full w-full flex items-center justify-center">
            <ProductPhoto
              src={resolvedImageSrc}
              fallbackSrc={
                isCatalogue
                  ? getWorkbookProductPhotoFallback(resolvedImageSrc)
                  : undefined
              }
              alt={`${item.name} (${skuCode})`}
              fill
              sizes={
                isCatalogue
                  ? "(max-width: 639px) 94vw, (max-width: 1023px) 46vw, (max-width: 1439px) 24vw, 360px"
                  : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              }
              className="object-contain p-2 transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          </div>
        </Link>
      </div>

      {/* Structured Product Metadata */}
      <div className="sa-card-content flex flex-1 flex-col p-4 sm:p-5 justify-between">
        <div>
          <div className="sa-card-meta flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span
              className={`sa-card-channel truncate ${
                policy.isFloorSpring
                  ? "text-[#92400E]"
                  : policy.isDistributorCategory
                    ? "text-[#144470]"
                    : "text-[#076864]"
              }`}
            >
              {isCatalogue ? catalogueChannelLabel : channelLabel}
            </span>
            <span className="sa-card-sku font-mono text-[10px] text-[#5D6F82] shrink-0">
              {skuCode}
            </span>
          </div>

          <Link
            href={`/products/${item.id}`}
            className="sa-card-title mt-1.5 block font-display text-sm sm:text-[15px] font-bold leading-snug text-[#0B1F35] hover:text-[#076864] line-clamp-2 transition-colors"
          >
            {item.name}
          </Link>

          <p className="sa-card-category mt-1 text-xs text-[#5D6F82] line-clamp-1">
            {item.category}
            {!isCatalogue && spec.material ? ` · ${spec.material}` : ""}
          </p>
        </div>

        <div className="sa-card-order mt-4 pt-3.5 border-t border-[#E9EFF5] space-y-3">
          {!(isCatalogue && quoteOnly) && (
            <div className="sa-card-price-block">
              {quoteOnly ? (
                <div>
                  <span className="text-xs font-bold text-[#076864]">
                    Request a Quote
                  </span>
                  <span className="block text-[11px] text-[#5D6F82]">
                    {policy.isFloorSpring
                      ? "Technical quotation required"
                      : "Price on request"}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="sa-card-price text-base font-bold text-[#0B1F35] tabular-nums">
                    {formatInr(displayPrice)}
                  </span>
                  <span className="sa-card-billing block text-[11px] text-[#5D6F82]">
                    {effectivePriceTier !== "CUSTOMER"
                      ? `${effectivePriceTier.toLowerCase()} rate · `
                      : ""}
                    per {spec.billingUnit}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="sa-card-actions flex flex-wrap items-center gap-2">
            {showCompareToggle && !(isCatalogue && quoteOnly) && (
              <Button
                type="button"
                size="sm"
                variant={compared ? "teal" : "outline"}
                onClick={() => toggleCompare(item.id)}
                aria-pressed={compared}
                title="Compare specification"
                className="sa-card-compare h-9 px-2.5 text-[11px]"
              >
                <GitCompareArrows className="size-3.5" />
                {compared ? "Comparing" : "Compare"}
              </Button>
            )}
            {quoteOnly ? (
              <Button
                asChild
                variant="default"
                className="sa-card-quote flex-1 min-h-[38px] rounded-xl bg-[#0B1F35] hover:bg-[#076864] text-xs font-semibold"
              >
                <Link href={`/products/${item.id}`}>
                  Get a quote{" "}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                className="sa-card-cart flex-1 min-h-[38px] rounded-xl bg-[#076864] hover:bg-[#05524F] text-xs font-semibold"
                onClick={() => addToCart(item, { openDrawer: false })}
              >
                {isCatalogue ? (
                  <ShoppingCart aria-hidden="true" className="size-3.5" />
                ) : (
                  <Plus aria-hidden="true" className="size-3.5" />
                )}{" "}
                Add to cart
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
