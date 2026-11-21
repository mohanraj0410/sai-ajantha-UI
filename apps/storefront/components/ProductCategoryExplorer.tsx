"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./SectionHeading";
import { TiltCard } from "./TiltCard";
import { fadeUpVariants, staggerContainerVariants } from "@/lib/motionTokens";

export interface DirectSaleCategory {
  id: string;
  name: string;
  queryParam: string;
  href: string;
  badge: string;
  description: string;
  imageSrc: string;
  keySpecs: string;
  tagline: string;
}

/**
 * Checklist Requirement 2 (Homepage) & Phase 04 Section 02:
 * Exactly nine direct-sale category tiles:
 * 1. Finished Insect Screens
 * 2. Aluminium Sections
 * 3. Hardware
 * 4. Ladders
 * 5. Rubber & PVC Beading
 * 6. FGM Fittings & Channels
 * 7. Clips
 * 8. Frames & Channels
 * 9. Mesh
 *
 * All category images use a consistent 1:1 square aspect ratio (`aspect-square`) with object-contain.
 * Enhanced with architectural precision tilt, blueprint ticks, kinetic arrows, and staggered reveal.
 */
export const NINE_DIRECT_SALE_CATEGORIES_DATA: readonly DirectSaleCategory[] = [
  {
    id: "finished-insect-screens",
    name: "Finished Insect Screens",
    queryParam: "Insect Screens",
    href: "/products?category=Insect+Screens",
    badge: "Vector Barrier",
    tagline: "Barrier-Free & Roll-Up",
    description:
      "Retractable pleated screens, roll-up systems, and barrier-free sliding patio meshes engineered for hygienic vector protection.",
    imageSrc:
      "/products/finshed-Inset-screens-[SA-IS-duro-pleated-014]-img.jpg",
    keySpecs: "Pleated & Roll-Up · Barrier-Free",
  },
  {
    id: "aluminium-sections",
    name: "Aluminium Sections",
    queryParam: "Aluminium",
    href: "/products?category=Aluminium",
    badge: "Architectural Extrusions",
    tagline: "Multi-Track & Partition",
    description:
      "Precision extruded architectural profiles for multi-track sliding windows, office partitions, and door frames.",
    imageSrc: "/products/Aluminium-[A-Interlock-12-028]-interlock.jpg",
    keySpecs: "9–12 ft Extrusions · Anodized",
  },
  {
    id: "hardware",
    name: "Hardware",
    queryParam: "Hardware",
    href: "/products?category=Hardware",
    badge: "Fittings & Accessories",
    tagline: "High-Load Friction Stays",
    description:
      "Heavy-duty SS-304 friction hinges, architectural pull handles, multi-point locks, and precision window latch fittings.",
    imageSrc: "/products/Hardware-[RA-HW-007]-18-i-max.jpg",
    keySpecs: "SS-304 & Architectural Hardware",
  },
  {
    id: "ladders",
    name: "Ladders",
    queryParam: "Ladder",
    href: "/products?category=Ladder",
    badge: "Industrial Access",
    tagline: "Anti-Skid Working Platforms",
    description:
      "Industrial aluminium step ladders, A-type foldable ladders, and wide anti-skid working platform extensions.",
    imageSrc: "/products/Ladder-A-type-6-20-A-type-ladder_.jpg",
    keySpecs: "Anti-Skid Rungs · Heavy Duty",
  },
  {
    id: "rubber-pvc-beading",
    name: "Rubber & PVC Beading",
    queryParam: "Rubber & PVC",
    href: "/products?category=Rubber+%26+PVC",
    badge: "Weather Seals",
    tagline: "Acoustic & Ozone Resistant",
    description:
      "Virgin EPDM weather-strip gaskets, acoustic glazing beads, and co-extruded PVC seal profiles for complete weather sealing.",
    imageSrc:
      "/products/Rubber-&PVC-[MA-R-DRubber-005]-Partition-Rubber.jpg",
    keySpecs: "Acoustic Edge · Ozone Resistant",
  },
  {
    id: "fgm-fittings-channels",
    name: "FGM Fittings & Channels",
    queryParam: "FGM Fittings",
    href: "/products?category=FGM+Fittings",
    badge: "Frameless Glass",
    tagline: "10–12mm Toughened Glass",
    description:
      "Frameless glass mounting hardware, patch fittings, pivot connectors, and structural bottom rails for seamless glass walls.",
    imageSrc:
      "/products/FGM-Fittings-[FGM-center-alu-005]-center-aluminium.jpg",
    keySpecs: "10–12mm Toughened Glass Fit",
  },
  {
    id: "clips",
    name: "Clips",
    queryParam: "Clip",
    href: "/products?category=Clip",
    badge: "Precision Fasteners",
    tagline: "Spring Steel Snap Brackets",
    description:
      "Engineered snap clips, acoustic partition fixers, and tension locking brackets for rapid drywall installation.",
    imageSrc: "/products/clip-clip.jpg",
    keySpecs: "Spring Steel · Rapid Fasten",
  },
  {
    id: "frames-channels",
    name: "Frames & Channels",
    queryParam: "Frames & Channels",
    href: "/products?category=Frames+%26+Channels",
    badge: "Drywall & Perimeter",
    tagline: "Modular Structural Framing",
    description:
      "Perimeter tracks, box sections, and structural framing channels engineered for modular drywall partitions.",
    imageSrc:
      "/products/finshed-Inset-screens-[SA-IS-Box-frame-002]-WhatsApp-Image-2026-10-29-at-5.53.45-PM.jpeg",
    keySpecs: "Perimeter Tracks · Box Sections",
  },
  {
    id: "mesh",
    name: "Mesh",
    queryParam: "Mesh",
    href: "/products?category=Mesh",
    badge: "Screen Mesh",
    tagline: "18x16 Aperture High Tensile",
    description:
      "High-tensile SS-304 wire mesh, woven aluminium screens, and durable insect protection mesh.",
    imageSrc: "/products/workbook/mesh-ma-d-mesh-black-3-001.png",
    keySpecs: "SS-304 & High-Tensile Mesh",
  },
] as const;

export function ProductCategoryExplorer() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="shop-by-category"
      aria-labelledby="category-explorer-heading"
      className="relative bg-gradient-to-b from-[#F8FAFC] via-white to-[#F8FAFC] py-16 sm:py-20 lg:py-28 border-t border-[#E8EDF3] overflow-hidden"
    >
      {/* Architectural blueprint grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[radial-gradient(#079D9A_1px,transparent_1px)] [background-size:28px_28px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[#079D9A]/10 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#174B78]/10 blur-[100px]"
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-10 sm:space-y-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-4 border-b border-[#E8EDF3]">
          <SectionHeading
            eyebrow="Direct-Sale Products from Trichy"
            title="Shop by Category"
            description="Explore our nine core direct-sale categories supplied directly by Sai Ajantha for homes, shops, and building projects."
            titleId="category-explorer-heading"
          />

          <Link
            href="/products"
            className="group inline-flex items-center gap-2 rounded-full border border-[#079D9A]/30 bg-white px-5 py-2.5 text-xs font-bold text-[#079D9A] hover:bg-[#079D9A] hover:text-white transition-all duration-300 shadow-2xs self-start sm:self-auto uppercase tracking-wider shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079D9A] hover:scale-[1.02] active:scale-98"
          >
            <span>View Complete Catalogue</span>
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>

        {/* 9 Category Tiles Grid with Staggered Entrance */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={shouldReduceMotion ? undefined : staggerContainerVariants(0.06)}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {NINE_DIRECT_SALE_CATEGORIES_DATA.map((cat, idx) => (
            <motion.div
              key={cat.id}
              variants={shouldReduceMotion ? undefined : fadeUpVariants}
              className="h-full"
            >
              <TiltCard maxTilt={2.2} className="h-full">
                <Link
                  href={cat.href}
                  className="group relative flex flex-col justify-between h-full overflow-hidden rounded-2xl border border-[#E8EDF3] bg-white p-6 hover:border-[#079D9A]/80 hover:shadow-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#079D9A] block"
                >
                  {/* Subtle Architectural Corner Marks */}
                  <span
                    aria-hidden="true"
                    className="absolute top-2 left-2 size-2 border-t-2 border-l-2 border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors duration-200"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 size-2 border-t-2 border-r-2 border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors duration-200"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-2 size-2 border-b-2 border-l-2 border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors duration-200"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 right-2 size-2 border-b-2 border-r-2 border-[#C6CAD5]/60 group-hover:border-[#079D9A] transition-colors duration-200"
                  />

                  {/* Top Cyan/Teal Horizon Accent Line on Hover */}
                  <div
                    aria-hidden="true"
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#079D9A] via-[#24C6D0] to-[#174B78] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />

                  <div className="space-y-4">
                    {/* 1:1 Square Image Container with Architectural Blueprint Halo */}
                    <div className="product-image-container relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#F8FAFC] to-[#EDF2F7] border border-[#E8EDF3] p-4 flex items-center justify-center shadow-inner">
                      <Image
                        src={cat.imageSrc}
                        alt={cat.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain p-3.5 transition-transform duration-500 ease-out group-hover:scale-105"
                      />

                      {/* Category Pill Tag */}
                      <div className="absolute top-3 right-3 z-10">
                        <Badge
                          variant="outline"
                          className="bg-white/95 text-[10px] font-bold text-[#0B1F35] border-[#C6CAD5]/80 shadow-2xs backdrop-blur-xs tracking-wider"
                        >
                          {cat.badge}
                        </Badge>
                      </div>

                      {/* Technical Index Numeral */}
                      <div className="absolute bottom-3 left-3 z-10">
                        <span className="font-mono text-[11px] font-bold text-[#7B8896] bg-white/95 px-2 py-0.5 rounded border border-[#E8EDF3] shadow-2xs">
                          0{idx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Title, Tagline & Description */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-lg font-bold text-[#0B1F35] group-hover:text-[#079D9A] transition-colors leading-tight">
                          {cat.name}
                        </h3>
                        <ArrowUpRight className="size-4 text-[#7B8896] opacity-0 group-hover:opacity-100 group-hover:text-[#079D9A] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" />
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-[#079D9A] uppercase tracking-wider">
                        {cat.tagline}
                      </p>
                      <p className="mt-2 text-xs text-[#5D6B7B] leading-relaxed line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-6 pt-4 border-t border-[#E8EDF3] flex items-center justify-between text-xs">
                    <span className="font-medium text-[#7B8896] text-[11px] truncate max-w-[170px]">
                      {cat.keySpecs}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#079D9A] group-hover:text-[#0B1F35] transition-colors shrink-0">
                      <span>Explore Category</span>
                      <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1.5" />
                    </span>
                  </div>
                </Link>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
