"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, ShieldCheck, Users, Wrench } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BRAND_CONTACT } from "@/lib/brand";
import { TiltCard } from "./TiltCard";
import { fadeUpVariants, staggerContainerVariants } from "@/lib/motionTokens";

/**
 * Checklist Requirement 2 & Phase 04 Section 04:
 * About Sai Ajantha:
 * - Who we are, what we supply, whom we serve
 * - High-end architectural photography showcase with Trichy heritage badge
 * - Strict alignment with verified facts (Est. 1994 in Tiruchirappalli)
 * - Enhanced with architectural blueprint markers, subtle parallax card rhythm, and micro-hover states.
 */
export function AboutCompanySection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="relative bg-white py-16 sm:py-24 lg:py-32 border-t border-[#E8EDF3] overflow-hidden"
    >
      {/* Background Architectural Grid Motifs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025] bg-[radial-gradient(#102D4D_1px,transparent_1px)] [background-size:32px_32px]"
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Column: Architectural Photo Showcase */}
          <div className="lg:col-span-5 relative">
            <TiltCard maxTilt={1.8} enableScale={false} className="w-full">
              <div className="relative overflow-hidden rounded-3xl border border-[#E8EDF3] bg-[#0B1F35] shadow-2xl group">
                {/* Architectural Corner Accents */}
                <span aria-hidden="true" className="absolute top-3 left-3 size-2.5 border-t-2 border-l-2 border-white/40 z-20" />
                <span aria-hidden="true" className="absolute top-3 right-3 size-2.5 border-t-2 border-r-2 border-white/40 z-20" />
                <span aria-hidden="true" className="absolute bottom-3 left-3 size-2.5 border-b-2 border-l-2 border-white/40 z-20" />
                <span aria-hidden="true" className="absolute bottom-3 right-3 size-2.5 border-b-2 border-r-2 border-white/40 z-20" />

                <div className="relative aspect-[4/3] sm:aspect-[16/11] lg:h-[480px] w-full overflow-hidden">
                  <Image
                    src="/about-showcase.jpg"
                    alt="Sai Ajantha architectural partitions, aluminium framing and hardware installations across Tamil Nadu"
                    fill
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-104"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#0B1F35]/95 via-[#0B1F35]/35 to-transparent"
                  />

                  {/* Location Badge */}
                  <div className="absolute top-5 left-5 z-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1F35]/90 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold text-[#24C6D0] border border-white/20 shadow-xs">
                      <MapPin className="size-3.5 text-[#24C6D0]" />
                      <span>{BRAND_CONTACT.city}</span>
                    </span>
                  </div>

                  {/* Founded Badge */}
                  <div className="absolute top-5 right-5 z-10">
                    <Badge className="bg-white/95 text-[#0B1F35] border-white/40 text-[11px] font-bold px-3 py-1 shadow-xs backdrop-blur-md">
                      Est. {BRAND_CONTACT.foundedYear}
                    </Badge>
                  </div>

                  {/* Bottom Caption */}
                  <div className="absolute bottom-5 left-5 right-5 text-white space-y-1.5 z-10">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#24C6D0] block">
                      Proven Infrastructure Track Record
                    </span>
                    <p className="font-display text-lg sm:text-xl font-bold leading-snug">
                      Architectural Hardware, Extrusions &amp; Partition Systems
                    </p>
                  </div>
                </div>

                {/* Bottom Quick Facts Bar */}
                <div className="bg-[#0B1F35] px-6 py-5 text-white flex items-center justify-between gap-4 border-t border-white/10">
                  <div>
                    <p className="text-xl sm:text-2xl font-extrabold text-[#24C6D0] tabular-nums">30+ Years</p>
                    <p className="text-[10px] text-[#A8B4C2] uppercase tracking-wider font-medium">In Industry (1994)</p>
                  </div>
                  <div className="h-8 w-px bg-white/15" />
                  <div>
                    <p className="text-xl sm:text-2xl font-extrabold text-white">Central Hub</p>
                    <p className="text-[10px] text-[#A8B4C2] uppercase tracking-wider font-medium">Tiruchirappalli</p>
                  </div>
                  <div className="h-8 w-px bg-white/15" />
                  <div>
                    <p className="text-xl sm:text-2xl font-extrabold text-[#24C6D0]">Statewide</p>
                    <p className="text-[10px] text-[#A8B4C2] uppercase tracking-wider font-medium">Tamil Nadu</p>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* Right Column: Three Core Answers: Who, What, Whom */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-3.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#079D9A]/30 bg-[#E5F7F6] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                <Building2 className="size-3.5" />
                <span>About Sai Ajantha</span>
              </span>

              <h2
                id="about-heading"
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0B1F35] leading-[1.12]"
              >
                ABOUT SAI AJANTHA
              </h2>

              <p className="text-base sm:text-lg text-[#5D6B7B] leading-relaxed">
                Established in 1994 in Tiruchirappalli, Sai Ajantha Interior Solutions
                combines three decades of materials expertise with rigorous technical standards.
                We bridge the gap between precise architectural drawings and dependable on-site
                supply and performance.
              </p>
            </div>

            {/* 3 Structured Explanations with Staggered Entrance */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              variants={shouldReduceMotion ? undefined : staggerContainerVariants(0.08)}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5"
            >
              {/* 1. Who We Are */}
              <motion.div variants={shouldReduceMotion ? undefined : fadeUpVariants}>
                <TiltCard maxTilt={2.2} className="h-full">
                  <div className="group rounded-2xl border border-[#E8EDF3] bg-[#F8FAFC] p-5 space-y-2.5 hover:border-[#079D9A]/80 hover:bg-white hover:shadow-md transition-all duration-300 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                        01. Who We Are
                      </span>
                      <Building2 className="size-4 text-[#7B8896] group-hover:text-[#079D9A] transition-colors" />
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0B1F35]">
                      Established Partner
                    </h3>
                    <p className="text-xs text-[#5D6B7B] leading-relaxed">
                      A Tamil Nadu-based architectural interior infrastructure supplier
                      headquartered in Trichy with direct warehouse operations.
                    </p>
                  </div>
                </TiltCard>
              </motion.div>

              {/* 2. What We Supply */}
              <motion.div variants={shouldReduceMotion ? undefined : fadeUpVariants}>
                <TiltCard maxTilt={2.2} className="h-full">
                  <div className="group rounded-2xl border border-[#E8EDF3] bg-[#F8FAFC] p-5 space-y-2.5 hover:border-[#079D9A]/80 hover:bg-white hover:shadow-md transition-all duration-300 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                        02. What We Supply
                      </span>
                      <Wrench className="size-4 text-[#7B8896] group-hover:text-[#079D9A] transition-colors" />
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0B1F35]">
                      Engineered Products
                    </h3>
                    <p className="text-xs text-[#5D6B7B] leading-relaxed">
                      6063-T5 aluminium profiles, SS-304 hardware, pleated insect screens,
                      frameless glass fittings, and acoustic seals.
                    </p>
                  </div>
                </TiltCard>
              </motion.div>

              {/* 3. Whom We Serve */}
              <motion.div variants={shouldReduceMotion ? undefined : fadeUpVariants}>
                <TiltCard maxTilt={2.2} className="h-full">
                  <div className="group rounded-2xl border border-[#E8EDF3] bg-[#F8FAFC] p-5 space-y-2.5 hover:border-[#079D9A]/80 hover:bg-white hover:shadow-md transition-all duration-300 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#079D9A]">
                        03. Whom We Serve
                      </span>
                      <Users className="size-4 text-[#7B8896] group-hover:text-[#079D9A] transition-colors" />
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0B1F35]">
                      Homes, Shops &amp; Trade
                    </h3>
                    <p className="text-xs text-[#5D6B7B] leading-relaxed">
                      Homeowners, shop owners, commercial contractors, architects, fabricators,
                      and authorized regional trade dealers.
                    </p>
                  </div>
                </TiltCard>
              </motion.div>
            </motion.div>

            {/* CTA Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[#0B1F35] hover:bg-[#079D9A] text-white text-xs font-bold uppercase tracking-[0.14em] px-7 py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-98 group cursor-pointer"
              >
                <Link href="/about">
                  <span>Learn More About Us</span>
                  <ArrowRight className="size-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[#C6CAD5] text-[#0B1F35] hover:border-[#079D9A] hover:text-[#079D9A] hover:bg-[#F3F6FA] text-xs font-bold uppercase tracking-[0.14em] px-7 py-6 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <Link href="/contact">
                  <span>Contact Our Team</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
