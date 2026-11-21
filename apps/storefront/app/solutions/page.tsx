import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, ShieldCheck, Wrench } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { SolutionsExplorer } from "@/components/SolutionsExplorer";
import { ContactCTASection } from "@/components/TestimonialsAndContact";

export const metadata: Metadata = {
  title: "Interior Solutions | Screen, Aluminium & Architectural Hardware",
  description:
    "Explore Sai Ajantha's integrated solutions across Insect Screens & Door Control, Commercial Interiors, Acoustic Solutions, Ceiling & Wall Systems, and Aluminium Framing.",
  alternates: { canonical: "/solutions" },
};

const DELIVERY_PILLARS = [
  {
    step: "01 · Specification Alignment",
    title: "Matched Hardware & Profiles",
    detail:
      "Every door closer, floor spring, gasket, and 6063-T5 extrusion is specified to work cleanly together on site.",
    icon: ShieldCheck,
  },
  {
    step: "02 · Technical Procurement",
    title: "Clear BOQ & Role-Tiered Supply",
    detail:
      "Verified technical datasheets, sample kits, and structured billing schedules supporting contractors and institutions.",
    icon: Layers,
  },
  {
    step: "03 · Single-Point Execution",
    title: "Trichy Dispatch & After-Sales",
    detail:
      "Coordinated installation support, tolerance checks, and documented replacement warranty across Tamil Nadu.",
    icon: Wrench,
  },
] as const;

export default function SolutionsPage() {
  return (
    <StorefrontSurface family="content">
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />
      <Header />

      <main className="flex-1">
        {/* Architectural Hero Banner (/solutions-banner.jpg) */}
        <PageHeader title="Solutions for your space" section="Product applications" description="Explore product options for doors, windows, partitions and interior fittings." image="/solutions-banner.jpg" action={{ label: "Browse products", href: "/products" }} />

        {/* Interactive Solutions Directory */}
        <section className="py-8 sm:py-12 bg-[#F4F6F9]">
          <div className="sa-content-width">

            <SolutionsExplorer />
          </div>
        </section>

        {/* Three-Stage Integration & Delivery Model */}
        <section className="py-8 sm:py-10 sa-surface-gradient border-t border-[#EAF0F6]">
          <div className="sa-content-width space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                  How Our Divisions Integrate
                </span>
                <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#102D4D]">
                  From Specification Review to Completed Handover
                </h2>
              </div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#079D9A] hover:text-[#102D4D] transition-colors"
              >
                <span>View Executed Project Scopes</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {DELIVERY_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.step}
                    className="sa-border-gradient sa-card-accent-top sa-hover-lift rounded-2xl border border-[#C6CAD5]/80 bg-white p-6 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F7F6] text-[#079D9A]">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#079D9A]">
                        {pillar.step}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#102D4D]">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-[#5D6B7B]">
                      {pillar.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <ContactCTASection />
      </main>

      <Footer />
    </div>
    </StorefrontSurface>
  );
}
