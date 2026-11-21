"use client";

import React, { useRef, useState, useEffect } from "react";
import { useReducedMotion } from "framer-motion";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number; // max tilt degrees (e.g. 2.5)
  perspective?: number;
  className?: string;
  enableScale?: boolean;
}

/**
 * Architectural Precision Tilt Card
 * Adds subtle pointer-sensitive 3D perspective tilt (max 2-3 degrees)
 * Strictly disabled on touch devices and for `prefers-reduced-motion`.
 */
export function TiltCard({
  children,
  maxTilt = 2.5,
  perspective = 1000,
  className = "",
  enableScale = true,
  ...props
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, isHovered: false });
  const [isFinePointer, setIsFinePointer] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Only enable tilt on fine pointer devices (mouse/trackpad), not touch screens
    const mql = window.matchMedia("(pointer: fine)");
    setIsFinePointer(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsFinePointer(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (shouldReduceMotion || !isFinePointer) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTilt({ rotateX, rotateY, isHovered: true });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, isHovered: false });
  };

  const transformStyle = tilt.isHovered
    ? `perspective(${perspective}px) rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)${enableScale ? " scale3d(1.015, 1.015, 1.015)" : ""}`
    : `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transformStyle,
        transition: tilt.isHovered
          ? "transform 0.12s ease-out"
          : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: tilt.isHovered ? "transform" : "auto",
        transformStyle: "preserve-3d",
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
