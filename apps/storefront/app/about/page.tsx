import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { TrustMarkIconById } from "@/components/BrandIcons";
import { CoreValuesSection } from "@/components/CoreValuesSection";
import { ExecutionProcessSection } from "@/components/ExecutionProcessSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { ContactCTASection } from "@/components/TestimonialsAndContact";
import { Badge } from "@/components/ui/badge";
import {
  BRAND_CONTACT,
  CUSTOMER_SEGMENTS,
  TRUST_MARKS,
  VISION_MISSION,
} from "@/lib/brand";
import { SOLUTIONS } from "@/lib/solutionsAndProjects";

export const metadata: Metadata = {
  title: "About Sai Ajantha | Interior Infrastructure Partner Since 1994",
  description:
    "Established in 1994 in Trichy, Tamil Nadu, Sai Ajantha Interior Solutions supplies quality insect screens, aluminium profiles, and architectural hardware backed by reliable guidance and fast local dispatch.",
  alternates: { canonical: "/about" },
};

const HERITAGE_EVOLUTION = [
  {
    phase: "01 · 1994 Foundation",
    title: "Extruded Aluminium & Profile Precision in Trichy",
    detail:
      "Established in Tiruchirappalli supplying reliable architectural aluminium sections and modular framing hardware to builders and fabricators across the region.",
  },
  {
    phase: "02 · Technical Integration",
    title: "Acoustic, Door Control & Engineered Assemblies",
    detail:
      "Expanded into complete IS 733 / EN 755 and BS EN 1154 specified systems combining multi-track extrusions, EPDM gaskets, floor springs, and SS-304 hardware.",
  },
  {
    phase: "03 · Statewide Execution",
    title: "Statewide Hardware & Screen Supply Partner",
    detail:
      "Supporting homeowners, fabricators, dealers, contractors, and builders across Tamil Nadu with quality products, fair pricing, and dependable service.",
  },
] as const;

export default function AboutPage() {
  return (
    <StorefrontSurface family="content">
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />
      <Header />

      <main className="flex-1">
        {/* Architectural Hero Banner */}
        <PageHeader title="About Sai Ajantha" section="Our company" description="Architectural hardware, aluminium profiles and insect screens from our team in Trichy." image="/about-banner.jpg" action={{ label: "See our products", href: "/products" }} />

        {/* Main Brand Identity, Vision/Mission & Evolution Band */}
        <section className="py-8 sm:py-12 bg-[#F4F6F9]">
          <div className="sa-content-width">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Manifesto, Vision/Mission Cards & Evolution Track */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#079D9A]/30 bg-[#E5F7F6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                    Our Difference
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-[#0b1f35]">What we supply</h2>
                  <p className="text-sm sm:text-[15px] leading-relaxed text-[#5D6B7B]">
                    We help homeowners, builders and tradespeople choose hardware, screens and profiles for their spaces.
                  </p>
                </div>

                {/* High-Contrast Side-by-Side Vision & Mission Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sa-dark-radial-panel rounded-2xl border border-[#174B78] p-6 text-white space-y-2.5 shadow-lg">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                      <Award className="size-3.5" />
                      Our vision
                    </span>
                    <p className="text-sm font-medium leading-relaxed text-[#EAF0F6]">
                      {VISION_MISSION.vision}
                    </p>
                  </div>

                  <div className="sa-border-gradient rounded-2xl border border-[#C6CAD5] bg-gradient-to-br from-[#F3F6FA] to-white p-6 space-y-2.5 sa-elevated-card">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                      <ShieldCheck className="size-3.5" />
                      Our mission
                    </span>
                    <p className="text-sm font-semibold leading-relaxed text-[#102D4D]">
                      {VISION_MISSION.mission}
                    </p>
                  </div>
                </div>

                {/* Three-Phase Heritage Evolution Track */}
                <div className="rounded-2xl border border-[#C6CAD5]/80 bg-[#F3F6FA]/75 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                      Company history
                    </p>
                    <span className="text-[11px] font-semibold text-[#5D6B7B]">
                      Since {BRAND_CONTACT.foundedYear}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {HERITAGE_EVOLUTION.map((item) => (
                      <div
                        key={item.phase}
                        className="rounded-xl border border-[#EAF0F6] bg-white p-4 space-y-1.5"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#079D9A]">
                          {item.phase}
                        </span>
                        <h3 className="font-display text-sm font-bold text-[#102D4D]">
                          {item.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-[#5D6B7B]">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Brand Archetype & Proof-of-Trust Seals */}
              <div className="lg:col-span-5 space-y-5">
                <div className="sa-dark-radial-panel rounded-2xl border border-[#174B78] text-white p-6 sm:p-7 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                      Buying support
                    </span>
                    <Badge
                      variant="teal"
                      className="bg-[#24C6D0] text-[#0B1F35] border-0 font-bold"
                    >
                      {VISION_MISSION.promise.join(" · ")}
                    </Badge>
                  </div>
                  <h3 className="font-display text-2xl font-bold">
                    Help choosing a product
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-[#C6CAD5]">
                    Tell us the size, material and where you plan to use it. We can help you check which products fit.
                  </p>
                  <ul className="space-y-2 pt-3 border-t border-white/15">
                    {["Check the size and material", "Ask about delivery for your PIN", "Request a quote for custom or bulk orders"].map((trait) => (
                      <li
                        key={trait}
                        className="flex items-center gap-2.5 text-xs font-medium text-[#EAF0F6]"
                      >
                        <CheckCircle2 className="size-3.5 text-[#24C6D0] shrink-0" />
                        <span>{trait}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sa-border-gradient rounded-2xl border border-[#C6CAD5] bg-white p-5 sm:p-6 sa-elevated-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#102D4D]">
                      Sai Ajantha Trust Marks
                    </p>
                    <span className="text-[10px] font-semibold text-[#079D9A]">
                      8 Brand Pillars
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TRUST_MARKS.map((mark) => (
                      <div
                        key={mark.id}
                        className="sa-hover-lift flex flex-col items-center text-center rounded-xl border border-[#EAF0F6] bg-gradient-to-b from-[#F3F6FA] to-white p-3"
                      >
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#E5F7F6]">
                          <TrustMarkIconById id={mark.id} className="h-6 w-6" />
                        </div>
                        <span className="mt-2 text-[10px] font-bold text-[#102D4D] leading-tight">
                          {mark.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Six Infrastructure Divisions Quick Directory */}
        <section className="py-8 sm:py-10 bg-white border-t border-[#EAF0F6]">
          <div className="sa-content-width">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                  Core Capabilities Directory
                </span>
                <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#102D4D]">
                  Six Specialized Infrastructure Divisions
                </h2>
              </div>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#079D9A] hover:text-[#102D4D] transition-colors"
              >
                <span>View Detailed Specifications</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SOLUTIONS.map((sol) => (
                <Link
                  key={sol.slug}
                  href={`/solutions/${sol.slug}`}
                  className="group sa-border-gradient sa-card-accent-top sa-hover-lift flex flex-col justify-between overflow-hidden rounded-2xl border border-[#C6CAD5]/80 bg-gradient-to-b from-white to-[#F3F6FA]/70 p-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.15em]">
                      <span className="rounded bg-[#102D4D] px-2 py-0.5 text-white">
                        {sol.code}
                      </span>
                      <span className="text-[#079D9A]">{sol.sectorMix}</span>
                    </div>
                    <h3 className="mt-3 font-display text-base sm:text-lg font-bold text-[#102D4D] group-hover:text-[#079D9A] transition-colors">
                      {sol.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#5D6B7B] line-clamp-2">
                      {sol.summary}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#079D9A]">
                    <span>Inspect Division</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Institutional & Trade Decision-Makers */}
        <section className="py-9 sm:py-11 sa-surface-gradient border-t border-[#EAF0F6]">
          <div className="sa-content-width">
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                Customer Personas &amp; Advisory Scope
              </span>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#102D4D]">
                Who We Advise &amp; Supply
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {CUSTOMER_SEGMENTS.map((seg) => (
                <div
                  key={seg.title}
                  className="sa-border-gradient sa-card-accent-top sa-hover-lift overflow-hidden rounded-2xl border border-[#C6CAD5] bg-white p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant="teal"
                      className="bg-gradient-to-r from-[#079D9A] to-[#174B78] text-white border-0"
                    >
                      {seg.label}
                    </Badge>
                    <Building2 className="size-5 text-[#079D9A]/60" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#102D4D]">
                      {seg.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#079D9A]">
                      {seg.roles}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#EAF0F6] text-xs leading-relaxed">
                    <div className="rounded-xl bg-[#F3F6FA] p-3">
                      <p className="font-bold text-[#102D4D]">Buying Triggers</p>
                      <p className="mt-1 text-[#5D6B7B]">{seg.trigger}</p>
                    </div>
                    <div className="rounded-xl bg-[#F3F6FA] p-3">
                      <p className="font-bold text-[#102D4D]">
                        Risks Mitigated
                      </p>
                      <p className="mt-1 text-[#5D6B7B]">{seg.painPoints}</p>
                    </div>
                    <div className="rounded-xl bg-[#E5F7F6]/70 border border-[#079D9A]/25 p-3">
                      <p className="font-bold text-[#102D4D]">Our Commitment</p>
                      <p className="mt-1 text-[#102D4D]">{seg.assurance}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CoreValuesSection />
        <ExecutionProcessSection />
        <ContactCTASection />
      </main>

      <Footer />
    </div>
    </StorefrontSurface>
  );
}
