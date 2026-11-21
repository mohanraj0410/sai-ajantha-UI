/**
 * Centralized Exact Monetary Engine (Task 03.2 / BE-15 Precursor)
 * Enforces integer paise as the authoritative standard for all financial calculations.
 * Forbids raw binary floating-point arithmetic on currency.
 */

export interface MoneyBreakdown {
  subtotalPaise: number;
  gstAmountPaise: number;
  totalPaise: number;
  subtotalInr: number;
  gstAmountInr: number;
  totalInr: number;
}

export interface MonetaryReconciliationResult {
  orderId: string;
  orderNumber: string;
  expectedPaise: number;
  recordedPaise: number;
  variancePaise: number;
  isReconciled: boolean;
  notes?: string;
}

/**
 * Converts INR (rupees) to exact integer paise deterministically,
 * eliminating binary floating-point representation drift.
 */
export function inrToPaise(amountInr: number | null | undefined): number {
  if (amountInr == null || isNaN(amountInr)) return 0;
  // Use string conversion or scaled rounding to avoid 0.1 * 100 = 10.000000000000002
  const paise = Math.round(Number(amountInr) * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`Amount ${amountInr} INR exceeds safe integer range in paise.`);
  }
  return paise;
}

/**
 * Converts exact integer paise to INR (rupees) with 2 decimal precision.
 */
export function paiseToInr(amountPaise: number | null | undefined): number {
  if (amountPaise == null || isNaN(amountPaise)) return 0;
  if (!Number.isInteger(amountPaise)) {
    throw new TypeError(`Amount in paise must be an exact integer, received: ${amountPaise}`);
  }
  return Number((amountPaise / 100).toFixed(2));
}

/**
 * Checks whether an item or catalog entry has a valid payable price.
 * Under the ₹0 quote-only policy, any unpriced, null, or zero price must be quote-only.
 */
export function isQuoteOnlyPrice(priceInr: number | null | undefined): boolean {
  if (priceInr == null || isNaN(priceInr)) return true;
  return Number(priceInr) <= 0;
}

/**
 * Computes deterministic integer paise breakdown for order items.
 * Does not assume a flat GST rate; uses line-item or order-provided rate.
 */
export function computeOrderMoneyBreakdown(params: {
  subtotalInr?: number;
  subtotalPaise?: number;
  gstRatePercent?: number;
  inclusiveGst?: boolean;
}): MoneyBreakdown {
  const gstRate = params.gstRatePercent ?? 18; // Default pending accounting sign-off

  let subtotalPaise: number;
  let gstAmountPaise: number;
  let totalPaise: number;

  if (params.subtotalPaise != null) {
    subtotalPaise = params.subtotalPaise;
  } else {
    subtotalPaise = inrToPaise(params.subtotalInr ?? 0);
  }

  if (params.inclusiveGst) {
    // If total was inclusive: subtotal = total / (1 + rate/100)
    totalPaise = subtotalPaise; // input was total
    subtotalPaise = Math.round(totalPaise / (1 + gstRate / 100));
    gstAmountPaise = totalPaise - subtotalPaise;
  } else {
    gstAmountPaise = Math.round((subtotalPaise * gstRate) / 100);
    totalPaise = subtotalPaise + gstAmountPaise;
  }

  return {
    subtotalPaise,
    gstAmountPaise,
    totalPaise,
    subtotalInr: paiseToInr(subtotalPaise),
    gstAmountInr: paiseToInr(gstAmountPaise),
    totalInr: paiseToInr(totalPaise),
  };
}

/**
 * Reconciles an order's recorded total against actual recorded payments.
 * Flags any variance exceeding zero paise.
 */
export function reconcileOrderMonetaryAmounts(params: {
  orderId: string;
  orderNumber: string;
  orderTotalInr: number;
  paymentAmountPaise?: number;
}): MonetaryReconciliationResult {
  const expectedPaise = inrToPaise(params.orderTotalInr);
  const recordedPaise = params.paymentAmountPaise ?? 0;
  const variancePaise = recordedPaise - expectedPaise;

  const isReconciled = variancePaise === 0;

  return {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    expectedPaise,
    recordedPaise,
    variancePaise,
    isReconciled,
    notes: isReconciled
      ? "Fully reconciled"
      : `Discrepancy: ${variancePaise > 0 ? "overpayment" : "underpayment"} of ${Math.abs(variancePaise)} paise.`,
  };
}

/**
 * Formats monetary amounts for trustworthy executive/admin presentation.
 */
export function formatInrDisplay(amountPaiseOrInr: number, isPaise = false): string {
  const inr = isPaise ? paiseToInr(amountPaiseOrInr) : amountPaiseOrInr;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inr);
}
