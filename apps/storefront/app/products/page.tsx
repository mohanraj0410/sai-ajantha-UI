import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogStorefront } from "@/components/CatalogStorefront";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import "./catalogue.css";

export const metadata: Metadata = {
  title: "Product Catalogue | Extruded Aluminium, Door Controls & Hardware",
  description:
    "Browse architectural infrastructure products across 11 categories from Sai Ajantha Interior Solutions including door closers, aluminium sections, FGM fittings, kitchen baskets, ladders, mesh, insect screens, and hardware.",
  alternates: { canonical: "/products" },
};

function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 py-10 space-y-6">
      <div className="h-12 w-72 rounded-xl bg-[#EAF0F6]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="aspect-[4/3] rounded-2xl border border-[#C6CAD5]/50 bg-[#F3F6FA]"
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <StorefrontSurface family="catalogue">
      <div className="min-h-screen flex flex-col bg-white">
        <ScrollProgressBar />
        <Header showResources />

        <main id="main-content" className="flex-1">
          <Suspense fallback={<CatalogSkeleton />}>
            <CatalogStorefront />
          </Suspense>
        </main>

        <Footer />
      </div>
    </StorefrontSurface>
  );
}
