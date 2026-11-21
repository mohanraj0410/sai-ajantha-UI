import Image from "next/image";

interface BrandLogoProps {
  /** Use "onDark" when placed over Deep Navy/video to provide clean brand clear-space backing */
  surface?: "light" | "onDark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Official Sai Ajantha master logo asset (Brand Guidelines pp. 16-21).
 * Preserves aspect ratio, clear space, and master artwork without redrawing or recolouring.
 */
export function BrandLogo({
  surface = "light",
  size = "md",
  className = "",
}: BrandLogoProps) {
  const heightClass =
    size === "sm"
      ? "h-8 sm:h-9"
      : size === "lg"
        ? "h-12 sm:h-14"
        : "h-10 sm:h-11";

  const wrapperClass =
    surface === "onDark"
      ? "inline-flex items-center rounded-lg bg-white px-2.5 py-1.5 shadow-xs"
      : "inline-flex items-center";

  return (
    <span className={`select-none ${wrapperClass} ${className}`}>
      <Image
        src="/Screenshot 2026-11-11 164610.png"
        alt="Sai Ajantha Interior Solutions — Quality Without Compromise"
        width={450}
        height={142}
        priority
        className={`${heightClass} w-auto object-contain shrink-0`}
      />
    </span>
  );
}
