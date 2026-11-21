import crypto from "node:crypto";
import { isLivePaymentAllowed } from "../feature-flags";

/**
 * Returns the effective HMAC secret for verifying Razorpay checkout payment signatures.
 * In live mode, requires RAZORPAY_KEY_SECRET from environment.
 * In test mode, uses test signing secret with fallback for deterministic mock tests.
 */
export function getRazorpaySigningSecret(): string {
  const liveSecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (isLivePaymentAllowed()) {
    if (!liveSecret) {
      throw new Error(
        "CRITICAL SECURITY ERROR: RAZORPAY_KEY_SECRET is required when live payments are enabled."
      );
    }
    return liveSecret;
  }

  // Safe isolated test/sandbox signing secret
  return (
    process.env.RAZORPAY_TEST_SIGNING_SECRET?.trim() ||
    liveSecret ||
    "sa_razorpay_test_mode_internal_hmac_secret"
  );
}

/**
 * Computes the expected HMAC-SHA256 signature for Razorpay checkout:
 * HMAC_SHA256(order_id + "|" + payment_id, secret)
 */
export function computeRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  secret?: string
): string {
  const signingSecret = secret || getRazorpaySigningSecret();
  return crypto
    .createHmac("sha256", signingSecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

/**
 * Verifies Razorpay checkout signature using timing-safe comparison.
 * Returns true only if the signature is valid.
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string | undefined | null,
  secret?: string
): boolean {
  if (!orderId || !paymentId || !signature) return false;
  try {
    const expected = computeRazorpayPaymentSignature(orderId, paymentId, secret);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Returns the effective HMAC secret for verifying Razorpay webhook signatures.
 */
export function getRazorpayWebhookSecret(): string {
  const liveSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (isLivePaymentAllowed()) {
    if (!liveSecret) {
      throw new Error(
        "CRITICAL SECURITY ERROR: RAZORPAY_WEBHOOK_SECRET is required when live payments are enabled."
      );
    }
    return liveSecret;
  }

  return (
    process.env.RAZORPAY_TEST_WEBHOOK_SECRET?.trim() ||
    liveSecret ||
    "sa_razorpay_test_webhook_secret"
  );
}

/**
 * Computes the expected HMAC-SHA256 signature for Razorpay webhook payloads.
 */
export function computeRazorpayWebhookSignature(
  rawBody: string,
  secret?: string
): string {
  const webhookSecret = secret || getRazorpayWebhookSecret();
  return crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

/**
 * Verifies Razorpay webhook signature using timing-safe comparison.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | undefined | null,
  secret?: string
): boolean {
  if (!rawBody || !signature) return false;
  try {
    const expected = computeRazorpayWebhookSignature(rawBody, secret);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

