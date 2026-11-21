"use client";

import React from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  theme?: "light" | "dark";
  titleId?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  theme = "light",
  titleId,
}: SectionHeadingProps) {
  const isDark = theme === "dark";
  const alignClass =
    align === "center"
      ? "mx-auto text-center items-center"
      : "text-left items-start";

  return (
    <div className={`flex flex-col ${alignClass} max-w-3xl`}>
      <span
        className={`inline-flex items-center gap-2.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
          isDark
            ? "border-[#24C6D0]/35 bg-[#174B78]/45 text-[#24C6D0]"
            : "border-[#079D9A]/25 bg-[#079D9A]/[0.07] text-[#079D9A]"
        }`}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#079D9A] to-[#24C6D0]"
        />
        <span>{eyebrow}</span>
      </span>

      <h2
        id={titleId}
        className={`mt-2 type-section-title ${
          isDark ? "text-white" : "text-[#102D4D]"
        }`}
      >
        {title}
      </h2>

      {description && (
        <p
          className={`mt-2 text-sm sm:text-[15px] leading-[1.55] ${
            isDark ? "text-[#C6CAD5]" : "text-[#5D6B7B]"
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
