import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { BackendErrorState } from "@/components/BackendErrorState";
import { PageHeader } from "@/components/non-home/PageHeader";
import { BrandProductCard } from "@/components/BrandProductCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import {
  fetchMedusaCatalogStrict,
  medusaCatalogProductToProductItem,
} from "@/lib/server/medusa";
import { SOLUTIONS } from "@/lib/solutionsAndProjects";

interface SolutionDetailPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SOLUTIONS.map((sol) => ({ slug: sol.slug }));
}

export async function generateMetadata({
  params,
}: SolutionDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sol = SOLUTIONS.find((s) => s.slug === slug);
  if (!sol) return { title: "Solution Not Found" };

  return {
    title: `${sol.title} | Sai Ajantha Solutions`,
    description: sol.summary,
    alternates: { canonical: `/solutions/${sol.slug}` },
  };
}

async function SolutionDetailContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentIdx = SOLUTIONS.findIndex((s) => s.slug === slug);
  if (currentIdx === -1) notFound();

  const sol = SOLUTIONS[currentIdx];
  const prevSol = currentIdx > 0 ? SOLUTIONS[currentIdx - 1] : null;
  const nextSol =
    currentIdx < SOLUTIONS.length - 1 ? SOLUTIONS[currentIdx + 1] : null;

  await connection();
  const catalogRes = await fetchMedusaCatalogStrict();
  const liveProducts = catalogRes.ok
    ? catalogRes.products.map((mp) =>
        medusaCatalogProductToProductItem(mp, mp.customerPriceInr)
      )
    : [];
  const matchingProducts = liveProducts
    .filter((p) => sol.relatedCategories.includes(p.category))
    .slice(0, 8);

  return (
    <div className="sa-content-width pb-8 sm:pb-12">

      <PageHeader inset title={sol.title} section="Product application" description={sol.tagline} parents={[{ label: "Solutions", href: "/solutions" }]} action={{ label: "Talk to us", href: "/contact" }} />
      <section className="sa-detail-panel mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 p-5 sm:p-8 items-center">
        <div className="space-y-3">
          <p className="sa-group-label">Planning reference</p>
          <h2 className="text-xl font-bold text-[#0B1F35]">{sol.shortTitle}</h2>
          <p className="text-sm sm:text-base leading-relaxed">{sol.description}</p>
          <Link className="inline-flex gap-2 font-semibold text-[#076864] underline underline-offset-4" href={`/products?category=${encodeURIComponent(sol.relatedCategories[0] ?? "")}`}>
            Browse related products <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="relative aspect-[16/9] rounded-xl bg-[#f4f6f9]">
          <Image src={sol.image} alt={sol.title} fill sizes="(max-width: 768px) 100vw, 45vw" className="object-contain p-3" />
        </div>
      </section>

      {/* Applications & Technical Specs */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 sa-border-gradient rounded-2xl border border-[#C6CAD5] bg-white p-6 sa-elevated-card">
          <h2 className="font-display text-xl font-bold text-[#102D4D]">
            Key Project Applications
          </h2>
          <ul className="mt-4 space-y-2.5">
            {sol.applications.map((app) => (
              <li
                key={app}
                className="flex items-start gap-2.5 rounded-xl border border-[#EAF0F6] bg-[#F3F6FA] px-4 py-3 text-xs sm:text-sm font-medium text-[#102D4D]"
              >
                <CheckCircle2 className="mt-0.5 size-4 text-[#079D9A] shrink-0" />
                <span>{app}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7 sa-border-gradient rounded-2xl border border-[#C6CAD5] bg-white p-6 sa-elevated-card">
          <h2 className="font-display text-xl font-bold text-[#102D4D]">
            Technical System Specifications
          </h2>
          <dl className="mt-4 divide-y divide-[#EAF0F6]">
            {sol.specifications.map((spec) => (
              <div
                key={spec.label}
                className="py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs sm:text-sm"
              >
                <dt className="sm:col-span-4 font-bold text-[#102D4D]">
                  {spec.label}
                </dt>
                <dd className="sm:col-span-8 text-[#5D6B7B]">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Matching Products */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
              Integrated Product Schedule
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#102D4D]">
              Compatible SKUs for {sol.shortTitle}
            </h2>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#079D9A] hover:text-[#102D4D] transition-colors"
          >
            <span>
              {liveProducts.length > 0
                ? `View All ${liveProducts.length} Products`
                : "View Full Catalogue"}
            </span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {!catalogRes.ok ? (
          <BackendErrorState
            title="Unable to Load Compatible SKUs"
            message={catalogRes.error}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {matchingProducts.map((item) => (
              <BrandProductCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Division Prev / Next Navigation */}
      <div className="mt-10 pt-6 border-t border-[#C6CAD5]/70 flex flex-wrap items-center justify-between gap-4">
        {prevSol ? (
          <Link
            href={`/solutions/${prevSol.slug}`}
            className="group inline-flex items-center gap-2 rounded-xl border border-[#C6CAD5] bg-[#F3F6FA] hover:border-[#079D9A] px-4 py-3 text-xs font-bold text-[#102D4D] transition-colors"
          >
            <ArrowLeft className="size-4 text-[#079D9A] transition-transform group-hover:-translate-x-1" />
            <span>
              <span className="block text-[10px] uppercase tracking-wider text-[#5D6B7B]">
                Previous Division
              </span>
              {prevSol.shortTitle}
            </span>
          </Link>
        ) : (
          <Link
            href="/solutions"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#079D9A] hover:text-[#102D4D]"
          >
            <ArrowLeft className="size-4" />
            <span>All 6 Divisions</span>
          </Link>
        )}

        {nextSol && (
          <Link
            href={`/solutions/${nextSol.slug}`}
            className="group inline-flex items-center gap-2 rounded-xl border border-[#C6CAD5] bg-[#F3F6FA] hover:border-[#079D9A] px-4 py-3 text-xs font-bold text-[#102D4D] text-right transition-colors ml-auto"
          >
            <span>
              <span className="block text-[10px] uppercase tracking-wider text-[#5D6B7B]">
                Next Division
              </span>
              {nextSol.shortTitle}
            </span>
            <ArrowRight className="size-4 text-[#079D9A] transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SolutionDetailPage({
  params,
}: SolutionDetailPageProps) {
  return (
    <StorefrontSurface family="content">
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="p-14 text-center text-sm text-[#7B8896]">
              Loading solution specifications...
            </div>
          }
        >
          <SolutionDetailContent params={params} />
        </Suspense>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
