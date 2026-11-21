"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  KeyRound,
  LifeBuoy,
  PhoneCall,
  Sliders,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXECUTION_PROCESS } from "@/lib/brand";
import { SectionHeading } from "./SectionHeading";

const STAGE_ICONS = [
  PhoneCall,
  ClipboardList,
  Sliders,
  FileCheck2,
  Truck,
  KeyRound,
  LifeBuoy,
] as const;

const STAGE_DELIVERABLES = [
  "Project Category & Occupancy Brief",
  "Drawing & Aperture Schedule Review",
  "IS / EN Matched System Proposal",
  "Technical Datasheets, Sample Kit & BOQ",
  "Phased Dispatch & Installation Oversight",
  "Tolerance & Door-Speed Verification Sign-Off",
  "Warranty Registration & Spare Readiness",
] as const;

export function ExecutionProcessSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const currentStage = EXECUTION_PROCESS[activeIdx];
  const progressRatio = (activeIdx + 1) / EXECUTION_PROCESS.length;

  return (
    <section
      id="process"
      aria-labelledby="process-heading"
      className="relative bg-gradient-to-b from-white via-[#F9FBFD] to-[#F3F6FA] py-8 sm:py-10 lg:py-11 border-t border-[#E8EDF3]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Start-to-Finish Accountability"
            title="Seven-Stage Project Execution Process"
            description="We make ordering simple for homeowners, fabricators, and builders through direct pricing, verified stock, fast local delivery, and reliable customer support."
            titleId="process-heading"
          />

          <span className="self-start lg:self-auto rounded-lg border border-[#C6CAD5] bg-white px-3.5 py-2 text-xs font-bold text-[#102D4D] shadow-xs">
            Stage {currentStage.step} of 0{EXECUTION_PROCESS.length}
          </span>
        </div>

        {/* Desktop Horizontal Timeline / Mobile Vertical Timeline */}
        <div className="relative">
          {/* Background Static Rail + Animated Active Fill */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-6 left-6 right-6 h-[2px] rounded-full bg-[#C6CAD5]/70 overflow-hidden"
          >
            <div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[#174B78] via-[#079D9A] to-[#24C6D0] transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${progressRatio})` }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-7 lg:gap-3">
            {EXECUTION_PROCESS.map((stage, idx) => {
              const Icon = STAGE_ICONS[idx] ?? PhoneCall;
              const isSelected = idx === activeIdx;
              const isCompletedOrActive = idx <= activeIdx;

              return (
                <motion.div
                  key={stage.step}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: idx * 0.04 }}
                  className="group relative flex lg:flex-col items-start gap-4 lg:gap-0 pl-8 lg:pl-0 border-l-2 lg:border-l-0 border-[#079D9A]/45 pb-3.5 lg:pb-0 last:pb-0"
                >
                  {/* Interactive Step Node */}
                  <button
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    aria-label={`Inspect Stage ${stage.step}: ${stage.title}`}
                    aria-pressed={isSelected}
                    className={`absolute -left-[21px] top-0 lg:static lg:mb-4 flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border-2 font-display text-xs font-extrabold transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "border-[#24C6D0] bg-gradient-to-br from-[#102D4D] to-[#174B78] text-[#24C6D0] shadow-md scale-105"
                        : isCompletedOrActive
                          ? "border-[#079D9A] bg-[#E5F7F6] text-[#102D4D]"
                          : "border-[#C6CAD5] bg-white text-[#102D4D] hover:border-[#079D9A]"
                    }`}
                  >
                    <span className="text-[11px]">{stage.step}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`sa-card-accent-top flex-1 w-full overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "border-[#079D9A] bg-white shadow-lg ring-2 ring-[#24C6D0]/20"
                        : "border-[#C6CAD5]/80 bg-white/95 sa-hover-lift hover:border-[#079D9A]"
                    }`}
                  >
                    <div
                      className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-[#102D4D] text-[#24C6D0]"
                          : "bg-[#079D9A]/10 text-[#079D9A] group-hover:bg-[#102D4D] group-hover:text-[#24C6D0]"
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#102D4D] leading-snug group-hover:text-[#079D9A] transition-colors">
                      {stage.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#5D6B7B]">
                      {stage.detail}
                    </p>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Active Stage Deliverable Bar */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage.step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="sa-dark-radial-panel rounded-2xl border border-[#174B78] px-5 py-4 sm:px-7 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                <span>Stage {currentStage.step} Deliverable</span>
                <span className="text-white/30">·</span>
                <span>{currentStage.title}</span>
              </div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="size-4 text-[#24C6D0] shrink-0" />
                <span>{STAGE_DELIVERABLES[activeIdx]}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
                className="border-white/25 bg-white/10 text-white hover:bg-white hover:text-[#102D4D] disabled:opacity-40"
              >
                <ArrowLeft className="size-3.5" />
                <span>Prev</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={activeIdx === EXECUTION_PROCESS.length - 1}
                onClick={() =>
                  setActiveIdx((prev) =>
                    Math.min(EXECUTION_PROCESS.length - 1, prev + 1)
                  )
                }
                className="border-white/25 bg-white/10 text-white hover:bg-white hover:text-[#102D4D] disabled:opacity-40"
              >
                <span>Next</span>
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                asChild
                size="sm"
                className="sa-btn-gradient border-0 text-white"
              >
                <Link href="/contact">
                  <span>Start Stage 01</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
