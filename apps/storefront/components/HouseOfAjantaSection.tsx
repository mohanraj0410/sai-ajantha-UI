"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building, CheckCircle2, FileText, Info, Shield, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TiltCard } from "./TiltCard";
import { fadeUpVariants, staggerContainerVariants } from "@/lib/motionTokens";

/**
 * Checklist Requirement 2 & Phase 04 Section 03:
 * Dedicated House of Ajantha brand introduction section.
 * Showcases ONLY:
 * - Door Closers
 * - Kitchen Baskets
 * Keeps both on the agreed distributor sales route.
 * Strictly clarifies that Floor Springs require quotation / confirmation.
 * Enhanced with deep-navy architectural blueprint motifs, TiltCards, and glowing accents.
 */
export function HouseOfAjantaSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="house-of-ajantha"
      aria-labelledby="house-of-ajantha-heading"
      className="relative bg-[#0B1F35] text-white py-16 sm:py-24 lg:py-32 overflow-hidden border-t border-white/10"
    >
      {/* Anchor for backward compatibility with #house-of-ajanta */}
      <div id="house-of-ajanta" className="absolute -top-20" aria-hidden="true" />

      {/* Background Decorative Blueprint/Grid Accent & Ambient Radial Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#24C6D0_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 h-[480px] w-[480px] rounded-full bg-[#079D9A]/20 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-[#153C66]/40 blur-[130px]"
      />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-12 sm:space-y-16">
        {/* Brand Header Lockup */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#24C6D0]/40 bg-[#102D4D]/90 px-4 py-1 text-xs font-semibold text-[#24C6D0] shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5" />
            <span>Dedicated Brand Range · House of Ajantha</span>
          </div>

          <h2
            id="house-of-ajantha-heading"
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight"
          >
            HOUSE OF AJANTHA
          </h2>

          <p className="text-sm sm:text-base text-[#C6CAD5] leading-relaxed">
            House of Ajantha represents our premium specialized lines in hydraulic
            door controls and stainless steel kitchen storage systems. These product
            ranges are supplied through our authorized regional distributor
            network and institutional project contracts.
          </p>

          <div className="inline-flex items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 py-2 text-xs text-[#24C6D0] border border-white/10 backdrop-blur-xs">
            <Shield className="size-3.5 shrink-0" />
            <span>Preserved Distributor Sales Route · Commercial Wholesale &amp; Institutional Supply</span>
          </div>
        </div>

        {/* Two Dedicated Product Range Cards with 1:1 Square Images */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={shouldReduceMotion ? undefined : staggerContainerVariants(0.1)}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10"
        >
          {/* Range 1: Door Closers */}
          <motion.div variants={shouldReduceMotion ? undefined : fadeUpVariants} className="h-full">
            <TiltCard maxTilt={2} className="h-full">
              <div className="group relative rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-7 sm:p-9 backdrop-blur-md flex flex-col justify-between h-full hover:border-[#24C6D0]/80 hover:shadow-[0_20px_60px_-15px_rgba(36,198,208,0.25)] transition-all duration-300">
                {/* Subtle Architectural Corner Marks */}
                <span aria-hidden="true" className="absolute top-3 left-3 size-2.5 border-t border-l border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute top-3 right-3 size-2.5 border-t border-r border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute bottom-3 left-3 size-2.5 border-b border-l border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute bottom-3 right-3 size-2.5 border-b border-r border-white/30 group-hover:border-[#24C6D0] transition-colors" />

                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                      Division 01 · Door Controls
                    </span>
                    <Badge className="bg-[#24C6D0] text-[#0B1F35] font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                      Distributor Route
                    </Badge>
                  </div>

                  {/* 1:1 Square Product Photo Container */}
                  <div className="product-image-container relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c233d] to-[#07192b] border border-white/15 p-5 flex items-center justify-center shadow-inner">
                    <Image
                      src="/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg"
                      alt="House of Ajantha hydraulic door closer with scissor arm"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-2xl font-bold text-white group-hover:text-[#24C6D0] transition-colors">
                      Hydraulic Door Closers
                    </h3>
                    <p className="text-xs sm:text-sm text-[#C6CAD5] leading-relaxed">
                      Dual-valve hydraulic rack-and-pinion surface closers listed for doors from 60 kg to 100 kg.
                      Selected models listed in product records as Tested to 100,000 continuous operating cycles (verify per SKU).
                    </p>
                  </div>

                  {/* Feature Points */}
                  <div className="space-y-2.5 pt-3 border-t border-white/10 text-xs text-[#E8EDF3]">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                      <span>Dual independent valve adjustment for closing &amp; latching speeds</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                      <span>Compatible with timber, aluminium, steel and fire-rated door assemblies</span>
                    </div>
                  </div>

                  {/* Safe Commercial Policy Note on Floor Springs */}
                  <div className="rounded-xl bg-[#081726]/80 p-3.5 border border-white/10 flex items-start gap-2.5 text-xs text-[#A8B4C2]">
                    <Info className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-white">Floor Springs Notice:</strong> Floor springs: availability and sales route subject to confirmation. Request a quotation.
                    </p>
                  </div>
                </div>

                {/* Action Link */}
                <div className="mt-8 pt-5 border-t border-white/10">
                  <Button
                    asChild
                    className="w-full bg-white hover:bg-[#24C6D0] text-[#0B1F35] font-bold text-xs uppercase tracking-wider py-5 rounded-xl transition-all duration-300 shadow-md group-hover:shadow-[#24C6D0]/20 hover:scale-[1.02] active:scale-98"
                  >
                    <Link href="/products?category=Door+Closer+%26+Floor+Spring">
                      <span>Explore Door Closer Range</span>
                      <ArrowRight className="size-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* Range 2: Kitchen Baskets */}
          <motion.div variants={shouldReduceMotion ? undefined : fadeUpVariants} className="h-full">
            <TiltCard maxTilt={2} className="h-full">
              <div className="group relative rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-7 sm:p-9 backdrop-blur-md flex flex-col justify-between h-full hover:border-[#24C6D0]/80 hover:shadow-[0_20px_60px_-15px_rgba(36,198,208,0.25)] transition-all duration-300">
                {/* Subtle Architectural Corner Marks */}
                <span aria-hidden="true" className="absolute top-3 left-3 size-2.5 border-t border-l border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute top-3 right-3 size-2.5 border-t border-r border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute bottom-3 left-3 size-2.5 border-b border-l border-white/30 group-hover:border-[#24C6D0] transition-colors" />
                <span aria-hidden="true" className="absolute bottom-3 right-3 size-2.5 border-b border-r border-white/30 group-hover:border-[#24C6D0] transition-colors" />

                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                      Division 02 · Modular Storage
                    </span>
                    <Badge className="bg-[#24C6D0] text-[#0B1F35] font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5">
                      SS-304 Grade
                    </Badge>
                  </div>

                  {/* 1:1 Square Product Photo Container */}
                  <div className="product-image-container relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c233d] to-[#07192b] border border-white/15 p-5 flex items-center justify-center shadow-inner">
                    <Image
                      src="/products/Kitchen-Basket-plan-basket-img.jpg"
                      alt="House of Ajantha SS-304 grade kitchen pullout wire basket"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-2xl font-bold text-white group-hover:text-[#24C6D0] transition-colors">
                      Kitchen Baskets &amp; Wireware
                    </h3>
                    <p className="text-xs sm:text-sm text-[#C6CAD5] leading-relaxed">
                      Precision argon-welded SS-304 stainless steel pull-out wire baskets,
                      thali racks, partition drawers, and smooth telescopic ball-bearing
                      slide runners engineered for high kitchen load capacities.
                    </p>
                  </div>

                  {/* Feature Points */}
                  <div className="space-y-2.5 pt-3 border-t border-white/10 text-xs text-[#E8EDF3]">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                      <span>Heavy-gauge 100% genuine SS-304 wire with electro-polish finish</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                      <span>Smooth telescopic soft-close runners rated for heavy kitchen loads</span>
                    </div>
                  </div>

                  {/* Verified Material Integrity Note */}
                  <div className="rounded-xl bg-[#081726]/80 p-3.5 border border-white/10 flex items-start gap-2.5 text-xs text-[#A8B4C2]">
                    <FileText className="size-4 text-[#24C6D0] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-white">Wholesale Specifications:</strong> Custom drawer widths from 15&quot; to 21&quot; with matched soft-close channel runners for trade fabricators.
                    </p>
                  </div>
                </div>

                {/* Action Link */}
                <div className="mt-8 pt-5 border-t border-white/10">
                  <Button
                    asChild
                    className="w-full bg-white hover:bg-[#24C6D0] text-[#0B1F35] font-bold text-xs uppercase tracking-wider py-5 rounded-xl transition-all duration-300 shadow-md group-hover:shadow-[#24C6D0]/20 hover:scale-[1.02] active:scale-98"
                  >
                    <Link href="/products?category=Kitchen+Basket">
                      <span>Explore Kitchen Basket Range</span>
                      <ArrowRight className="size-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        </motion.div>

        {/* Distributor Program Routing Banner */}
        <div className="rounded-2xl border border-white/15 bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.08] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#24C6D0]/20 text-[#24C6D0] border border-[#24C6D0]/30 shadow-inner">
              <Building className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-display font-bold text-base sm:text-lg text-white">
                Interested in Regional Distribution for House of Ajantha Lines?
              </p>
              <p className="text-xs sm:text-sm text-[#C6CAD5] leading-relaxed">
                Regional distribution opportunities and wholesale fulfillment are coordinated through our partner desk.
              </p>
            </div>
          </div>

          <Button
            asChild
            className="bg-[#24C6D0] hover:bg-white text-[#0B1F35] font-bold text-xs uppercase tracking-wider px-6 py-5 rounded-xl shrink-0 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-98"
          >
            <Link href="/register?role=DISTRIBUTOR">
              <span>Apply for Distribution</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
