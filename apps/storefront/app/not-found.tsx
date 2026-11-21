import Link from "next/link";
import { ArrowRight, Compass, Phone, Search, ShoppingBag } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";

export default function NotFoundPage() {
  return (
    <StorefrontSurface family="editorial">
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <PageHeader
            section="404 · Not Found"
            title="We couldn’t find that page"
            description="The link may have moved or the product reference may have been updated. Use one of the quick destinations below."
            action={{ label: "Browse Products", href: "/products" }}
          />
          <div className="sa-content-width py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: ShoppingBag,
                  title: "Product Catalogue",
                  desc: "Explore all 281 verified SKUs across 11 architectural categories.",
                  href: "/products",
                },
                {
                  icon: Search,
                  title: "Search by SKU",
                  desc: "Find profiles, door closers, or kitchen baskets by code.",
                  href: "/search",
                },
                {
                  icon: Compass,
                  title: "Account & Portals",
                  desc: "Sign in to Customer, Dealer, or Distributor workspaces.",
                  href: "/account",
                },
                {
                  icon: Phone,
                  title: "Trichy Trade Desk",
                  desc: "Request a BOQ quotation or speak with our technical team.",
                  href: "/contact",
                },
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="sa-card p-5 flex flex-col justify-between gap-4 hover:border-[#076864] transition-colors group"
                >
                  <div>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[#F0FAF9] text-[#076864]">
                      <card.icon className="size-5" />
                    </div>
                    <h2 className="mt-3 font-display text-base font-bold text-[#0B1F35] group-hover:text-[#076864]">
                      {card.title}
                    </h2>
                    <p className="mt-1 text-xs text-[#5D6F82] leading-relaxed">{card.desc}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#076864]">
                    Open
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
