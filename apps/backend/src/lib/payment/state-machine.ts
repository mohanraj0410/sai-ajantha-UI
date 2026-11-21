/**
 * Canonical Payment & Order State Machine (Task 02.1 / BE-02 / BE-03 / BE-12)
 * Enforces server-authoritative state transitions and forbids client state assertion.
 */

export type CanonicalPaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "PAYMENT_FAILED"
  | "EXPIRED"
  | "REFUND_REQUESTED"
  | "REFUNDED"
  | "PENDING_OFFLINE_SETTLEMENT";

export type CanonicalOrderStatus =
  | "PENDING_PAYMENT"
  | "BOQ_QUOTE_REQUESTED"
  | "CONFIRMED_TRADE_PO"
  | "CONFIRMED"
  | "PROCESSING"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "PAYMENT_FAILED";

const VALID_PAYMENT_TRANSITIONS: Record<
  CanonicalPaymentStatus,
  CanonicalPaymentStatus[]
> = {
  PENDING: ["AUTHORIZED", "PAID", "PAYMENT_FAILED", "EXPIRED"],
  AUTHORIZED: ["PAID", "PAYMENT_FAILED", "EXPIRED"],
  PAID: ["REFUND_REQUESTED", "REFUNDED"],
  PAYMENT_FAILED: ["PENDING"], // Retry allowed
  EXPIRED: ["PENDING"],
  REFUND_REQUESTED: ["REFUNDED", "PAID"],
  REFUNDED: [], // Terminal state
  PENDING_OFFLINE_SETTLEMENT: ["PAID", "CANCELLED" as unknown as CanonicalPaymentStatus],
};

/**
 * Validates whether a payment status transition is legally permitted.
 */
export function isValidPaymentTransition(
  current: CanonicalPaymentStatus,
  next: CanonicalPaymentStatus
): boolean {
  if (current === next) return true;
  const allowed = VALID_PAYMENT_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

/**
 * Asserts that a payment transition is valid, throwing an error if illegal.
 */
export function assertValidPaymentTransition(
  current: CanonicalPaymentStatus,
  next: CanonicalPaymentStatus
): void {
  if (!isValidPaymentTransition(current, next)) {
    throw new Error(
      `Illegal payment status transition: cannot transition payment from [${current}] to [${next}].`
    );
  }
}

/**
 * Computes the server-authoritative initial order status and payment status.
 * Ignores any client-supplied status assertions to prevent BE-03.
 */
export function deriveInitialOrderState(params: {
  isRazorpay: boolean;
  hasQuoteItems: boolean;
}): { status: CanonicalOrderStatus; paymentStatus: CanonicalPaymentStatus } {
  if (params.isRazorpay) {
    return {
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
    };
  }

  if (params.hasQuoteItems) {
    return {
      status: "BOQ_QUOTE_REQUESTED",
      paymentStatus: "PENDING_OFFLINE_SETTLEMENT",
    };
  }

  return {
    status: "CONFIRMED_TRADE_PO",
    paymentStatus: "PENDING_OFFLINE_SETTLEMENT",
  };
}
