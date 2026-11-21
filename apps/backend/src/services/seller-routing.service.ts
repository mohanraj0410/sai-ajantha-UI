import {
  CanonicalSellerRoute,
  CATEGORY_ROUTING,
  CommercialFeatureFlags,
  DEFAULT_COMMERCIAL_FEATURE_FLAGS,
} from "@sai-ajanta/types";

export interface CartCheckoutEligibility {
  isPureDirect: boolean;
  hasEnquiryOnly: boolean;
  hasDistributorResale: boolean;
  canProceedToPayment: boolean;
  rejectionReason?: string;
}

export class SellerRoutingService {
  /**
   * Resolves the authoritative seller route for a product category.
   */
  static getRouteForCategory(category: string): CanonicalSellerRoute {
    const trimmed = (category || "").trim();
    if (!trimmed) return "ENQUIRY_ONLY";

    const matched = CATEGORY_ROUTING[trimmed];
    if (matched) return matched;

    // Check lowercase match
    const lower = trimmed.toLowerCase();
    for (const [key, route] of Object.entries(CATEGORY_ROUTING)) {
      if (key.toLowerCase() === lower) {
        return route;
      }
    }

    return "ENQUIRY_ONLY";
  }

  /**
   * Determines if direct online checkout and payment capture is permitted for this category.
   */
  static isDirectCheckoutAllowed(
    category: string,
    flags: CommercialFeatureFlags = DEFAULT_COMMERCIAL_FEATURE_FLAGS
  ): boolean {
    const route = this.getRouteForCategory(category);

    if (route === "SAI_AJANTHA_DIRECT") {
      return true;
    }

    if (route === "DISTRIBUTOR_RESALE") {
      return Boolean(flags.distributorOnlineCheckoutEnabled);
    }

    if (route === "ENQUIRY_ONLY") {
      // Floor springs require explicit confirmed route
      if (category.toLowerCase().includes("floor spring")) {
        return Boolean(flags.floorSpringsRouteConfirmed);
      }
      return false;
    }

    return false;
  }

  /**
   * Validates cart items against commercial policy and routing rules.
   */
  static evaluateCartCheckout(
    items: { category: string; quantity: number; isQuoteOnly?: boolean }[],
    flags: CommercialFeatureFlags = DEFAULT_COMMERCIAL_FEATURE_FLAGS
  ): CartCheckoutEligibility {
    if (!items || items.length === 0) {
      return {
        isPureDirect: false,
        hasEnquiryOnly: false,
        hasDistributorResale: false,
        canProceedToPayment: false,
        rejectionReason: "Cart is empty.",
      };
    }

    let hasDirect = false;
    let hasDistributor = false;
    let hasEnquiry = false;

    for (const item of items) {
      if (item.isQuoteOnly) {
        hasEnquiry = true;
        continue;
      }

      const route = this.getRouteForCategory(item.category);
      if (route === "SAI_AJANTHA_DIRECT") {
        hasDirect = true;
      } else if (route === "DISTRIBUTOR_RESALE") {
        hasDistributor = true;
      } else {
        hasEnquiry = true;
      }
    }

    // Direct sale is permitted only if ALL payable items are SAI_AJANTHA_DIRECT
    const isPureDirect = hasDirect && !hasDistributor && !hasEnquiry;

    if (hasDistributor && !flags.distributorOnlineCheckoutEnabled) {
      return {
        isPureDirect: false,
        hasEnquiryOnly: hasEnquiry,
        hasDistributorResale: true,
        canProceedToPayment: false,
        rejectionReason:
          "Distributor resale online checkout is currently disabled pending regional distributor settlement sign-off.",
      };
    }

    if (hasEnquiry) {
      return {
        isPureDirect: false,
        hasEnquiryOnly: true,
        hasDistributorResale: hasDistributor,
        canProceedToPayment: false,
        rejectionReason:
          "Cart contains items requiring custom engineering quotation or unserviceable categories (Quote-First).",
      };
    }

    return {
      isPureDirect,
      hasEnquiryOnly: false,
      hasDistributorResale: hasDistributor,
      canProceedToPayment: isPureDirect || (hasDistributor && flags.distributorOnlineCheckoutEnabled),
    };
  }
}
