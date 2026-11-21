"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import { EmptyStatePanel, StatusTag } from "@/components/non-home/PortalPrimitives";
import { useStore } from "@/components/StoreProvider";
import {
  formatInr,
  getProductSku,
  isFloorSpringProduct,
} from "@/lib/portal-helpers";

export default function WishlistPage() {
  const {
    wishlistIds,
    catalogProducts,
    toggleWishlist,
    addToCart,
    getAuthorizedUnitPrice,
    effectivePriceTier,
  } = useStore();

  const savedItems = useMemo(() => {
    const idSet = new Set(wishlistIds);
    return catalogProducts.filter((p) => idSet.has(p.id));
  }, [catalogProducts, wishlistIds]);

  return (
    <StorefrontSurface family="account">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="Saved Shortlist"
            title={`Wishlist (${savedItems.length})`}
            description="Bookmark profiles, insect screens, and architectural hardware to compare specifications or add to your project cart."
            parents={[{ label: "Products", href: "/products" }]}
            actions={
              <Link
                href="/products"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 text-xs font-semibold text-white hover:bg-[#076864]"
              >
                Explore Catalogue
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />

          <div className="sa-content-width py-7 sm:py-9">
            {savedItems.length === 0 ? (
              <EmptyStatePanel
                icon={<Heart className="size-5" />}
                title="No saved products yet"
                description="Click the heart button on any product card or specification page to build your project shortlist."
                primaryAction={{ label: "Browse Products", href: "/products" }}
                secondaryAction={{ label: "Request BOQ Quote", href: "/quotes" }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {savedItems.map((item) => {
                  const sku = getProductSku(item);
                  const floorSpring = isFloorSpringProduct(item);
                  const unitPrice = getAuthorizedUnitPrice(item.id);
                  return (
                    <article
                      key={item.id}
                      className="sa-card overflow-hidden flex flex-col"
                    >
                      <Link
                        href={`/products/${item.id}`}
                        className="relative aspect-[4/3] bg-[#F6F9FC] border-b border-[#EDF2F7] block"
                      >
                        <Image
                          src={item.src}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-contain p-5"
                        />
                      </Link>
                      <div className="p-4 flex-1 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#5D6F82] truncate">
                            {item.category}
                          </span>
                          {floorSpring && (
                            <StatusTag label="Quote Only" tone="warning" compact />
                          )}
                        </div>
                        <Link
                          href={`/products/${item.id}`}
                          className="font-display text-sm font-bold text-[#0B1F35] hover:text-[#076864] line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <p className="font-mono text-[11px] text-[#64748B]">{sku}</p>
                        <div className="pt-1">
                          <p className="text-base font-bold text-[#076864] sa-tabular">
                            {floorSpring ? "Quotation Only" : formatInr(unitPrice)}
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            Tier: {effectivePriceTier} · {item.billingUnit || "1 unit"}
                          </p>
                        </div>

                        <div className="mt-auto pt-3 flex items-center gap-2">
                          {floorSpring ? (
                            <Link
                              href={`/contact?sku=${encodeURIComponent(sku)}`}
                              className="flex-1 min-h-[40px] inline-flex items-center justify-center rounded-xl bg-[#0B1F35] px-3 text-xs font-semibold text-white hover:bg-[#076864]"
                            >
                              Request Quote
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(item, { quantity: 1 })}
                              className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#076864] px-3 text-xs font-semibold text-white hover:bg-[#05524F] cursor-pointer"
                            >
                              <ShoppingCart className="size-3.5" />
                              Add to Cart
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleWishlist(item.id, item.name)}
                            aria-label={`Remove ${item.name}`}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-[#DCE5EE] text-[#64748B] hover:border-[#FCA5A5] hover:text-[#B91C1C] cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
