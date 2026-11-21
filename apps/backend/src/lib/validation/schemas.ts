import { z } from "zod";

/**
 * Standardized API Error Envelope (BE-16 / SF-10 / SF-11)
 */
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export function createErrorEnvelope(
  code: string,
  message: string,
  details?: unknown
): ApiErrorEnvelope {
  return {
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}

/**
 * Order Item schema enforcing strict positive integers on quantity and multiplier
 */
export const OrderItemInputSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  sku: z.string().optional().default(""),
  name: z.string().min(1, "item name is required"),
  category: z.string().min(1, "category is required"),
  finish: z.string().nullable().optional(),
  packLabel: z.string().nullable().optional(),
  packMultiplier: z
    .number()
    .int("packMultiplier must be an integer")
    .positive("packMultiplier must be >= 1")
    .default(1),
  quantity: z
    .number()
    .int("quantity must be an integer")
    .positive("quantity must be >= 1"),
  unitPriceInr: z.number().nonnegative("unitPriceInr cannot be negative").nullable().optional(),
  lineTotalInr: z.number().nonnegative("lineTotalInr cannot be negative").nullable().optional(),
});

/**
 * Store Order Creation Request Schema
 */
export const CreateOrderRequestSchema = z.object({
  customerName: z.string().trim().min(1, "customerName is required"),
  customerEmail: z.string().trim().email("valid customerEmail is required"),
  customerPhone: z.string().trim().min(7, "customerPhone must be at least 7 digits"),
  organization: z.string().trim().optional(),
  gstin: z.string().trim().nullable().optional(),
  shippingAddress: z.string().trim().min(5, "shippingAddress must be at least 5 characters"),
  paymentMethod: z.string().optional(),
  razorpayOrderId: z.string().nullable().optional(),
  amountPaise: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  notes: z.string().nullable().optional(),
  actorName: z.string().optional(),
  items: z.array(OrderItemInputSchema).min(1, "At least one order item is required"),
});

/**
 * Admin Customer Profile Update Schema
 */
export const UpdateCustomerProfileSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING_APPROVAL", "SUSPENDED", "REJECTED"]).optional(),
  role: z.enum(["CUSTOMER", "DEALER", "DISTRIBUTOR"]).optional(),
  rejection_reason: z.string().nullable().optional(),
  parent_distributor_id: z.string().trim().min(1).nullable().optional(),
});

/**
 * Admin Order Status Update Schema
 */
export const UpdateOrderStatusSchema = z.object({
  action: z.enum(["CANCEL", "UPDATE", "ROUTE"]).optional(),
  reason: z.string().optional(),
  status: z
    .enum([
      "PENDING_PAYMENT",
      "BOQ_QUOTE_REQUESTED",
      "CONFIRMED_TRADE_PO",
      "CONFIRMED",
      "PROCESSING",
      "DISPATCHED",
      "DELIVERED",
      "CANCELLED",
      "PAYMENT_FAILED",
    ])
    .optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED", "PENDING_OFFLINE_SETTLEMENT"]).optional(),
  shippingCarrier: z.string().nullable().optional(),
  trackingReference: z.string().nullable().optional(),
  refundStatus: z.string().optional(),
  eventNote: z.string().optional(),
  routingStatus: z.string().optional(),
  assignedDistributorId: z.string().nullable().optional(),
  assignedDistributorName: z.string().nullable().optional(),
  assignedDealerId: z.string().nullable().optional(),
  assignedDealerName: z.string().nullable().optional(),
  actorName: z.string().optional(),
});

/**
 * Helper to validate request bodies against schemas and emit clean 422 errors
 */
export function parseRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; envelope: ApiErrorEnvelope } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`
  );

  return {
    success: false,
    envelope: createErrorEnvelope(
      "VALIDATION_ERROR",
      `Invalid request payload: ${issues.join("; ")}`,
      issues
    ),
  };
}
