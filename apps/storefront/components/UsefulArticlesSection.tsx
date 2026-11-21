"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { USEFUL_ARTICLES, type ArticleItem } from "@/lib/articles";

export function UsefulArticlesSection() {
  const [activeArticle, setActiveArticle] = useState<ArticleItem | null>(null);

  return (
    <section
      id="useful-articles"
      aria-labelledby="articles-heading"
      className="bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-8">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00A89A]">
              Resources
            </p>
            <h2
              id="articles-heading"
              className="font-display text-3xl sm:text-[38px] font-extrabold tracking-tight text-[#071E36] leading-tight"
            >
              Useful Articles &amp; Guides
            </h2>
            <p className="text-sm text-[#5B7086] leading-relaxed">
              Insights, product guides, and engineering notes to help you plan better spaces.
            </p>
          </div>

          <Link
            href="/blogs"
            className="group inline-flex min-h-[40px] items-center gap-2 self-start md:self-auto rounded-full border border-[#CBD8E4] bg-white px-5 text-xs font-bold text-[#071E36] hover:border-[#00A89A] hover:text-[#009688] transition-colors whitespace-nowrap"
          >
            <span>View All Articles</span>
            <ArrowRight className="size-3.5 text-[#00A89A] transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* 3 Horizontal Thumbnail Guide Cards matching target design */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {USEFUL_ARTICLES.map((item) => (
            <article
              key={item.id}
              className="group flex flex-row items-stretch gap-4 rounded-2xl border border-[#E2ECF3] bg-white p-3.5 shadow-[0_8px_22px_-14px_rgba(7,26,47,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00A89A]/55"
            >
              {/* Left Thumbnail Frame */}
              <div className="relative w-28 sm:w-32 shrink-0 rounded-xl bg-[#F4F8FB] overflow-hidden">
                <Image
                  src={item.imageSrc}
                  alt={item.title}
                  fill
                  sizes="128px"
                  className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Right Content Stack */}
              <div className="flex flex-1 flex-col justify-between gap-2 py-0.5 min-w-0">
                <div className="space-y-1.5">
                  <span className="inline-block rounded-md bg-[#E2F7F5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#009688]">
                    {item.category}
                  </span>
                  <h3 className="font-display text-sm font-bold text-[#071E36] group-hover:text-[#009688] transition-colors leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">
                    {item.excerpt}
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveArticle(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#009688] hover:text-[#071E36] transition-colors cursor-pointer"
                  >
                    <span>Read More</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Article Reader Dialog */}
      {activeArticle && (
        <Dialog
          open={Boolean(activeArticle)}
          onOpenChange={(open) => !open && setActiveArticle(null)}
        >
          <DialogContent className="max-w-2xl bg-white text-[#071E36] rounded-2xl p-6 sm:p-8 border-[#DCE7F0]">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <span className="font-bold text-[#009688]">{activeArticle.category}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{activeArticle.tag}</span>
              </div>
              <DialogTitle className="font-display text-xl sm:text-2xl font-bold leading-snug text-[#071E36]">
                {activeArticle.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#F4F8FB] border border-[#DCE7F0]">
                <Image
                  src={activeArticle.imageSrc}
                  alt={activeArticle.title}
                  fill
                  className="object-contain p-5"
                />
              </div>

              <div className="space-y-3 text-sm text-[#475569] leading-relaxed">
                {activeArticle.content.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              <div className="pt-4 border-t border-[#E2ECF3] flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={activeArticle.productLink}
                  onClick={() => setActiveArticle(null)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#071E36] px-5 text-xs font-bold text-white hover:bg-[#009688] transition-colors"
                >
                  <span>View Related Specifications</span>
                  <ArrowRight className="size-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  className="inline-flex min-h-[42px] items-center rounded-full border border-[#CBD8E4] px-4 text-xs font-semibold text-[#071E36] hover:border-[#00A89A] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
