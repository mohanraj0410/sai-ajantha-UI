"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Package,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@/lib/products";
import { evaluateProductPolicy } from "@/lib/commercial-policy";
import { formatInr, getProductSpecData } from "@/lib/productSpecs";
import { useStore } from "./StoreProvider";

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductSearchModal({ isOpen, onClose }: ProductSearchModalProps) {
  const router = useRouter();
  const {
    catalogProducts,
    catalogCategories,
    catalogLoading,
    catalogError,
    getProductImage,
    getAuthorizedUnitPrice,
    session,
  } = useStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | ProductCategory>("All");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleClose() {
    setQuery("");
    setSelectedCategory("All");
    onClose();
  }

  // Autofocus input when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const categories =
    catalogCategories.length > 0 ? catalogCategories : PRODUCT_CATEGORIES;

  // Filtered product results
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogProducts.filter((item) => {
      // Category filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }

      if (!q) return true;

      const nameMatch = item.name.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      const subcatMatch = item.subcategory?.toLowerCase().includes(q) ?? false;
      const codeMatch = item.code?.toLowerCase().includes(q) ?? false;
      const materialMatch = item.material?.toLowerCase().includes(q) ?? false;
      const sizeMatch = item.size?.toLowerCase().includes(q) ?? false;

      return (
        nameMatch ||
        catMatch ||
        subcatMatch ||
        codeMatch ||
        materialMatch ||
        sizeMatch
      );
    });
  }, [query, selectedCategory, catalogProducts]);

  // Display top 20 items in modal
  const displayedItems = searchResults.slice(0, 20);

  function handleSelectProduct(id: string) {
    handleClose();
    router.push(`/products/${id}`);
  }

  function handleViewAllInCatalog() {
    handleClose();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedCategory !== "All") params.set("category", selectedCategory);
    const queryString = params.toString();
    router.push(queryString ? `/products?${queryString}` : "/products");
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col bg-white border border-[#C6CAD5]/90 shadow-2xl rounded-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search Product Catalogue</DialogTitle>
          <DialogDescription>
            Search products by name, SKU, category, or specifications.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Search Bar Header */}
        <div className="relative border-b border-[#E8EDF3] bg-[#F8FAFC] p-4 sm:p-5">
          <div className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 size-5 text-[#079D9A]"
            />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product name, SKU, model, category, or material..."
              aria-label="Search product catalogue"
              className="h-12 w-full rounded-xl border-[#C6CAD5] bg-white pl-11 pr-20 text-sm text-[#102D4D] placeholder:text-[#7B8896] shadow-xs focus:border-[#079D9A] focus:ring-2 focus:ring-[#079D9A]/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search text"
                className="absolute right-10 p-1.5 text-[#7B8896] hover:text-[#102D4D] cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close search modal"
              className="absolute right-2.5 p-1.5 rounded-md text-[#7B8896] hover:bg-[#E8EDF3] hover:text-[#102D4D] cursor-pointer transition-colors"
            >
              <kbd className="hidden sm:inline-block rounded border border-[#C6CAD5] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#5D6B7B]">
                ESC
              </kbd>
              <X className="size-4 sm:hidden" />
            </button>
          </div>

          {/* Quick Filter Category Pills with Accessible Horizontal Scroll */}
          <div className="mt-3 flex items-center gap-1.5 text-xs overflow-hidden">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#7B8896] mr-1">
              Category:
            </span>
            <div className="flex-1 min-w-0">
              <HorizontalScroll className="gap-1.5 py-0.5" fadeClassName="from-[#F8FAFC] via-[#F8FAFC]/80">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("All")}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === "All"
                      ? "bg-[#102D4D] text-white shadow-xs"
                      : "border border-[#C6CAD5] bg-white text-[#102D4D] hover:border-[#079D9A]"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-[#079D9A] text-white shadow-xs"
                        : "border border-[#C6CAD5] bg-white text-[#102D4D] hover:border-[#079D9A]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </HorizontalScroll>
            </div>
          </div>
        </div>

        {/* Scrollable Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[260px] max-h-[58vh]">
          {catalogError ? (
            <div className="py-10 text-center space-y-2.5">
              <p className="font-display text-base font-bold text-[#102D4D]">
                Live Catalogue Unavailable
              </p>
              <p className="text-xs text-[#526274] max-w-md mx-auto">
                {catalogError}
              </p>
            </div>
          ) : catalogLoading && catalogProducts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-display text-base font-bold text-[#102D4D]">
                Loading live catalogue...
              </p>
              <p className="text-xs text-[#526274]">
                Fetching approved products and public pricing.
              </p>
            </div>
          ) : catalogProducts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="font-display text-base font-bold text-[#102D4D]">
                No Published Catalogue SKUs Available Yet
              </p>
              <p className="text-xs text-[#526274] max-w-md mx-auto">
                No published products are currently available in search. You can still submit a custom product quotation to our Trichy desk.
              </p>
              <Button
                type="button"
                variant="outline-navy"
                size="sm"
                onClick={() => {
                  handleClose();
                  router.push("/quotes");
                }}
                className="text-xs"
              >
                Request a Custom Quote
              </Button>
            </div>
          ) : displayedItems.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F6FA] text-[#7B8896]">
                <Package className="size-7" />
              </div>
              <p className="font-display text-base font-bold text-[#102D4D]">
                No matching products found
              </p>
              <p className="text-xs text-[#5D6B7B] max-w-sm mx-auto">
                No products match &ldquo;{query}&rdquo;
                {selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}.
                Try checking the spelling or selecting another category.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-2 text-xs"
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedItems.map((item) => {
                const spec = getProductSpecData(item);
                const imageSrc = getProductImage(item.id, item.src);
                const authorizedPrice = getAuthorizedUnitPrice(item.id);
                const displayPrice =
                  authorizedPrice !== undefined
                    ? authorizedPrice
                    : spec.verifiedPriceInr;
                const policy = evaluateProductPolicy(item, {
                  resolvedPriceInr: displayPrice,
                  userRole: session?.role ?? null,
                });
                const skuCode = item.code ?? item.id.toUpperCase();

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectProduct(item.id);
                      }
                    }}
                    className="group flex items-center justify-between gap-4 p-3.5 rounded-xl border border-[#E8EDF3] bg-white hover:border-[#079D9A] hover:bg-[#F8FAFC] transition-all cursor-pointer shadow-xs hover:shadow-md"
                  >
                    {/* Left: Product Thumbnail Image */}
                    <div className="relative h-18 w-18 sm:h-20 sm:w-20 shrink-0 rounded-lg bg-[#F8FAFC] border border-[#E8EDF3] p-1.5 overflow-hidden flex items-center justify-center">
                      <Image
                        src={imageSrc}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-contain transition-transform duration-300 group-hover:scale-108"
                      />
                    </div>

                    {/* Middle: Basic Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Category & SKU Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-[#079D9A] truncate">
                          {item.category}
                        </span>
                        <span className="text-[#C6CAD5]">•</span>
                        <span className="rounded bg-[#F3F6FA] px-1.5 py-0.5 text-[#102D4D]">
                          {skuCode}
                        </span>
                        {spec.badgeLabel && (
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1.5 border-[#079D9A]/40 text-[#079D9A]"
                          >
                            {spec.badgeLabel}
                          </Badge>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="font-display text-sm sm:text-base font-bold text-[#102D4D] group-hover:text-[#079D9A] transition-colors truncate">
                        {item.name}
                      </h4>

                      {/* Material / Dimensions / Specs */}
                      <p className="text-xs text-[#5D6B7B] line-clamp-1">
                        {spec.size ? `${spec.size} · ` : ""}
                        {spec.material || item.subcategory || "Verified Architectural Hardware"}
                      </p>

                      {/* Pricing & Route Tag */}
                      <div className="pt-0.5 flex flex-wrap items-center gap-2">
                        {policy.ctaMode === "REQUEST_QUOTE" || displayPrice === null ? (
                          <span className="text-[11px] font-semibold text-[#079D9A]">
                            Request a Quote
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#102D4D] tabular-nums">
                            {formatInr(displayPrice)}{" "}
                            <span className="text-[10px] font-normal text-[#526274]">
                              / {spec.billingUnit}
                            </span>
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-[#526274]">
                          · {policy.isFloorSpring ? "Floor Spring (Quote Only)" : policy.isDistributorCategory ? "House of Ajantha (Distributor Route)" : "Sai Ajantha Direct"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Navigate Arrow */}
                    <div className="shrink-0 flex items-center pl-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F6FA] text-[#7B8896] group-hover:bg-[#079D9A] group-hover:text-white transition-colors">
                        <ChevronRight className="size-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#E8EDF3] bg-[#F8FAFC] px-4 sm:px-5 py-3 flex items-center justify-between text-xs text-[#5D6B7B]">
          <span>
            Found <strong>{searchResults.length}</strong> product
            {searchResults.length === 1 ? "" : "s"}
            {query.trim() ? ` for "${query.trim()}"` : ""}
          </span>

          <Button
            type="button"
            variant="outline-navy"
            size="sm"
            onClick={handleViewAllInCatalog}
            className="text-xs font-semibold gap-1.5"
          >
            <span>View All in Catalogue</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
