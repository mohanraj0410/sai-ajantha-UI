"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Search,
  X,
} from "lucide-react";
import { ImageClipReveal } from "@/components/MotionPrimitives";
import { Badge } from "@/components/ui/badge";
import { SOLUTIONS, type SolutionDetail } from "@/lib/solutionsAndProjects";

const SECTOR_FILTERS: readonly ("All Divisions" | SolutionDetail["sectorMix"])[] = [
  "All Divisions",
  "Residential",
  "Commercial",
  "Technical",
] as const;

/**
 * Unique division card showcase SKUs dedicated strictly to /solutions
 * so zero images repeat from Homepage Categories, Homepage Solutions, or Projects.
 */
const SOLUTIONS_PAGE_IMAGES: Record<string, string> = {
  "residential-screens-and-door-control": `/products/${encodeURIComponent(
    "Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-100-006]-img.jpg"
  )}`,
  "commercial-interior-solutions": `/products/${encodeURIComponent(
    "Door-closer-&-Floor-spring-Floor-spring-[SA-I-FS-BOLD-90-011]-img.jpg"
  )}`,
  "acoustic-solutions": `/products/${encodeURIComponent(
    "Rubber-&PVC-[R-MA-Sponch-002]-sponch.jpg"
  )}`,
  "ceiling-and-wall-systems": `/products/${encodeURIComponent(
    "FGM-Fittings-[FGM-Mosquito-001]-mosquito-aluminium-channels.webp"
  )}`,
  "aluminium-modular-infrastructure": `/products/${encodeURIComponent(
    "Aluminium-[A-Shuter-box-12-025]-Shutter-box.jpg"
  )}`,
  "technical-interior-products": `/products/${encodeURIComponent(
    "Hardware-[RO-HW-003]-aldrop.jpg"
  )}`,
};

export function SolutionsExplorer() {
  const [selectedSector, setSelectedSector] = useState<
    "All Divisions" | SolutionDetail["sectorMix"]
  >("All Divisions");
  const [query, setQuery] = useState("");

  const filteredSolutions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SOLUTIONS.filter((sol) => {
      if (selectedSector !== "All Divisions" && sol.sectorMix !== selectedSector) {
        return false;
      }
      if (!q) return true;
      return (
        sol.title.toLowerCase().includes(q) ||
        sol.tagline.toLowerCase().includes(q) ||
        sol.summary.toLowerCase().includes(q) ||
        sol.applications.some((a) => a.toLowerCase().includes(q)) ||
        sol.relatedCategories.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [selectedSector, query]);

  return (
    <div id="divisions-grid" className="space-y-7">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-[#EAF0F6] bg-[#F3F6FA]/85 p-4 sm:p-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          {SECTOR_FILTERS.map((sector) => {
            const active = selectedSector === sector;
            const count =
              sector === "All Divisions"
                ? SOLUTIONS.length
                : SOLUTIONS.filter((s) => s.sectorMix === sector).length;

            return (
              <button
                key={sector}
                type="button"
                onClick={() => setSelectedSector(sector)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "border-transparent bg-gradient-to-r from-[#102D4D] to-[#079D9A] text-white shadow-xs"
                    : "border-[#C6CAD5] bg-white text-[#102D4D] hover:border-[#079D9A]"
                }`}
              >
                <span>{sector}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[#F3F6FA] text-[#5D6B7B]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px] sm:w-80">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#7B8896]"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by sector, application, or spec..."
            aria-label="Filter infrastructure solutions"
            className="h-10 w-full rounded-lg border border-[#C6CAD5] bg-white pl-10 pr-8 text-xs sm:text-sm text-[#102D4D] placeholder:text-[#7B8896] focus:border-[#079D9A] focus:outline-none focus:ring-2 focus:ring-[#079D9A]/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7B8896] hover:text-[#102D4D] cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Divisions Grid */}
      {filteredSolutions.length === 0 ? (
        <div className="rounded-2xl border border-[#C6CAD5] bg-[#F3F6FA] p-10 text-center space-y-3">
          <p className="font-display text-base font-bold text-[#102D4D]">
            No solution divisions matched &ldquo;{query}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedSector("All Divisions");
              setQuery("");
            }}
            className="rounded-lg bg-[#102D4D] hover:bg-[#079D9A] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
          >
            Reset Division Filters
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedSector}-${query}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredSolutions.map((sol) => {
              const cardImg = SOLUTIONS_PAGE_IMAGES[sol.slug] ?? sol.image;
              return (
                <Link
                  key={sol.slug}
                  href={`/solutions/${sol.slug}`}
                  className="group sa-border-gradient sa-card-accent-top sa-hover-lift flex flex-col justify-between rounded-2xl border border-[#C6CAD5]/85 bg-white overflow-hidden"
                >
                  <div>
                    <div
                      className="relative h-52 w-full border-b border-[#EAF0F6] overflow-hidden"
                      style={{
                        background:
                          "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #F3F6FA 70%, #EAF0F6 100%)",
                      }}
                    >
                      <ImageClipReveal>
                        <Image
                          src={cardImg}
                          alt={sol.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-contain p-7 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                        />
                      </ImageClipReveal>
                      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                        <Badge
                          variant="default"
                          className="bg-[#102D4D] text-white"
                        >
                          {sol.code} · {sol.sectorMix}
                        </Badge>
                        <span className="rounded-md bg-white/90 border border-[#EAF0F6] px-2 py-0.5 text-[10px] font-bold text-[#079D9A]">
                          {sol.relatedCategories.length} Categories
                        </span>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 space-y-3">
                      <div>
                        <h2 className="font-display text-xl font-bold text-[#102D4D] group-hover:text-[#079D9A] transition-colors">
                          {sol.title}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-[#079D9A]">
                          {sol.tagline}
                        </p>
                        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#5D6B7B]">
                          {sol.summary}
                        </p>
                      </div>

                      {/* Key Specification Highlight */}
                      {sol.specifications[0] && (
                        <div className="rounded-xl border border-[#EAF0F6] bg-[#F3F6FA]/85 p-3 text-[11px]">
                          <span className="font-bold text-[#102D4D] uppercase tracking-wider text-[10px]">
                            {sol.specifications[0].label}:{" "}
                          </span>
                          <span className="text-[#5D6B7B]">
                            {sol.specifications[0].value}
                          </span>
                        </div>
                      )}

                      <ul className="space-y-1.5 border-t border-[#EAF0F6] pt-3">
                        {sol.applications.slice(0, 3).map((app) => (
                          <li
                            key={app}
                            className="flex items-start gap-2 text-xs text-[#102D4D]"
                          >
                            <CheckCircle2 className="mt-0.5 size-3.5 text-[#079D9A] shrink-0" />
                            <span>{app}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="px-5 sm:px-6 py-3.5 bg-[#F3F6FA] border-t border-[#EAF0F6] flex items-center justify-between text-xs font-bold uppercase tracking-[0.1em] text-[#102D4D] group-hover:bg-gradient-to-r group-hover:from-[#102D4D] group-hover:to-[#174B78] group-hover:text-white transition-all">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="size-3.5 text-[#079D9A] group-hover:text-[#24C6D0]" />
                      Inspect Technical Scope
                    </span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

