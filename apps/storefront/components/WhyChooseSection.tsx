"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export const VERIFIED_QUALITY_PILLARS = [
  {
    id: "extrusions",
    title: "Wide Product Range",
    description:
      "Complete solutions across aluminium profiles, insect screens, and architectural hardware.",
    imageSrc: "/products/Aluminium-[A-Interlock-12-028]-interlock.jpg",
  },
  {
    id: "door-controls",
    title: "Built for High-Use Spaces",
    description:
      "Durable, low-maintenance dual-valve hardware engineered for demanding environments.",
    imageSrc:
      "/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg",
  },
  {
    id: "hardware",
    title: "Verified Specifications",
    description:
      "Material grades, dimensions, and capacities documented cleanly on every approved SKU.",
    imageSrc: "/products/Hardware-[RA-HW-007]-18-i-max.jpg",
  },
  {
    id: "warranty",
    title: "Trusted & Experienced",
    description:
      "Three decades of industry experience from our Tiruchirappalli central hub since 1994.",
    imageSrc:
      "/products/finshed-Inset-screens-[SA-IS-duro-pleated-014]-img.jpg",
  },
] as const;

export function WhyChooseSection() {
  return (
    <section
      id="why-sai-ajantha"
      aria-labelledby="why-sai-ajantha-heading"
      className="bg-white py-16 sm:py-22"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-10">
        {/* Asymmetric Intro Left + 4 Compact Photo Cards Right matching target design */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Intro Block */}
          <div className="lg:col-span-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00A89A]">
              The Ajantha Advantage
            </p>
            <h2
              id="why-sai-ajantha-heading"
              className="font-display text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#071E36] leading-tight"
            >
              Why Sai Ajantha
            </h2>
            <p className="text-xs sm:text-sm text-[#5B7086] leading-relaxed">
              A preferred partner for architects, facility managers, contractors, and homeowners
              across Tamil Nadu.
            </p>
          </div>

          {/* Right 4 Photographic Proof Cards */}
          <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VERIFIED_QUALITY_PILLARS.map((pillar) => (
              <article
                key={pillar.id}
                className="group rounded-2xl border border-[#E2ECF3] bg-white p-3.5 shadow-[0_8px_22px_-14px_rgba(7,26,47,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#00A89A]/50 space-y-3"
              >
                <div className="relative aspect-[4/3] w-full rounded-xl bg-[#F4F8FB] overflow-hidden">
                  <Image
                    src={pillar.imageSrc}
                    alt={pillar.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="object-contain p-3.5 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="px-1 pb-1 space-y-1">
                  <h3 className="font-display text-sm font-bold text-[#071E36] leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Sleek Dark Navy-to-Teal Consultation Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#071E36] via-[#0A2E50] to-[#064A5B] px-6 py-5 sm:px-8 sm:py-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-[0_16px_36px_-18px_rgba(7,26,47,0.45)]">
          <div className="flex items-center gap-4 max-w-2xl">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-[#14D5C6]">
              <ShieldCheck className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="font-display text-base sm:text-lg font-bold text-white leading-snug">
                Need the right solution for your project?
              </p>
              <p className="text-xs sm:text-[13px] text-[#C8DBE8] leading-relaxed">
                Get expert guidance, product recommendations, and a quick quote from our Trichy
                team.
              </p>
            </div>
          </div>

          <Link
            href="/contact"
            className="group inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00A89A] to-[#12CFC0] px-6 text-xs font-bold text-white shadow-[0_8px_20px_-8px_rgba(0,196,180,0.75)] hover:from-[#009386] hover:to-[#00B8A9] transition-all shrink-0 whitespace-nowrap"
          >
            <span>Request a Consultation</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
