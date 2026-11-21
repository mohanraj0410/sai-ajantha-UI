"use client";

import { useEffect } from "react";
import {
  getActiveScrollCeiling,
  releaseScrollHold,
  SMOOTH_SCROLL_EVENT,
} from "@/lib/scrollController";

// Higher damping = tighter, crisp inertia; lower = floatier Lenis-style glide
const WHEEL_DAMPING = 7.0;
const STOP_THRESHOLD_PX = 0.35;
const SCROLL_PADDING_PX = 96;

function normalizeWheelDeltaY(event: WheelEvent): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function hasScrollableAncestor(target: EventTarget | null, deltaY: number): boolean {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const isScrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1;

    if (isScrollable) {
      const canScrollDown =
        deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      const canScrollUp = deltaY < 0 && node.scrollTop > 1;
      if (canScrollDown || canScrollUp) return true;
    }

    node = node.parentElement;
  }

  return false;
}

/**
 * Provides frame-rate-independent smooth inertia wheel scrolling and eases
 * same-page `#anchor` navigation across the application.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    if (reducedMotionQuery.matches || coarsePointerQuery.matches) {
      return;
    }

    let currentY = window.scrollY;
    let targetY = window.scrollY;
    let rafId = 0;
    let lastTimestamp = 0;
    let isWritingScroll = false;

    const getMaxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const stopLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastTimestamp = 0;
    };

    const tick = (timestamp: number) => {
      const dt = lastTimestamp
        ? Math.min(0.05, Math.max(0.001, (timestamp - lastTimestamp) / 1000))
        : 1 / 60;
      lastTimestamp = timestamp;

      const ceiling = getActiveScrollCeiling(timestamp);
      const effectiveTarget =
        ceiling !== null ? Math.min(targetY, ceiling) : targetY;
      targetY = Math.min(getMaxScroll(), Math.max(0, effectiveTarget));

      const factor = 1 - Math.exp(-WHEEL_DAMPING * dt);
      currentY += (targetY - currentY) * factor;

      if (Math.abs(targetY - currentY) <= STOP_THRESHOLD_PX) {
        currentY = targetY;
        isWritingScroll = true;
        window.scrollTo({ top: currentY, behavior: "instant" });
        isWritingScroll = false;
        stopLoop();
        return;
      }

      isWritingScroll = true;
      window.scrollTo({ top: currentY, behavior: "instant" });
      isWritingScroll = false;
      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!rafId) {
        lastTimestamp = 0;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const deltaY = normalizeWheelDeltaY(event);
      if (Math.abs(deltaY) < 0.01) return;
      if (hasScrollableAncestor(event.target, deltaY)) return;

      event.preventDefault();

      // Re-sync if an external scrollbar drag occurred prior to wheel input
      if (!rafId) {
        currentY = window.scrollY;
        targetY = window.scrollY;
      }

      const ceiling = deltaY > 0 ? getActiveScrollCeiling() : null;
      const maxAllowed = ceiling !== null ? Math.min(getMaxScroll(), ceiling) : getMaxScroll();

      targetY = Math.min(maxAllowed, Math.max(0, targetY + deltaY));
      startLoop();
    };

    const onScroll = () => {
      if (isWritingScroll) return;
      if (!rafId) {
        currentY = window.scrollY;
        targetY = window.scrollY;
      }
    };

    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.includes("#")) return;

      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname !== window.location.pathname || !url.hash) return;

      const targetEl = document.getElementById(url.hash.slice(1));
      if (!targetEl) return;

      event.preventDefault();
      releaseScrollHold();

      const nextTop =
        targetEl.getBoundingClientRect().top + window.scrollY - SCROLL_PADDING_PX;
      currentY = window.scrollY;
      targetY = Math.min(getMaxScroll(), Math.max(0, nextTop));
      window.history.pushState(null, "", url.hash);
      startLoop();
    };

    const onPointerDown = (event: PointerEvent) => {
      // Stop inertia loop immediately if the user grabs the browser scrollbar
      if (event.clientX >= document.documentElement.clientWidth) {
        stopLoop();
        currentY = window.scrollY;
        targetY = window.scrollY;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        stopLoop();
        currentY = window.scrollY;
        targetY = window.scrollY;
      }
    };

    const onResize = () => {
      const maxScroll = getMaxScroll();
      currentY = Math.min(currentY, maxScroll);
      targetY = Math.min(targetY, maxScroll);
    };

    const onCustomScrollTo = (event: Event) => {
      const customEvent = event as CustomEvent<{ top?: number }>;
      const nextTop = customEvent.detail?.top;
      if (typeof nextTop !== "number") return;
      currentY = window.scrollY;
      targetY = Math.min(getMaxScroll(), Math.max(0, nextTop));
      startLoop();
    };

    // Globally suppress native HTML5 browser validation tooltip bubbles
    const onInvalid = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onAnchorClick);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener(SMOOTH_SCROLL_EVENT, onCustomScrollTo);
    window.addEventListener("invalid", onInvalid, true);

    return () => {
      stopLoop();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onAnchorClick);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(SMOOTH_SCROLL_EVENT, onCustomScrollTo);
      window.removeEventListener("invalid", onInvalid, true);
    };
  }, []);

  return null;
}
