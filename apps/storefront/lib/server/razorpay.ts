import "server-only";
import crypto from "node:crypto";

export interface RazorpayConfig {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
  isLiveConfigured: boolean;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || null;
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null;
  return {
    keyId,
    keySecret,
    webhookSecret,
    isLiveConfigured: Boolean(keyId && keySecret),
  };
}

function getEffectiveSigningSecret(): string {
  const cfg = getRazorpayConfig();
  if (cfg.keySecret) return cfg.keySecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RAZORPAY_KEY_SECRET must be configured in production.");
  }
  return (
    process.env.RAZORPAY_TEST_SIGNING_SECRET?.trim() ||
    "sa_razorpay_test_mode_internal_hmac_secret"
  );
}

export async function createRazorpayOrderRecord(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{
  providerOrderId: string;
  amountPaise: number;
  currency: "INR";
  testMode: boolean;
  publicKeyId: string;
}> {
  const cfg = getRazorpayConfig();

  if (cfg.isLiveConfigured && cfg.keyId && cfg.keySecret) {
    const authHeader = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString(
      "base64"
    );
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amountPaise,
        currency: "INR",
        receipt: params.receipt,
        notes: params.notes ?? {},
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Razorpay order creation failed: ${errText}`);
    }

    const data = (await res.json()) as {
      id: string;
      amount: number;
      currency: "INR";
    };

    return {
      providerOrderId: data.id,
      amountPaise: data.amount,
      currency: data.currency || "INR",
      testMode: false,
      publicKeyId: cfg.keyId,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Live Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) must be configured in production."
    );
  }

  // Development / Local Sandbox Mode only
  const providerOrderId = `order_test_${crypto.randomBytes(8).toString("hex")}`;
  return {
    providerOrderId,
    amountPaise: params.amountPaise,
    currency: "INR",
    testMode: true,
    publicKeyId: "rzp_test_sai_ajantha",
  };
}

export function generateTestModePaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string
): string {
  return crypto
    .createHmac("sha256", getEffectiveSigningSecret())
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !signature) return false;
  const expected = generateTestModePaymentSignature(
    razorpayOrderId,
    razorpayPaymentId
  );
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  headerSignature: string | null
): boolean {
  if (!headerSignature) return false;
  const cfg = getRazorpayConfig();
  const secret =
    cfg.webhookSecret ||
    process.env.RAZORPAY_TEST_WEBHOOK_SECRET?.trim() ||
    "sa_razorpay_test_webhook_secret";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(headerSignature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

