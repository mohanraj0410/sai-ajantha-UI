import { Pool } from "pg";
import { getPaymentProvider } from "../lib/payment/razorpay-provider";
import { PaymentVerificationResultDto } from "@sai-ajanta/types";

export class PaymentVerificationService {
  /**
   * Cryptographically verifies Razorpay payment signature using server secret.
   */
  static verifyRazorpaySignature(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    amountPaise: number;
  }): PaymentVerificationResultDto {
    const provider = getPaymentProvider();
    const isValid = provider.verifyCheckoutSignature(
      params.razorpayOrderId,
      params.razorpayPaymentId,
      params.razorpaySignature
    );

    return {
      orderId: params.orderId,
      provider: "razorpay",
      providerPaymentId: params.razorpayPaymentId,
      providerOrderId: params.razorpayOrderId,
      amountPaise: params.amountPaise,
      currency: "INR",
      verified: isValid,
      status: isValid ? "PAID" : "FAILED",
      signatureMatch: isValid,
    };
  }

  /**
   * Idempotently records an incoming webhook event in dms_webhook_inbox.
   * Prevents double processing of duplicate webhook deliveries.
   */
  static async recordWebhookInbox(
    pool: Pool,
    provider: string,
    providerEventId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ alreadyProcessed: boolean; inboxId: string }> {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const res = await pool.query(
        `INSERT INTO dms_webhook_inbox (id, provider, provider_event_id, event_type, payload, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'PROCESSING', NOW(), NOW())
         ON CONFLICT (provider, provider_event_id) DO NOTHING
         RETURNING id;`,
        [id, provider, providerEventId, eventType, JSON.stringify(payload)]
      );

      if (res.rowCount === 0) {
        return { alreadyProcessed: true, inboxId: "" };
      }
      return { alreadyProcessed: false, inboxId: res.rows[0].id };
    } catch {
      // Duplicate key collision
      return { alreadyProcessed: true, inboxId: "" };
    }
  }

  /**
   * Records a durable payment exception when payment is captured after reservation expiry.
   */
  static async recordPaymentAfterExpiry(
    pool: Pool,
    orderId: string,
    paymentId: string,
    amountPaise: number
  ): Promise<void> {
    await pool.query(
      `UPDATE dms_trade_order
       SET status = 'PAYMENT_RECEIVED_AFTER_EXPIRY',
           payment_status = 'PAYMENT_RECEIVED_AFTER_EXPIRY',
           notes = COALESCE(notes, '') || ' [EXCEPTION: Payment verified after reservation expiry. Manual reconciliation required.]',
           updated_at = NOW()
       WHERE id = $1;`,
      [orderId]
    );
  }
}
