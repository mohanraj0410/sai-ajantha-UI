import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { USEFUL_ARTICLES } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Technical Articles & Product Guides | Sai Ajantha Interior Solutions",
  description:
    "Product sizing, material checking, and aperture measurement guides for door closers, aluminium sections, and insect screens from Sai Ajantha.",
  alternates: { canonical: "/blogs" },
};

export default function BlogsPage() {
  return (
    <StorefrontSurface family="editorial">
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 pb-12">
        <PageHeader title="Product guides" section="Learn" description="Read simple guides to choosing door closers, aluminium profiles and insect screens."  />
        <div className="sa-content-width py-7 sm:py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {USEFUL_ARTICLES.map((article) => (
              <article
                key={article.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#E8EDF3] bg-white p-4 sm:p-5 shadow-xs hover:border-[#079D9A]/80 hover:shadow-lg transition-all"
              >
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F8FAFC] border border-[#E8EDF3] p-4">
                    <Image
                      src={article.imageSrc}
                      alt={article.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="outline" className="bg-white/95 text-[#0B1F35]">
                        {article.category}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-[#079D9A]">
                      {article.tag}
                    </span>
                    <h2 className="mt-1 font-display text-lg font-bold text-[#0B1F35] group-hover:text-[#079D9A] transition-colors">
                      {article.title}
                    </h2>
                    <p className="mt-2 text-xs text-[#526274] leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E8EDF3] flex items-center justify-between gap-2">
                  <Button asChild size="sm" variant="outline-navy">
                    <Link href={`/blogs/${article.slug}`}>
                      <FileText className="size-3.5" />
                      Read Guide
                    </Link>
                  </Button>
                  <Link
                    href={article.productLink}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#079D9A] hover:underline"
                  >
                    <span>Browse Category</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </StorefrontSurface>
  );
}
