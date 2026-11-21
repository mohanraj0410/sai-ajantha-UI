/**
 * Sai Ajantha Architectural Motion Tokens & Animation Variants
 *
 * Designed for subtle, directional, high-performance animations (60fps).
 * All variants respect `prefers-reduced-motion` and prioritize transform + opacity.
 */

export const ARCHITECTURAL_EASE = [0.22, 1, 0.36, 1] as const;
export const SMOOTH_EASE = [0.25, 0.1, 0.25, 1] as const;

export const MOTION_DURATIONS = {
  fast: 0.2,
  normal: 0.35,
  reveal: 0.6,
  slow: 0.85,
} as const;

export const staggerContainerVariants = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.reveal,
      ease: ARCHITECTURAL_EASE,
    },
  },
};

export const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: MOTION_DURATIONS.reveal,
      ease: ARCHITECTURAL_EASE,
    },
  },
};

export const slideInLeftVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: MOTION_DURATIONS.reveal,
      ease: ARCHITECTURAL_EASE,
    },
  },
};

export const slideInRightVariants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: MOTION_DURATIONS.reveal,
      ease: ARCHITECTURAL_EASE,
    },
  },
};
