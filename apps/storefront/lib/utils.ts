import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS utility classes with conditional class support.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

