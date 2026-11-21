import { DEFAULT_COMMERCIAL_FEATURE_FLAGS, CommercialFeatureFlags } from "@sai-ajanta/types";

/**
 * Server-side authoritative evaluation of commercial policy feature flags.
 * Defaults are strictly fail-closed as per DEC-002 and DEC-003.
 */
export function getCommercialFeatureFlags(): CommercialFeatureFlags {
  return {
    floorSpringsRouteConfirmed:
      process.env.FEATURE_FLOOR_SPRINGS_CONFIRMED === "true" ||
      DEFAULT_COMMERCIAL_FEATURE_FLAGS.floorSpringsRouteConfirmed,
    distributorOnlineCheckoutEnabled:
      process.env.FEATURE_DISTRIBUTOR_ONLINE_CHECKOUT === "true" ||
      DEFAULT_COMMERCIAL_FEATURE_FLAGS.distributorOnlineCheckoutEnabled,
    distributorPaymentCaptureEnabled:
      process.env.FEATURE_DISTRIBUTOR_PAYMENT_CAPTURE === "true" ||
      DEFAULT_COMMERCIAL_FEATURE_FLAGS.distributorPaymentCaptureEnabled,
    distributorRefundsEnabled:
      process.env.FEATURE_DISTRIBUTOR_REFUNDS === "true" ||
      DEFAULT_COMMERCIAL_FEATURE_FLAGS.distributorRefundsEnabled,
    liveRazorpayEnabled:
      process.env.FEATURE_LIVE_RAZORPAY === "true" ||
      DEFAULT_COMMERCIAL_FEATURE_FLAGS.liveRazorpayEnabled,
    // Admin authentication is strictly non-optional on the backend.
    authoritativeAdminAuthEnforced: true,
  };
}

export function isFloorSpringsCheckoutAllowed(): boolean {
  return getCommercialFeatureFlags().floorSpringsRouteConfirmed;
}

export function isDistributorOnlineCheckoutAllowed(): boolean {
  return getCommercialFeatureFlags().distributorOnlineCheckoutEnabled;
}

export function isDistributorPaymentCaptureAllowed(): boolean {
  return getCommercialFeatureFlags().distributorPaymentCaptureEnabled;
}

export function isDistributorRefundsAllowed(): boolean {
  return getCommercialFeatureFlags().distributorRefundsEnabled;
}

export function isLivePaymentAllowed(): boolean {
  return getCommercialFeatureFlags().liveRazorpayEnabled;
}
