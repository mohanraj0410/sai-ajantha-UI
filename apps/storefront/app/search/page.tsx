"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import { EmptyStatePanel } from "@/components/non-home/PortalPrimitives";
import { BrandProductCard } from "@/components/BrandProductCard";
import { useStore } from "@/components/StoreProvider";
import { getProductSku } from "@/lib/portal-helpers";

function SearchWorkspace() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const { catalogProducts, catalogLoading } = useStore();

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const categories = useMemo(
    () => Array.from(new Set(catalogProducts.map((p) => p.category))).sort(),
    [catalogProducts]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogProducts.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const sku = getProductSku(item).toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        sku.includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.subcategory || "").toLowerCase().includes(q) ||
        (item.material || "").toLowerCase().includes(q)
      );
    });
  }, [catalogProducts, query, selectedCategory]);

  return (
    <StorefrontSurface family="catalog">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="Catalogue Search"
            title="Find Products & Specifications"
            description="Search across 281 verified architectural hardware, aluminium profile, screen, and kitchen wireware SKUs."
            parents={[{ label: "Products", href: "/products" }]}
          />

          <div className="sa-content-width py-7 sm:py-9 space-y-6">
            {/* Search & Category Bar */}
            <div className="sa-card p-4 sm:p-5 space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#7B8FA3]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by product name, SKU code (e.g. SA-M-DC), material, or category..."
                  aria-label="Search Sai Ajantha catalogue"
                  className="w-full min-h-[48px] rounded-xl border border-[#C5D3E0] bg-white pl-11 pr-10 text-sm text-[#0B1F35]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search query"
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`shrink-0 min-h-[36px] rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                    selectedCategory === "ALL"
                      ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                      : "border-[#DCE5EE] bg-[#F8FAFC] text-[#354B62] hover:border-[#076864]"
                  }`}
                >
                  All Categories ({catalogProducts.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 min-h-[36px] rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                      selectedCategory === cat
                        ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                        : "border-[#DCE5EE] bg-[#F8FAFC] text-[#354B62] hover:border-[#076864]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-[#526477]">
              <span role="status">
                {catalogLoading
                  ? "Loading catalogue..."
                  : `Showing ${Math.min(results.length, 48)} of ${results.length} matching product(s)`}
              </span>
              {(query || selectedCategory !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedCategory("ALL");
                  }}
                  className="text-[#076864] hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {!catalogLoading && results.length === 0 ? (
              <EmptyStatePanel
                icon={<Search className="size-5" />}
                title={`No products matched "${query}"`}
                description="Try searching with a shorter keyword, category name, or product SKU code."
                primaryAction={{
                  label: "Reset Search",
                  onClick: () => {
                    setQuery("");
                    setSelectedCategory("ALL");
                  },
                }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {results.slice(0, 48).map((item) => (
                  <BrandProductCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FA]" />}>
      <SearchWorkspace />
    </Suspense>
  );
}
