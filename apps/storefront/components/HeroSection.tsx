"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Layers,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { BRAND_CONTACT } from "@/lib/brand";
import { holdScrollBelow, requestSmoothScrollTo } from "@/lib/scrollController";

const ROW_COUNT = 3;
const COLUMN_COUNT = 6;
const SQUARE_CELL_SIZE = `max(calc(100cqw / ${COLUMN_COUNT}), calc(100cqh / ${ROW_COUNT}))`;
const HERO_RUNWAY_CLASS = "h-[140vh]";
const TRIGGER_FORWARD_PX = 24;
const TRIGGER_REVERSE_PX = 10;
const HERO_TRANSITION_HOLD_MS = 900;

const EASE_OUT_EXPO = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN_OUT_QUART = "cubic-bezier(0.76, 0, 0.24, 1)";

type ScaleAxis = "x" | "y";
type OriginEdge = "left" | "right" | "top" | "bottom";

export interface GridRange {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export function transparentRange(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): GridRange {
  return { fromRow, fromCol, toRow, toCol };
}

const TRANSPARENT_RANGES: GridRange[] = [
  transparentRange(0, 3, 1, 3),
  transparentRange(0, 5, 1, 5),
  transparentRange(1, 2, 1, 5),
  transparentRange(2, 3, 2, 5),
];

const SCROLLED_TRANSPARENT_RANGES: GridRange[] = [
  transparentRange(0, 2, 0, 2),
  transparentRange(0, 4, 1, 5),
  transparentRange(1, 0, 2, 4),
];

export function isGridCellTransparent(
  rowIndex: number,
  colIndex: number,
  ranges: readonly GridRange[] = TRANSPARENT_RANGES
): boolean {
  const activeRanges = Array.isArray(ranges) ? ranges : TRANSPARENT_RANGES;
  return activeRanges.some(({ fromRow, fromCol, toRow, toCol }) => {
    const minRow = Math.min(fromRow, toRow);
    const maxRow = Math.max(fromRow, toRow);
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    return (
      rowIndex >= minRow &&
      rowIndex <= maxRow &&
      colIndex >= minCol &&
      colIndex <= maxCol
    );
  });
}

function getCellTransition(
  rowIndex: number,
  colIndex: number,
  isTransitioned: boolean
): { axis: ScaleAxis; origin: OriginEdge; delayMs: number } {
  const axis: ScaleAxis = (rowIndex + colIndex) % 2 === 0 ? "y" : "x";
  const origin: OriginEdge =
    axis === "y"
      ? rowIndex === 0
        ? "top"
        : "bottom"
      : colIndex < 3
        ? "left"
        : "right";

  const bucket = (rowIndex * 2 + colIndex) % 5;
  const forwardDelayMs =
    colIndex === 0 ? Math.max(220, 60 + bucket * 45) : 60 + bucket * 45;
  const reverseDelayMs = colIndex === 0 ? 40 : 100 + (4 - bucket) * 40;

  return {
    axis,
    origin,
    delayMs: isTransitioned ? forwardDelayMs : reverseDelayMs,
  };
}

const BEAT2_PILLARS = [
  {
    step: "01",
    label: "Specification Precision",
    title: "Drawing Review & BOQ Clarity",
    detail:
      "Matched 6063-T5 extrusions, acoustic perimeter seals, and BS EN 1154 door controls validated before procurement.",
    icon: CheckCircle2,
  },
  {
    step: "02",
    label: "Single-Point Execution",
    title: "Direct Supply & Project Support",
    detail:
      "Phased material supply from Trichy paired with local support across homes, shops, and building sites.",
    icon: Wrench,
  },
  {
    step: "03",
    label: "Lifecycle Backing",
    title: "Warranty & After-Sales Support",
    detail:
      "Documented replacement coverage and responsive technical assistance long after project handover.",
    icon: ShieldCheck,
  },
] as const;

export function HeroSection() {
  const runwayRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionedRef = useRef(false);
  const [isTransitioned, setIsTransitioned] = useState(false);
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (runwayRef.current) {
      observer.observe(runwayRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const runway = runwayRef.current;
    const stage = stageRef.current;
    if (!runway || !stage) return;

    let rafId = 0;

    const evaluateScroll = () => {
      const runwayRect = runway.getBoundingClientRect();
      const stageHeight = stage.getBoundingClientRect().height || window.innerHeight;
      const holdDistance = Math.max(0, runwayRect.height - stageHeight);
      const scrolledPastTop = -runwayRect.top;

      let nextTransitioned = transitionedRef.current;
      if (!transitionedRef.current && scrolledPastTop >= TRIGGER_FORWARD_PX) {
        nextTransitioned = true;
      } else if (transitionedRef.current && scrolledPastTop <= TRIGGER_REVERSE_PX) {
        nextTransitioned = false;
      }

      if (nextTransitioned !== transitionedRef.current) {
        if (nextTransitioned && holdDistance > 0) {
          const runwayDocTop = runwayRect.top + window.scrollY;
          const holdCapOffset = Math.min(
            holdDistance * 0.85,
            Math.max(Math.min(holdDistance * 0.45, 220), scrolledPastTop)
          );
          const maxHoldY = runwayDocTop + holdCapOffset;
          if (window.scrollY <= runwayDocTop + holdDistance * 0.85) {
            holdScrollBelow(maxHoldY, HERO_TRANSITION_HOLD_MS);
          }
        }
        transitionedRef.current = nextTransitioned;
        setIsTransitioned(nextTransitioned);
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        evaluateScroll();
      });
    };

    evaluateScroll();

    const observer = new ResizeObserver(evaluateScroll);
    observer.observe(stage);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setPointerOffset({ x: nx * 12, y: ny * 10 });
  };

  const jumpToBeat = (beat: 1 | 2) => {
    const runway = runwayRef.current;
    if (!runway) return;
    const docTop = runway.getBoundingClientRect().top + window.scrollY;
    if (beat === 1) {
      requestSmoothScrollTo(docTop);
    } else {
      requestSmoothScrollTo(docTop + TRIGGER_FORWARD_PX + 28);
    }
  };

  const bgTransition = `transform 860ms ${EASE_OUT_EXPO} ${isTransitioned ? 60 : 140}ms`;
  const videoTransition = `clip-path 860ms ${EASE_OUT_EXPO} ${isTransitioned ? 60 : 140}ms, transform 860ms ${EASE_OUT_EXPO} ${isTransitioned ? 60 : 140}ms`;
  const scrimTransition = `opacity 720ms ${EASE_OUT_EXPO} ${isTransitioned ? 160 : 0}ms`;
  const bottomLeftTransition = isTransitioned
    ? `opacity 460ms ${EASE_OUT_EXPO} 0ms, transform 560ms ${EASE_OUT_EXPO} 0ms`
    : `opacity 580ms ${EASE_OUT_EXPO} 300ms, transform 660ms ${EASE_OUT_EXPO} 300ms`;

  const makeBeat2LineTransition = (forwardDelay: number, reverseDelay: number) =>
    isTransitioned
      ? `opacity 640ms ${EASE_OUT_EXPO} ${forwardDelay}ms, transform 740ms ${EASE_OUT_EXPO} ${forwardDelay}ms`
      : `opacity 380ms ${EASE_OUT_EXPO} ${reverseDelay}ms, transform 440ms ${EASE_OUT_EXPO} ${reverseDelay}ms`;

  return (
    <section
      ref={runwayRef}
      aria-label="Sai Ajantha Interior Solutions Hero"
      className={`relative ${HERO_RUNWAY_CLASS} overflow-x-clip bg-[#0B1F35] text-white`}
    >
      <div
        ref={stageRef}
        onPointerMove={handlePointerMove}
        className="sticky top-0 flex h-[100dvh] min-h-[600px] w-full flex-col justify-between overflow-hidden"
      >
        {/* Full-Bleed Architectural Hero Background Image (/hero-architecture.webp prioritized with .png fallback) */}
        <div
          aria-hidden="true"
          style={{
            backgroundImage: "image-set(url('/hero-architecture.webp') type('image/webp'), url('/hero-architecture.png') type('image/png'))",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            transform: isTransitioned ? "scale(1.05)" : "scale(1)",
            transition: bgTransition,
          }}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full will-change-transform motion-reduce:transition-none motion-reduce:transform-none"
        />

        {/* Stepped Architectural Video Showcase Layer (/sample.mp4 preserved) */}
        <div
          aria-hidden="true"
          style={{
            clipPath: isTransitioned
              ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"
              : "polygon(56% 0%, 100% 0%, 100% 100%, 56% 100%, 56% 68%, 46% 68%, 46% 34%, 56% 34%)",
            transition: videoTransition,
          }}
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden motion-reduce:transition-none"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/hero-architecture.webp"
            aria-hidden="true"
            style={{
              transform: `translate3d(${isTransitioned ? 0 : 12}%, 0, 0)`,
              transition: videoTransition,
            }}
            className="h-full w-full object-cover object-center opacity-90 will-change-transform motion-reduce:transition-none"
          >
            <source src="/sample.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Beat 1 Dark Navy Gradient Scrims for Crisp Readability */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            background:
              "linear-gradient(100deg, rgba(11, 31, 53, 0.72) 0%, rgba(16, 45, 77, 0.35) 55%, rgba(11, 31, 53, 0.25) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[4]"
          style={{
            background:
              "linear-gradient(to top, rgba(11, 31, 53, 0.88) 0%, rgba(11, 31, 53, 0.24) 45%, rgba(11, 31, 53, 0.35) 100%)",
          }}
        />

        {/* Beat 2 Layered Architectural Scrim + Cyan Radial Lighting */}
        <div
          aria-hidden="true"
          style={{
            opacity: isTransitioned ? 1 : 0,
            transition: scrimTransition,
            background:
              "radial-gradient(circle at 72% 38%, rgba(36, 198, 208, 0.2) 0%, transparent 52%), linear-gradient(110deg, rgba(11, 31, 53, 0.9) 0%, rgba(16, 45, 77, 0.72) 52%, rgba(11, 31, 53, 0.86) 100%)",
          }}
          className="pointer-events-none absolute inset-0 z-[5] backdrop-blur-[3px] motion-reduce:transition-none"
        />

        {/* Subtle Architectural Grid Hairlines Overlay */}
        <div
          aria-hidden="true"
          style={{ containerType: "size" }}
          className="pointer-events-none absolute inset-0 z-10 flex h-full w-full overflow-hidden"
        >
          {Array.from({ length: COLUMN_COUNT }, (_, colIndex) => (
            <div key={colIndex} className="flex shrink-0 flex-col">
              {Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
                const startsTransparent = isGridCellTransparent(
                  rowIndex,
                  colIndex,
                  TRANSPARENT_RANGES
                );
                const endsTransparent = isGridCellTransparent(
                  rowIndex,
                  colIndex,
                  SCROLLED_TRANSPARENT_RANGES
                );
                const { axis, origin, delayMs } = getCellTransition(
                  rowIndex,
                  colIndex,
                  isTransitioned
                );

                const isTransparent = isTransitioned
                  ? endsTransparent
                  : startsTransparent;
                const fillScale = isTransparent ? 0 : 1;
                const fillTransform =
                  axis === "x"
                    ? `scale3d(${fillScale}, 1, 1)`
                    : `scale3d(1, ${fillScale}, 1)`;

                return (
                  <div
                    key={rowIndex}
                    style={{
                      width: SQUARE_CELL_SIZE,
                      height: SQUARE_CELL_SIZE,
                    }}
                    className="relative border border-white/[0.06]"
                  >
                    <div
                      style={{
                        transform: fillTransform,
                        transformOrigin: origin,
                        transition: `transform 680ms ${EASE_IN_OUT_QUART} ${delayMs}ms`,
                      }}
                      className="absolute top-0 left-0 h-[calc(100%+2px)] w-[calc(100%+2px)] border border-white/[0.08] bg-transparent will-change-transform motion-reduce:transition-none"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Layer 3: Editorial Content + Beat 1 / Beat 2 Showcase */}
        <div className="pointer-events-none relative z-20 mx-auto flex-1 w-full max-w-[1440px] px-4 sm:px-8 lg:px-12">
          {/* Beat 1: Primary Brand Statement & 3 CTAs */}
          <div
            style={{
              opacity: isTransitioned ? 0 : 1,
              transform: `translate3d(0, ${isTransitioned ? -44 : 0}px, 0)`,
              transition: bottomLeftTransition,
            }}
            aria-hidden={isTransitioned}
            className={`${
              isTransitioned ? "pointer-events-none" : "pointer-events-auto"
            } absolute bottom-6 left-4 right-4 max-w-2xl will-change-transform motion-reduce:transition-none sm:bottom-8 sm:left-8 lg:bottom-10 lg:left-12`}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#24C6D0]/45 bg-[#102D4D]/80 backdrop-blur-md px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#E5F7F6] shadow-xs">
              <span
                className="h-2 w-2 rounded-full bg-gradient-to-r from-[#079D9A] to-[#24C6D0]"
                aria-hidden="true"
              />
              <span>
                Screens, Aluminium, Ladders, Hardware &amp; Interior Products
              </span>
            </div>

            <h1 className="mt-3.5 type-hero-display text-white drop-shadow-sm">
              Quality Without{" "}
              <span className="sa-gradient-text-animated">Compromise.</span>
            </h1>

            <p className="mt-3.5 max-w-xl text-xs font-medium leading-relaxed text-[#EAF0F6] sm:text-sm bg-[#0B1F35]/60 backdrop-blur-xs sm:bg-transparent sm:backdrop-blur-none rounded-lg p-2.5 sm:p-0">
              From product selection to reliable delivery, we provide dependable
              screens, aluminium, hardware, and interior products built around quality
              and long-term value.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link
                href="/solutions"
                tabIndex={isTransitioned ? -1 : 0}
                className="sa-btn-gradient inline-flex items-center gap-2 rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-white"
              >
                <span>Explore Our Solutions</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/products"
                tabIndex={isTransitioned ? -1 : 0}
                className="inline-flex items-center gap-2 rounded-lg border border-[#24C6D0]/55 bg-[#102D4D]/80 backdrop-blur-md hover:border-[#24C6D0] hover:bg-[#174B78] px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors shadow-sm"
              >
                <span>Explore Products</span>
              </Link>
              <Link
                href="/contact"
                tabIndex={isTransitioned ? -1 : 0}
                className="inline-flex items-center gap-2 rounded-lg border border-white/65 bg-white hover:bg-[#EAF0F6] px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-[#102D4D] transition-colors shadow-sm"
              >
                <span>Discuss Your Project</span>
              </Link>
            </div>
          </div>

          {/* Floating Technical Spec Cards (3D Depth Parallax on Desktop Beat 1) */}
          <div
            style={{
              opacity: isTransitioned ? 0 : 1,
              transform: `translate3d(${pointerOffset.x}px, ${
                isTransitioned ? -30 : pointerOffset.y
              }px, 0)`,
              transition: bottomLeftTransition,
            }}
            aria-hidden="true"
            className="hidden xl:flex flex-col gap-3.5 absolute right-12 top-28 w-76 will-change-transform motion-reduce:transform-none"
          >
            <div className="sa-glass-dark sa-border-gradient rounded-2xl border border-white/20 p-4 text-white">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                <span>Division 01</span>
                <span>Trichy · Est. 1994</span>
              </div>
              <p className="mt-1.5 font-display text-sm font-bold text-white">
                Architectural Hardware &amp; Screens
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#C6CAD5]">
                Hydraulic door closers, insect screens, extruded aluminium profiles, and modular kitchen baskets.
              </p>
            </div>

            <div className="sa-glass-dark sa-border-gradient rounded-2xl border border-[#24C6D0]/35 p-4 text-white translate-x-4">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[#C6CAD5]">
                <span>Technical Spec</span>
                <span className="text-[#24C6D0]">6063-T5 · EN 1154</span>
              </div>
              <p className="mt-1.5 font-display text-sm font-bold">
                281+ System SKUs Ready
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#C6CAD5]">
                Multi-track extrusions, FGM connectors, SS-304 hardware &amp;
                EPDM seals.
              </p>
            </div>
          </div>

          {/* Beat 2: Scroll-Triggered Architectural Promise (Full 12-Col Balanced Stage) */}
          <div
            aria-hidden={!isTransitioned}
            className={`${
              isTransitioned ? "pointer-events-auto" : "pointer-events-none"
            } absolute inset-x-4 sm:inset-x-8 lg:inset-x-12 top-20 bottom-14 flex items-center`}
          >
            <div className="grid w-full grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-12">
              {/* Beat 2 Left Column: Three Staggered Execution Guarantee Cards */}
              <div
                style={{
                  transform: `translate3d(${pointerOffset.x * 0.4}px, ${
                    pointerOffset.y * 0.4
                  }px, 0)`,
                }}
                className="hidden lg:flex lg:col-span-5 flex-col gap-3.5 will-change-transform motion-reduce:transform-none"
              >
                {BEAT2_PILLARS.map((pillar, idx) => {
                  const Icon = pillar.icon;
                  return (
                    <div
                      key={pillar.step}
                      style={{
                        opacity: isTransitioned ? 1 : 0,
                        transform: `translate3d(${isTransitioned ? 0 : -24}px, ${
                          isTransitioned ? 0 : 18
                        }px, 0)`,
                        transition: makeBeat2LineTransition(
                          240 + idx * 90,
                          (2 - idx) * 40
                        ),
                      }}
                      className={`sa-glass-dark sa-border-gradient rounded-2xl border border-white/20 p-4 sm:p-5 will-change-transform motion-reduce:transition-none ${
                        idx === 1 ? "lg:translate-x-5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#24C6D0]/40 bg-[#0B1F35]/80 text-[#24C6D0]">
                          <Icon className="size-4.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#24C6D0]">
                            <span>{pillar.step}</span>
                            <span className="text-white/30">·</span>
                            <span>{pillar.label}</span>
                          </div>
                          <h3 className="mt-1 font-display text-sm sm:text-base font-bold text-white">
                            {pillar.title}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#C6CAD5]">
                            {pillar.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Beat 2 Right Column: Architectural Promise Statement & Conversion Actions */}
              <div className="lg:col-span-7 lg:pl-4 space-y-5">
                <div
                  style={{
                    opacity: isTransitioned ? 1 : 0,
                    transform: `translate3d(0, ${isTransitioned ? 0 : 20}px, 0)`,
                    transition: makeBeat2LineTransition(220, 40),
                  }}
                  className="inline-flex items-center gap-2.5 rounded-full border border-[#24C6D0]/45 bg-[#0B1F35]/75 px-3.5 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[#E5F7F6] backdrop-blur-md shadow-xs will-change-transform motion-reduce:transition-none"
                >
                  <span
                    className="h-2 w-2 rounded-full bg-gradient-to-r from-[#079D9A] to-[#24C6D0]"
                    aria-hidden="true"
                  />
                  <span>Quality · Expertise · Reliability</span>
                </div>

                <h2 className="font-display text-[30px] sm:text-[42px] lg:text-[52px] font-extrabold leading-[1.06] tracking-[-0.028em] text-white">
                  <span
                    style={{
                      opacity: isTransitioned ? 1 : 0,
                      transform: `translate3d(0, ${isTransitioned ? 0 : 26}px, 0)`,
                      transition: makeBeat2LineTransition(300, 30),
                    }}
                    className="block will-change-transform motion-reduce:transition-none"
                  >
                    Infrastructure that performs,
                  </span>
                  <span
                    style={{
                      opacity: isTransitioned ? 1 : 0,
                      transform: `translate3d(0, ${isTransitioned ? 0 : 34}px, 0)`,
                      transition: makeBeat2LineTransition(390, 0),
                    }}
                    className="mt-1 block will-change-transform motion-reduce:transition-none"
                  >
                    lasts, and{" "}
                    <span className="sa-gradient-text-animated">
                      earns trust.
                    </span>
                  </span>
                </h2>

                {/* Animated Gradient Accent Underline */}
                <div
                  aria-hidden="true"
                  style={{
                    transform: `scaleX(${isTransitioned ? 1 : 0})`,
                    transition: makeBeat2LineTransition(440, 0),
                  }}
                  className="h-[3px] w-32 origin-left rounded-full bg-gradient-to-r from-[#24C6D0] via-[#079D9A] to-transparent motion-reduce:transition-none"
                />

                <div
                  style={{
                    opacity: isTransitioned ? 1 : 0,
                    transform: `translate3d(0, ${isTransitioned ? 0 : 28}px, 0)`,
                    transition: makeBeat2LineTransition(480, 0),
                  }}
                  className="space-y-4 will-change-transform motion-reduce:transition-none"
                >
                  <p className="max-w-xl text-xs sm:text-sm lg:text-[15px] font-normal leading-relaxed text-[#EAF0F6]">
                    Quality interior products and building materials backed
                    by verified specifications, transparent pricing, phased
                    delivery, and dependable customer support from our Trichy desk.
                  </p>

                  {/* Compact Verified Spec Strip */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#C6CAD5]">
                    <span className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      Home &amp; Commercial Interiors
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      Acoustic &amp; Partition Hardware
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      6063-T5 &amp; EN-1154 Systems
                    </span>
                  </div>

                  {/* Mobile Compact Highlights inside Beat 2 */}
                  <div className="grid grid-cols-3 gap-2 lg:hidden pt-1">
                    {BEAT2_PILLARS.map((pillar) => (
                      <div
                        key={pillar.step}
                        className="rounded-xl border border-white/15 bg-[#0B1F35]/75 p-2.5"
                      >
                        <span className="text-[10px] font-bold text-[#24C6D0]">
                          {pillar.step}
                        </span>
                        <p className="mt-0.5 text-[11px] font-semibold leading-tight text-white">
                          {pillar.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <Link
                      href="/contact"
                      tabIndex={isTransitioned ? 0 : -1}
                      className="sa-btn-gradient inline-flex items-center gap-2 rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-white"
                    >
                      <span>Request Consultation</span>
                      <ArrowRight className="size-3.5" />
                    </Link>

                    <Link
                      href="/products"
                      tabIndex={isTransitioned ? 0 : -1}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 backdrop-blur-md hover:bg-white hover:text-[#102D4D] px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-white transition-colors"
                    >
                      <Layers className="size-3.5" />
                      <span>Browse System SKUs</span>
                    </Link>

                    <a
                      href={BRAND_CONTACT.phoneHref}
                      tabIndex={isTransitioned ? 0 : -1}
                      className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-[#24C6D0]/40 bg-[#0B1F35]/75 px-4 py-3 text-xs font-semibold text-[#E5F7F6] hover:border-[#24C6D0] hover:text-white transition-colors"
                    >
                      <Phone className="size-3.5 text-[#24C6D0]" />
                      <span>{BRAND_CONTACT.phone}</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Beat Switcher & Scroll Indicator */}
        <div className="pointer-events-auto relative z-30 mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-12 pb-4 flex items-center justify-between text-[11px]">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-[#0B1F35]/80 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => jumpToBeat(1)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                !isTransitioned
                  ? "bg-gradient-to-r from-[#079D9A] to-[#24C6D0] text-[#0B1F35]"
                  : "text-[#C6CAD5] hover:text-white"
              }`}
            >
              01 Overview
            </button>
            <button
              type="button"
              onClick={() => jumpToBeat(2)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                isTransitioned
                  ? "bg-gradient-to-r from-[#079D9A] to-[#24C6D0] text-[#0B1F35]"
                  : "text-[#C6CAD5] hover:text-white"
              }`}
            >
              02 Promise
            </button>
          </div>

          <a
            href="#highlights"
            aria-label="Scroll to company highlights"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0B1F35]/75 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E5F7F6] backdrop-blur-md hover:border-[#24C6D0] hover:text-[#24C6D0] transition-colors"
          >
            <span>Explore Capabilities</span>
            <ChevronDown className="size-3.5 text-[#24C6D0]" />
          </a>
        </div>
      </div>
    </section>
  );
}
