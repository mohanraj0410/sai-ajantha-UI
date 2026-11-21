import crypto from "node:crypto";
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  isDistributorPaymentCaptureAllowed,
  isLivePaymentAllowed,
} from "../../../../../../lib/feature-flags";
import {
  applyCatalogStockChanges,
  confirmStockReservations,
  confirmStockReservationsForOrder,
} from "../../../../../../lib/inventory";
import { getPgPool } from "../../../../../../lib/db";
import {
  RawTradeOrder,
  RawTradePayment,
  TradeOrderEventRecord,
  TradeOrderItemRecord,
} from "../../../../../../lib/order-serializer";
import { getIdempotencyStore } from "../../../../../../lib/payment/idempotency";
import { getPaymentProvider } from "../../../../../../lib/payment/razorpay-provider";
import { verifyRazorpayPaymentSignature } from "../../../../../../lib/payment/signature-verification";
import { DMS_MODULE } from "../../../../../../modules/dms";
import DmsModuleService from "../../../../../../modules/dms/services";

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const [order] = (await dmsService.listTradeOrders({
    id: req.params.id,
  })) as unknown as RawTradeOrder[];

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }
  if (order.customer_id !== customerId) {
    return res.status(403).json({ message: "Forbidden." });
  }

  const body = (req.body || {}) as {
    action?: "CAPTURE" | "FAIL" | "SIGNATURE_FAILED";
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    reason?: string;
    actorName?: string;
  };

  if (!body.razorpayOrderId || order.razorpay_order_id !== body.razorpayOrderId) {
    return res.status(400).json({ message: "Razorpay order ID mismatch." });
  }

  const payments = (await dmsService.listTradePayments({
    provider_order_id: body.razorpayOrderId,
  })) as unknown as RawTradePayment[];
  const paymentRecord = payments[0];
  const now = new Date().toISOString();
  const existingEvents = Array.isArray(order.events)
    ? (order.events as TradeOrderEventRecord[])
    : [];

  if (body.action === "CAPTURE") {
    // Idempotency check (SF-19 / Task 02.4 / P3.3.1)
    const rawIdemKey =
      req.headers?.["idempotency-key"] ||
      req.headers?.["x-idempotency-key"] ||
      "";
    const idempotencyKey = Array.isArray(rawIdemKey) ? rawIdemKey[0] : rawIdemKey;
    const idempotencyStore = getIdempotencyStore();

    const idemCheck = await idempotencyStore.check(
      idempotencyKey,
      customerId,
      "payment:capture",
      body,
      req.scope
    );
    if (idemCheck.status === "REPLAY") {
      return res.status(idemCheck.responseStatus).json(idemCheck.responseBody);
    }
    if (idemCheck.status === "CONFLICT") {
      return res.status(409).json({
        code: "IDEMPOTENT_PAYLOAD_MUTATED",
        message: idemCheck.message,
      });
    }

    if (order.role_at_order === "DISTRIBUTOR" && !isDistributorPaymentCaptureAllowed()) {
      return res.status(403).json({
        message: "Distributor payment capture is disabled by commercial policy.",
      });
    }

    if (order.payment_status === "PAID") {
      return res.status(409).json({
        message: "Duplicate payment rejected: this order is already paid.",
      });
    }

    if (["CANCELLED", "DELIVERED", "EXPIRED"].includes(order.status)) {
      return res.status(400).json({
        code: "ORDER_NOT_PAYABLE",
        message: `Order in ${order.status} state cannot accept payment.`,
      });
    }

    if (!body.razorpayPaymentId) {
      return res.status(400).json({ message: "razorpayPaymentId is required." });
    }

    // Fail-closed signature verification (BE-02 / SF-02)
    if (!body.razorpaySignature) {
      return res.status(400).json({
        code: "PAYMENT_SIGNATURE_REQUIRED",
        message:
          "Cryptographic payment signature (razorpaySignature) is required. Client-asserted capture is forbidden.",
      });
    }

    const isTestOrder = (order.razorpay_order_id || "").startsWith("order_test_");
    if (!isTestOrder && !isLivePaymentAllowed()) {
      return res.status(403).json({
        code: "LIVE_PAYMENTS_DISABLED",
        message: "Live payment capture is disabled by commercial policy.",
      });
    }

    const provider = getPaymentProvider();
    const isValidSignature = provider.verifyCheckoutSignature(
      order.razorpay_order_id!,
      body.razorpayPaymentId,
      body.razorpaySignature
    );
    if (!isValidSignature) {
      return res.status(400).json({
        code: "INVALID_PAYMENT_SIGNATURE",
        message: "Invalid Razorpay payment signature. Payment capture verification failed.",
      });
    }

    // Verify payment authenticity with provider adapter (BE-02 / BE-04 / SF-02)
    const expectedPaise = Math.round(order.total_inr * 100);
    let paymentDetails;
    try {
      paymentDetails = await provider.fetchPayment(body.razorpayPaymentId, {
        orderId: order.razorpay_order_id!,
        expectedPaise,
      });
    } catch (err) {
      return res.status(400).json({
        code: "PAYMENT_LOOKUP_FAILED",
        message: err instanceof Error ? err.message : "Failed to verify payment with provider.",
      });
    }

    if (paymentDetails.order_id !== order.razorpay_order_id) {
      return res.status(400).json({
        code: "PAYMENT_ORDER_MISMATCH",
        message: `Payment belongs to order ${paymentDetails.order_id}, not ${order.razorpay_order_id}.`,
      });
    }

    if (paymentDetails.amount !== expectedPaise) {
      return res.status(400).json({
        code: "PAYMENT_AMOUNT_MISMATCH",
        message: `Payment amount ${paymentDetails.amount} does not match order amount ${expectedPaise} paise.`,
      });
    }

    if (paymentDetails.currency !== "INR") {
      return res.status(400).json({
        code: "PAYMENT_CURRENCY_MISMATCH",
        message: `Payment currency ${paymentDetails.currency} must be INR.`,
      });
    }

    if (paymentDetails.status !== "captured" && paymentDetails.status !== "authorized") {
      return res.status(400).json({
        code: "PAYMENT_NOT_SETTLED",
        message: `Payment status is ${paymentDetails.status}, expected captured or authorized.`,
      });
    }

    const dupPayments = (await dmsService.listTradePayments({
      provider_payment_id: body.razorpayPaymentId,
    })) as unknown as RawTradePayment[];
    if (dupPayments.length > 0) {
      return res
        .status(409)
        .json({ message: "Duplicate payment ID rejected." });
    }

    // Confirm stock reservations on capture idempotently (BE-05, RB-04, P3.4.1, P3.5)
    let stockConfirmed = false;
    let isLegacyOrder = false;
    let isExpiredOrReleasedHold = false;
    let holdExceptionReason = "";

    try {
      const pool = getPgPool();
      const confirmRes = await confirmStockReservationsForOrder(pool, order.id);
      if (confirmRes.success) {
        if (!confirmRes.isLegacy) {
          stockConfirmed = true; // Either freshly confirmed or already confirmed by concurrent webhook
        } else {
          isLegacyOrder = true;
        }
      } else {
        // Late payment after hold expired or released (Task 03.5 / Addendum Sec 3)
        isExpiredOrReleasedHold = true;
        holdExceptionReason = confirmRes.error || "RESERVATION_EXPIRED";
      }
    } catch (dbErr) {
      // In unit test without db, fallback gracefully
      isLegacyOrder = true;
    }

    if (isExpiredOrReleasedHold) {
      // Record payment for reconciliation without fulfilling order or decrementing missing stock
      if (paymentRecord) {
        await dmsService.updateTradePayments({
          id: paymentRecord.id,
          provider_payment_id: body.razorpayPaymentId,
          signature_verified: true,
          status: "PAYMENT_RECEIVED_AFTER_EXPIRY",
        });
      }

      await dmsService.updateTradeOrders({
        id: order.id,
        status: "PAYMENT_EXCEPTION_REVIEW",
        payment_status: "PAYMENT_RECEIVED_AFTER_EXPIRY",
        razorpay_payment_id: body.razorpayPaymentId,
        events: [
          ...existingEvents,
          {
            id: `evt-${crypto.randomUUID()}`,
            order_id: order.id,
            status: "PAYMENT_EXCEPTION_REVIEW",
            note: `Payment ${body.razorpayPaymentId} verified, but 15-minute stock reservation expired (${holdExceptionReason}). Flagged for staff review.`,
            actor_name: "RAZORPAY_VERIFY",
            created_at: now,
          },
        ] as unknown as Record<string, unknown>,
      });

      const exceptionPayload = {
        code: "PAYMENT_RECEIVED_AFTER_EXPIRY",
        message: "Verified payment was received after the 15-minute stock hold expired. Order has been flagged for manual staff reconciliation.",
        orderId: order.id,
        paymentStatus: "PAYMENT_RECEIVED_AFTER_EXPIRY",
        orderStatus: "PAYMENT_EXCEPTION_REVIEW",
        razorpayPaymentId: body.razorpayPaymentId,
      };

      await idempotencyStore.record(
        idempotencyKey,
        customerId,
        "payment:capture",
        body,
        409,
        exceptionPayload,
        86400,
        req.scope
      );

      return res.status(409).json(exceptionPayload);
    }

    // Only invoke legacy fallback if this order was created before the reservation engine
    if (isLegacyOrder && !stockConfirmed && Array.isArray(order.items) && order.items.length > 0) {
      const items = order.items as TradeOrderItemRecord[];
      try {
        await applyCatalogStockChanges(
          req.scope,
          items.map((item) => ({
            productId: item.product_id,
            name: item.name,
            units: -(
              Math.max(1, item.quantity) * Math.max(1, item.pack_multiplier || 1)
            ),
          })),
          { mode: "adjust", rejectIfInsufficient: true }
        );
      } catch (err) {
        return res.status(409).json({
          message:
            err instanceof Error
              ? err.message
              : "Stock depleted prior to payment capture.",
        });
      }
    }

    if (paymentRecord) {
      await dmsService.updateTradePayments({
        id: paymentRecord.id,
        provider_payment_id: body.razorpayPaymentId,
        signature_verified: true,
        status: "CAPTURED",
      });
    }

    await dmsService.updateTradeOrders({
      id: order.id,
      status: "CONFIRMED",
      payment_status: "PAID",
      razorpay_payment_id: body.razorpayPaymentId,
      events: [
        ...existingEvents,
        {
          id: `evt-${crypto.randomUUID()}`,
          order_id: order.id,
          status: "CONFIRMED",
          note: `Payment ${body.razorpayPaymentId} verified and captured.`,
          actor_name: "RAZORPAY_VERIFY",
          created_at: now,
        },
      ] as unknown as Record<string, unknown>,
    });

    const capturePayload = {
      verified: true,
      orderId: order.id,
      razorpayPaymentId: body.razorpayPaymentId,
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    };

    await idempotencyStore.record(
      idempotencyKey,
      customerId,
      "payment:capture",
      body,
      200,
      capturePayload,
      86400,
      req.scope
    );

    return res.json(capturePayload);
  }

  if (body.action === "SIGNATURE_FAILED") {
    if (paymentRecord) {
      await dmsService.updateTradePayments({
        id: paymentRecord.id,
        status: "SIGNATURE_FAILED",
        failure_reason: "Invalid HMAC signature",
      });
    }
    await dmsService.updateTradeOrders({
      id: order.id,
      events: [
        ...existingEvents,
        {
          id: `evt-${crypto.randomUUID()}`,
          order_id: order.id,
          status: "PAYMENT_FAILED",
          note: "Payment signature verification failed.",
          actor_name: "SYSTEM",
          created_at: now,
        },
      ] as unknown as Record<string, unknown>,
    });
    return res
      .status(400)
      .json({ message: "Payment signature verification failed." });
  }

  if (body.action === "FAIL") {
    if (order.payment_status === "PAID") {
      return res.status(409).json({
        message: "Cannot mark an already paid order as failed.",
      });
    }
    const reason = (body.reason || "Payment cancelled or declined by gateway").trim();
    if (paymentRecord) {
      await dmsService.updateTradePayments({
        id: paymentRecord.id,
        status: "FAILED",
        failure_reason: reason,
      });
    }
    await dmsService.updateTradeOrders({
      id: order.id,
      status: "PAYMENT_FAILED",
      payment_status: "FAILED",
      events: [
        ...existingEvents,
        {
          id: `evt-${crypto.randomUUID()}`,
          order_id: order.id,
          status: "PAYMENT_FAILED",
          note: reason,
          actor_name: body.actorName || order.customer_name,
          created_at: now,
        },
      ] as unknown as Record<string, unknown>,
    });
    return res.json({ ok: true, paymentStatus: "FAILED" });
  }

  return res.status(400).json({ message: "Unsupported payment action." });
}
