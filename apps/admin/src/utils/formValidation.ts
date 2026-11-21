import type { Rule } from "antd/es/form";

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
export const INDIAN_GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const INDIAN_PIN_REGEX = /^[1-9][0-9]{5}$/;
export const PROMO_CODE_REGEX = /^[A-Z0-9_-]{3,24}$/;
export const SKU_CODE_REGEX = /^[A-Z0-9][A-Z0-9\s._/-]{1,63}$/;

export function normalizePhoneDigits(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function normalizeCompareValue(val: unknown): unknown {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return Number.isNaN(val) ? "" : val;
  if (typeof val === "boolean") return val;
  if (Array.isArray(val)) return val.map(normalizeCompareValue);
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(val as Record<string, unknown>).sort()) {
      const normalized = normalizeCompareValue((val as Record<string, unknown>)[key]);
      if (normalized !== "") {
        out[key] = normalized;
      }
    }
    return out;
  }
  return val;
}

/**
 * Compares current form values against an initial snapshot, ignoring trivial
 * whitespace / undefined / null differences so untouched or reverted forms
 * accurately report isDirty = false.
 */
export function areFormValuesEqual(current: unknown, initial: unknown): boolean {
  return (
    JSON.stringify(normalizeCompareValue(current)) ===
    JSON.stringify(normalizeCompareValue(initial))
  );
}

/* ==================== SHARED ANTD FORM RULES (SIMPLE ENGLISH) ==================== */

export function requiredTrimRule(message: string): Rule {
  return {
    validator: async (_, value) => {
      if (value === undefined || value === null || String(value).trim().length === 0) {
        throw new Error(message);
      }
    },
  };
}

export function emailRules(required = true): Rule[] {
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredTrimRule("Enter an email address."));
  }
  rules.push({
    validator: async (_, value) => {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) return;
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRe.test(trimmed)) {
        throw new Error("Enter a valid email address (example: name@company.com).");
      }
    },
  });
  return rules;
}

export function indianMobileRules(required = true): Rule[] {
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredTrimRule("Enter a 10-digit mobile number."));
  }
  rules.push({
    validator: async (_, value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return;
      const digits = normalizePhoneDigits(raw);
      if (!INDIAN_MOBILE_REGEX.test(digits)) {
        throw new Error("Enter a valid 10-digit Indian mobile number starting with 6–9.");
      }
    },
  });
  return rules;
}

export function gstinRules(required = false): Rule[] {
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredTrimRule("Enter the 15-character GSTIN."));
  }
  rules.push({
    validator: async (_, value) => {
      const cleaned = String(value ?? "").trim().toUpperCase();
      if (!cleaned) return;
      if (!INDIAN_GSTIN_REGEX.test(cleaned)) {
        throw new Error("Enter a valid 15-character GSTIN (example: 33AAAAA0000A1Z5).");
      }
    },
  });
  return rules;
}

export function indianPinRules(required = false): Rule[] {
  const rules: Rule[] = [];
  if (required) {
    rules.push(requiredTrimRule("Enter a 6-digit PIN code."));
  }
  rules.push({
    validator: async (_, value) => {
      const cleaned = String(value ?? "").trim();
      if (!cleaned) return;
      if (!INDIAN_PIN_REGEX.test(cleaned)) {
        throw new Error("Enter a valid 6-digit Indian PIN code (example: 620001).");
      }
    },
  });
  return rules;
}

export function skuCodeRules(existingSkus: string[], isEdit: boolean): Rule[] {
  const normalizedSet = new Set(
    existingSkus.map((s) => String(s || "").trim().toUpperCase())
  );
  return [
    requiredTrimRule("Enter a unique SKU code."),
    {
      validator: async (_, value) => {
        const cleaned = String(value ?? "").trim().toUpperCase();
        if (!cleaned) return;
        if (cleaned.length < 3 || cleaned.length > 64) {
          throw new Error("SKU code must be between 3 and 64 characters.");
        }
        if (!SKU_CODE_REGEX.test(cleaned)) {
          throw new Error("Use letters, numbers, hyphens, dots, or slashes for SKU.");
        }
        if (!isEdit && normalizedSet.has(cleaned)) {
          throw new Error("This SKU code already exists. Enter a different SKU.");
        }
      },
    },
  ];
}

export function priceRules(label: string, required = false): Rule[] {
  const rules: Rule[] = [];
  if (required) {
    rules.push({
      validator: async (_, value) => {
        if (value === undefined || value === null || value === "") {
          throw new Error(`Enter ${label}.`);
        }
      },
    });
  }
  rules.push({
    validator: async (_, value) => {
      if (value === undefined || value === null || value === "") return;
      const num = Number(value);
      if (Number.isNaN(num) || num < 0) {
        throw new Error(`${label} cannot be negative.`);
      }
      if (num > 10_000_000) {
        throw new Error(`${label} looks too high. Check the amount.`);
      }
    },
  });
  return rules;
}

export function stockQtyRules(): Rule[] {
  return [
    {
      validator: async (_, value) => {
        if (value === undefined || value === null || value === "") {
          throw new Error("Enter available stock quantity (0 or more).");
        }
        const num = Number(value);
        if (!Number.isInteger(num) || num < 0 || num > 1_000_000) {
          throw new Error("Stock must be a whole number between 0 and 10,00,000.");
        }
      },
    },
  ];
}

export function positiveQtyRules(max = 100_000): Rule[] {
  return [
    {
      validator: async (_, value) => {
        if (value === undefined || value === null || value === "") {
          throw new Error("Enter a quantity of at least 1.");
        }
        const num = Number(value);
        if (!Number.isInteger(num) || num < 1 || num > max) {
          throw new Error(`Enter a whole number between 1 and ${max.toLocaleString("en-IN")}.`);
        }
      },
    },
  ];
}

export function strongPasswordRules(): Rule[] {
  return [
    requiredTrimRule("Enter a password."),
    {
      validator: async (_, value) => {
        const raw = String(value ?? "");
        if (!raw) return;
        if (raw.length < 8) {
          throw new Error("Password must be at least 8 characters long.");
        }
        if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
          throw new Error("Password must include both letters and numbers.");
        }
      },
    },
  ];
}

export function promoCodeRules(): Rule[] {
  return [
    requiredTrimRule("Enter a promotion code."),
    {
      validator: async (_, value) => {
        const cleaned = String(value ?? "").trim().toUpperCase();
        if (!cleaned) return;
        if (!PROMO_CODE_REGEX.test(cleaned)) {
          throw new Error("Use 3–24 letters, numbers, hyphens, or underscores (no spaces).");
        }
      },
    },
  ];
}

export function imageUrlOrPathRules(): Rule[] {
  return [
    {
      validator: async (_, value) => {
        const cleaned = String(value ?? "").trim();
        if (!cleaned) return;
        const ok =
          cleaned.startsWith("/") ||
          /^https?:\/\/[^\s]+$/i.test(cleaned);
        if (!ok) {
          throw new Error("Enter a valid path starting with / or a full https:// image URL.");
        }
      },
    },
  ];
}
