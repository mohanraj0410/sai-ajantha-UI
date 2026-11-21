"use client";

import * as React from "react";
import { motion, MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";

export function BrandMotionConfig({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function MotionFadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionHoverCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Character-by-character theatrical text reveal while preserving semantic sr-only text.
 */
export function SplitTextReveal({
  text,
  className,
  charClassName,
  baseDelay = 0.08,
  staggerSec = 0.018,
}: {
  text: string;
  className?: string;
  charClassName?: string;
  baseDelay?: number;
  staggerSec?: number;
}) {
  const words = text.split(" ");
  let globalIdx = 0;

  return (
    <span className={cn("inline-block", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline">
        {words.map((word, wordIdx) => (
          <span key={`${word}-${wordIdx}`} className="inline-block whitespace-nowrap">
            {Array.from(word).map((ch) => {
              const currentIdx = globalIdx++;
              return (
                <motion.span
                  key={`${currentIdx}-${ch}`}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.38,
                    delay: baseDelay + currentIdx * staggerSec,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={cn("inline-block will-change-transform", charClassName)}
                >
                  {ch}
                </motion.span>
              );
            })}
            {wordIdx < words.length - 1 && <span>{"\u00A0"}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Magnetic cursor pull micro-interaction on desktop pointers.
 */
export function MagneticWrapper({
  children,
  className,
  strength = 6,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setOffset({ x: nx * strength * 2, y: ny * strength * 2 });
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 260, damping: 20, mass: 0.5 }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Gentle GPU-accelerated 3D desktop card tilt hover.
 */
export function TiltCard3D({
  children,
  className,
  maxTiltDeg = 3.5,
}: {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
}) {
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0 });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -ny * maxTiltDeg * 2,
      ry: nx * maxTiltDeg * 2,
    });
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={() => setTilt({ rx: 0, ry: 0 })}
      animate={{ rotateX: tilt.rx, rotateY: tilt.ry }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Architectural clip-path entrance animation for showcase images on scroll.
 */
export function ImageClipReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0.45,
        clipPath: "inset(6% 0% 6% 0% round 12px)",
        scale: 1.04,
      }}
      whileInView={{
        opacity: 1,
        clipPath: "inset(0% 0% 0% 0% round 0px)",
        scale: 1,
      }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn("h-full w-full", className)}
    >
      {children}
    </motion.div>
  );
}
