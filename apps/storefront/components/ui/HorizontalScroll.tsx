"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  fadeClassName?: string;
  scrollAmount?: number;
  showArrows?: boolean;
  fadeEdges?: boolean;
}

export function HorizontalScroll({
  children,
  className,
  containerClassName,
  fadeClassName,
  scrollAmount = 260,
  showArrows = true,
  fadeEdges = true,
}: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag-to-scroll state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    // Check multiple intervals to account for fonts, images, or async children rendering
    const raf = requestAnimationFrame(() => checkScroll());
    const timer1 = setTimeout(() => checkScroll(), 80);
    const timer2 = setTimeout(() => checkScroll(), 300);

    const resizeObserver = new ResizeObserver(() => checkScroll());
    resizeObserver.observe(el);
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild);
    }

    const mutationObserver = new MutationObserver(() => checkScroll());
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });

    const onScroll = () => checkScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, children]);

  // Translate vertical wheel scroll to horizontal scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  // Mouse Drag-to-Scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
    checkScroll();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const scrollBy = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -scrollAmount : scrollAmount;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className={cn("relative group/hscroll flex items-center w-full min-w-0", containerClassName)}>
      {/* Left Chevron Button */}
      {showArrows && canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy("left")}
          aria-label="Scroll category list left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex size-7 sm:size-8 items-center justify-center rounded-full border border-[#C6CAD5] bg-white text-[#102D4D] shadow-md hover:shadow-lg transition-all hover:bg-[#102D4D] hover:text-white hover:border-[#102D4D] hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <ChevronLeft className="size-4 sm:size-4.5" />
        </button>
      )}

      {/* Left Fade Edge */}
      {fadeEdges && canScrollLeft && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-9 sm:w-12 bg-gradient-to-r from-white via-white/80 to-transparent",
            fadeClassName && `bg-gradient-to-r ${fadeClassName} to-transparent`
          )}
        />
      )}

      {/* Main Scrollable Track (Zero Visible Scrollbar, Pure Left/Right Arrow Navigation) */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={cn(
          "flex w-full items-center overflow-x-auto scroll-smooth select-none no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:!hidden [&::-webkit-scrollbar]:!w-0 [&::-webkit-scrollbar]:!h-0",
          className
        )}
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {children}
      </div>

      {/* Right Fade Edge */}
      {fadeEdges && canScrollRight && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-9 sm:w-12 bg-gradient-to-l from-white via-white/80 to-transparent",
            fadeClassName && `bg-gradient-to-l ${fadeClassName} to-transparent`
          )}
        />
      )}

      {/* Right Chevron Button */}
      {showArrows && canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy("right")}
          aria-label="Scroll category list right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex size-7 sm:size-8 items-center justify-center rounded-full border border-[#C6CAD5] bg-white text-[#102D4D] shadow-md hover:shadow-lg transition-all hover:bg-[#102D4D] hover:text-white hover:border-[#102D4D] hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <ChevronRight className="size-4 sm:size-4.5" />
        </button>
      )}
    </div>
  );
}
