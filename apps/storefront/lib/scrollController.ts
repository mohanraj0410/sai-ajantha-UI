/**
 * Lightweight shared coordinator between scroll-triggered sections (such as
 * `HeroSection`) and the page-wide `SmoothScroll` inertia controller.
 */

interface ScrollHoldState {
  maxY: number;
  untilTimestamp: number;
}

let activeHold: ScrollHoldState | null = null;

/**
 * Temporarily caps downward inertia scroll at `maxY` until `durationMs`
 * elapses so triggered hero transitions finish cleanly before leaving stage.
 */
export function holdScrollBelow(maxY: number, durationMs: number): void {
  const safeMaxY = Math.max(0, maxY);
  const untilTimestamp = performance.now() + Math.max(0, durationMs);
  activeHold = { maxY: safeMaxY, untilTimestamp };
}

/** Releases any active scroll hold immediately (e.g. for navbar anchor jumps). */
export function releaseScrollHold(): void {
  activeHold = null;
}

/** Returns the active downward scroll ceiling if the hold has not expired. */
export function getActiveScrollCeiling(now: number = performance.now()): number | null {
  if (!activeHold) return null;
  if (now >= activeHold.untilTimestamp) {
    activeHold = null;
    return null;
  }
  return activeHold.maxY;
}

export const SMOOTH_SCROLL_EVENT = "sa:smooth-scroll-to";

/** Requests `SmoothScroll` (or native smooth fallback) to glide to `top` px. */
export function requestSmoothScrollTo(top: number): void {
  if (typeof window === "undefined") return;
  const clampedTop = Math.max(0, top);
  releaseScrollHold();

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (prefersReduced || coarsePointer) {
    window.scrollTo({
      top: clampedTop,
      behavior: prefersReduced ? "auto" : "smooth",
    });
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ top: number }>(SMOOTH_SCROLL_EVENT, {
      detail: { top: clampedTop },
    })
  );
}
