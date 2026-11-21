"use client";

import {
  Clock,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "./SectionHeading";
import { TiltCard } from "./TiltCard";
import { fadeUpVariants, staggerContainerVariants } from "@/lib/motionTokens";

/**
 * Checklist Requirement 2 & Phase 04 Section 05:
 * Core Values:
 * - Display four short core values approved by company leadership
 *   (From official Brand Guidelines p.10 "Eight Values. One Firm.")
 * - Enhanced with large typographic numerals, architectural connecting rules, TiltCards, and smooth reveal.
 */
export const OWNER_APPROVED_CORE_VALUES = [
  {
    number: "01",
    icon: ShieldCheck,
    title: "Quality Without Compromise",
    description:
      "Every product, specification, and installation decision must protect performance, durability, and customer trust.",
  },
  {
    number: "02",
    icon: UserCheck,
    title: "Customer Success First",
    description:
      "We solve the customer's project need and technical requirement before pursuing short-term business advantage.",
  },
  {
    number: "03",
    icon: Clock,
    title: "Timely Completion",
    description:
      "We plan carefully, communicate early, and treat agreed supply schedules as binding commitments.",
  },
  {
    number: "04",
    icon: Scale,
    title: "Integrity & Transparency",
    description:
      "We communicate specifications, alloy grades, pricing, and material limitations honestly and clearly.",
  },
] as const;

export function CoreValuesSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="core-values"
      aria-labelledby="values-heading"
      className="relative bg-[#F8FAFC] py-16 sm:py-20 lg:py-24 border-t border-[#E8EDF3] overflow-hidden"
    >
      {/* Subtle blueprint grid motif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[radial-gradient(#079D9A_1px,transparent_1px)] [background-size:24px_24px]"
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-10 sm:space-y-12">
        {/* Section Header */}
        <div className="max-w-2xl">
          <SectionHeading
            eyebrow="Our Guiding Principles"
            title="Core Values"
            description="Four non-negotiable operational principles approved by company leadership that govern every specification, supply schedule, and client relationship."
            titleId="values-heading"
          />
        </div>

        {/* 4 Cards Grid with Connecting Rule Motif & Staggered Reveal */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={shouldReduceMotion ? undefined : staggerContainerVariants(0.08)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative"
        >
          {OWNER_APPROVED_CORE_VALUES.map((val) => {
            const Icon = val.icon;
            return (
              <motion.div
                key={val.number}
                variants={shouldReduceMotion ? undefined : fadeUpVariants}
                className="h-full"
              >
                <TiltCard maxTilt={2.2} className="h-full">
                  <div className="group relative rounded-2xl border border-[#E8EDF3] bg-white p-7 shadow-xs hover:border-[#079D9A]/80 hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full">
                    {/* Architectural Corner Accents */}
                    <span aria-hidden="true" className="absolute top-2 left-2 size-2 border-t border-l border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors" />
                    <span aria-hidden="true" className="absolute top-2 right-2 size-2 border-t border-r border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors" />
                    <span aria-hidden="true" className="absolute bottom-2 left-2 size-2 border-b border-l border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors" />
                    <span aria-hidden="true" className="absolute bottom-2 right-2 size-2 border-b border-r border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors" />

                    {/* Top Accent Strip on Hover */}
                    <div
                      aria-hidden="true"
                      className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#079D9A] to-[#24C6D0] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl"
                    />

                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E5F7F6] text-[#079D9A] border border-[#079D9A]/20 group-hover:bg-[#0B1F35] group-hover:text-[#24C6D0] group-hover:border-[#0B1F35] transition-all duration-300 shadow-2xs">
                          <Icon className="size-5.5" />
                        </span>
                        <span className="font-mono text-base font-extrabold text-[#7B8896]/60 group-hover:text-[#079D9A] transition-colors bg-[#F8FAFC] px-2.5 py-1 rounded-md border border-[#E8EDF3]">
                          {val.number}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-display text-lg font-bold text-[#0B1F35] group-hover:text-[#079D9A] transition-colors leading-snug">
                          {val.title}
                        </h3>
                        <p className="mt-2 text-xs text-[#5D6B7B] leading-relaxed">
                          {val.description}
                        </p>
                      </div>
                    </div>

                    {/* Subtle Bottom Architectural Rule */}
                    <div className="mt-6 pt-3 border-t border-[#E8EDF3] flex items-center justify-between text-[11px] font-mono text-[#7B8896]">
                      <span>PRINCIPLE // {val.number}</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#079D9A]/40 group-hover:bg-[#079D9A] transition-colors" />
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
