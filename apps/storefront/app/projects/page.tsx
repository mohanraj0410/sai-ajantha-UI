import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import { PageHeader } from "@/components/non-home/PageHeader";
import type { Metadata } from "next";
import { ClipboardCheck, Layers, ShieldCheck } from "lucide-react";
import { ExecutionProcessSection } from "@/components/ExecutionProcessSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProjectsExplorer } from "@/components/ProjectsExplorer";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { ContactCTASection } from "@/components/TestimonialsAndContact";
import { FEATURED_PROJECTS } from "@/lib/solutionsAndProjects";

export const metadata: Metadata = {
  title: "Projects & Infrastructure Portfolio | Sai Ajantha Interior Solutions",
  description:
    "Browse planning examples for screens, door hardware, aluminium fittings and pantry components.",
  alternates: { canonical: "/projects" },
};

const PORTFOLIO_STANDARDS = [
  {
    code: "01 · BOQ Alignment",
    title: "Matched Component Schedules",
    detail:
      "Door closers, floor springs, EPDM seals, and 6063-T5 aluminium extrusions are mapped cleanly to floor-by-floor opening schedules before dispatch.",
    icon: ClipboardCheck,
  },
  {
    code: "02 · Multi-System Coordination",
    title: "Hardware + Framing Integration",
    detail:
      "Glass partition joinery, insect-screen pleats, and heavy-duty hardware are supplied together to minimize multi-vendor tolerances and site delays.",
    icon: Layers,
  },
  {
    code: "03 · Documented Accountability",
    title: "Trichy Trade & Site Support",
    detail:
      "Ask our Trichy team which documents and replacement parts are available for your order.",
    icon: ShieldCheck,
  },
] as const;

export default function ProjectsPage() {
  return (
    <StorefrontSurface family="content">
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollProgressBar />
      <Header />

      <main className="flex-1">
        {/* Architectural Hero Banner (/projects-banner.jpg) */}
        <PageHeader title="Project reference library" section="Planning guides" description="Explore sample hardware and fitting plans. These examples are for planning and do not show completed Sai Ajantha projects." image="/projects-banner.jpg" action={{ label: "Discuss your project", href: "/contact" }} />

        {/* Interactive Portfolio Explorer */}
        <section className="py-8 sm:py-12 bg-[#F4F6F9]">
          <div className="sa-content-width">

            <div className="mt-4 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                  Reference Infrastructure Packages
                </p>
                <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-[#102D4D]">
                  Browse reference examples
                </h2>
              </div>
              <p className="max-w-xl text-sm text-[#5D6B7B] leading-relaxed">
                Filter by type of space or search for a product. Confirm the final requirements for your own site.
              </p>
            </div>

            <ProjectsExplorer projects={FEATURED_PROJECTS} />
          </div>
        </section>

        {/* Execution & Coordination Standards */}
        <section className="py-12 sm:py-16 bg-[#F3F6FA] border-y border-[#EAF0F6]">
          <div className="sa-content-width">
            <div className="max-w-2xl mb-8">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                Engineering Delivery Protocol
              </span>
              <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-[#102D4D]">
                How Every Infrastructure Package Is Coordinated
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PORTFOLIO_STANDARDS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.code}
                    className="sa-border-gradient relative overflow-hidden rounded-2xl border border-[#EAF0F6] bg-white p-6 shadow-sm"
                  >
                    <div className="sa-card-accent-top" aria-hidden="true" />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#079D9A]">
                        {item.code}
                      </span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5F7F6] text-[#079D9A]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-[#102D4D]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#5D6B7B] leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Seven-Stage Project Execution Process */}
        <ExecutionProcessSection />

        {/* Project & BOQ Consultation CTA */}
        <ContactCTASection />
      </main>

      <Footer />
    </div>
    </StorefrontSurface>
  );
}
