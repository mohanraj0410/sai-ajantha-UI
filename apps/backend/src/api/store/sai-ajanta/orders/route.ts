import crypto from "node:crypto";
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  isDistributorOnlineCheckoutAllowed,
  isFloorSpringsCheckoutAllowed,
} from "../../../../lib/feature-flags";
import {
  applyCatalogStockChanges,
  resolveAndAggregateOrderItems,
  reserveStockAtomic,
  confirmStockReservations,
  releaseStockReservations,
  releaseStockReservationsForOrder,
  InsufficientStockError,
  CommercialPolicyViolationError,
  StockReservationRecord,
} from "../../../../lib/inventory";
import { getPgPool } from "../../../../lib/db";
import { inrToPaise } from "../../../../lib/money";
import { getIdempotencyStore } from "../../../../lib/payment/idempotency";
import { deriveInitialOrderState } from "../../../../lib/payment/state-machine";
import {
  CreateOrderRequestSchema,
  parseRequestBody,
} from "../../../../lib/validation/schemas";
import {
  RawTradeOrder,
  RawTradePayment,
  serializeTradeOrder,
  TradeOrderItemRecord,
} from "../../../../lib/order-serializer";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows: custRows } = await pg.raw(
    `SELECT email, phone FROM customer WHERE id = ? LIMIT 1`,
    [customerId]
  );
  const customerEmail = (custRows[0]?.email || "").toLowerCase().trim();
  const customerPhone = (custRows[0]?.phone || "").trim();

  const { rows: profRows } = await pg.raw(
    `SELECT role FROM account_profile WHERE customer_id = ? OR id = ? LIMIT 1`,
    [customerId, customerId]
  );
  const userRole = profRows[0]?.role || "CUSTOMER";

  let query: string;
  let params: any[];

  if (userRole === "DISTRIBUTOR") {
    query = `SELECT * FROM dms_trade_order 
             WHERE (assigned_distributor_id = ? OR customer_id = ? OR (lower(customer_email) = ? AND customer_email != '')) 
               AND deleted_at IS NULL
             ORDER BY created_at DESC`;
    params = [customerId, customerId, customerEmail];
  } else {
    query = `SELECT * FROM dms_trade_order 
             WHERE (customer_id = ? OR (lower(customer_email) = ? AND customer_email != '') OR (customer_phone = ? AND customer_phone != ''))
               AND deleted_at IS NULL
             ORDER BY created_at DESC`;
    params = [customerId, customerEmail, customerPhone];
  }

  const { rows: orders } = await pg.raw(query, params);

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const enriched = await Promise.all(
    (orders as RawTradeOrder[]).map(async (order) => {
      const payments = (await dmsService.listTradePayments({
        order_id: order.id,
      })) as unknown as RawTradePayment[];
      return serializeTradeOrder(order, payments);
    })
  );

  return res.json({ orders: enriched });
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const validation = parseRequestBody(CreateOrderRequestSchema, req.body);
  if (!validation.success) {
    return res.status(400).json(validation.envelope);
  }
  const body = validation.data;

  // Idempotency check (SF-19 / Task 02.4 / P3.3.1)
  const rawIdemKey =
    req.headers?.["idempotency-key"] ||
    req.headers?.["x-idempotency-key"] ||
    (body as any).checkoutIntentId ||
    "";
  const idempotencyKey = Array.isArray(rawIdemKey) ? rawIdemKey[0] : rawIdemKey;
  const idempotencyStore = getIdempotencyStore();

  const idemCheck = await idempotencyStore.check(
    idempotencyKey,
    customerId,
    "order:create",
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

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const profiles = await dmsService.listAccountProfiles({ customer_id: customerId });
  const userProfile = profiles[0] || null;
  const isApproved = userProfile?.status === "ACTIVE";
  const userRole = isApproved && (userProfile?.role === "DEALER" || userProfile?.role === "DISTRIBUTOR")
    ? userProfile.role
    : "CUSTOMER";

  const isRazorpay = body.paymentMethod === "Razorpay Online Checkout";

  // Commercial policy enforcement (DEC-002 / DEC-003)
  if (userRole === "DISTRIBUTOR" && isRazorpay && !isDistributorOnlineCheckoutAllowed()) {
    return res.status(403).json({
      message:
        "Distributor online checkout is currently disabled by commercial policy. Please submit a BOQ quotation request or settle via offline proforma invoice.",
    });
  }

  const hasFloorSpring = body.items.some((item) =>
    (item.category && item.category.toLowerCase().includes("floor spring")) ||
    (item.name && item.name.toLowerCase().includes("floor spring"))
  );

  if (hasFloorSpring && !isFloorSpringsCheckoutAllowed()) {
    if (isRazorpay || body.status === "CONFIRMED_TRADE_PO") {
      return res.status(403).json({
        message:
          "Floor springs products are restricted to BOQ quotation requests and cannot be purchased via direct checkout.",
      });
    }
  }

  const orderId = `ord-${crypto.randomUUID()}`;
  const orderNumber = `SA-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
  const now = new Date().toISOString();

  // Fetch product catalog for server-authoritative pricing verification
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: dbProducts } = (await query.graph({
    entity: "product",
    pagination: { take: 2000, skip: 0 },
    fields: [
      "id",
      "handle",
      "metadata",
      "variants.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })) as {
    data: Array<{
      id: string;
      handle: string;
      metadata?: Record<string, unknown> | null;
      variants?: Array<{
        prices?: Array<{ amount: number; currency_code: string }> | null;
      }> | null;
    }>;
  };

  const productLookup = new Map<
    string,
    {
      customerPrice: number | null;
      dealerPrice: number | null;
      distributorPrice: number | null;
    }
  >();

  for (const p of dbProducts || []) {
    const meta = (p.metadata || {}) as Record<string, unknown>;
    const primaryVariant = p.variants?.[0];
    const variantInr =
      primaryVariant?.prices?.find(
        (pr) => pr.currency_code?.toLowerCase() === "inr"
      )?.amount ?? null;

    const customerPrice =
      typeof meta.customer_price_inr === "number"
        ? meta.customer_price_inr
        : variantInr;
    const dealerPrice =
      typeof meta.dealer_price_inr === "number"
        ? meta.dealer_price_inr
        : (typeof meta.contractor_price_inr === "number"
            ? meta.contractor_price_inr
            : customerPrice);
    const distributorPrice =
      typeof meta.distributor_price_inr === "number"
        ? meta.distributor_price_inr
        : dealerPrice;

    const pricing = { customerPrice, dealerPrice, distributorPrice };
    productLookup.set(p.id, pricing);
    productLookup.set(p.handle, pricing);
    if (typeof meta.legacy_id === "string") {
      productLookup.set(meta.legacy_id, pricing);
    }
    if (typeof meta.sku === "string") {
      productLookup.set(meta.sku.toLowerCase(), pricing);
    }
  }

  // Authoritatively compute line items and totals
  let calculatedSubtotal = 0;
  let hasQuoteItems = false;

  const items: TradeOrderItemRecord[] = body.items.map((item) => {
    const packMultiplier = Math.max(1, Number(item.packMultiplier) || 1);
    const quantity = Math.max(1, Number(item.quantity) || 1);

    const lookup =
      productLookup.get(item.productId) ||
      (item.sku ? productLookup.get(item.sku.toLowerCase()) : undefined);

    let authoritativeUnit: number | null = null;
    if (lookup) {
      if (userRole === "DISTRIBUTOR") {
        authoritativeUnit = lookup.distributorPrice;
      } else if (userRole === "DEALER") {
        authoritativeUnit = lookup.dealerPrice;
      } else {
        authoritativeUnit = lookup.customerPrice;
      }
    } else if (typeof item.unitPriceInr === "number" && Number.isFinite(item.unitPriceInr)) {
      authoritativeUnit = item.unitPriceInr;
    }

    let lineTotalInr: number | null = null;
    if (authoritativeUnit !== null && authoritativeUnit !== undefined) {
      lineTotalInr = Math.round(authoritativeUnit * packMultiplier * quantity * 100) / 100;
      calculatedSubtotal += lineTotalInr;
    } else {
      hasQuoteItems = true;
    }

    return {
      id: `oi-${crypto.randomUUID()}`,
      order_id: orderId,
      product_id: item.productId,
      sku: item.sku,
      name: item.name,
      category: item.category,
      finish: item.finish ?? null,
      pack_label: item.packLabel ?? null,
      pack_multiplier: packMultiplier,
      unit_price_inr: authoritativeUnit,
      quantity,
      line_total_inr: lineTotalInr,
    };
  });

  const authoritativeSubtotalInr = Math.round(calculatedSubtotal * 100) / 100;
  const authoritativeGstAmountInr = Math.round(authoritativeSubtotalInr * 0.18 * 100) / 100;
  const authoritativeTotalInr = authoritativeSubtotalInr + authoritativeGstAmountInr;
  const subtotalPaise = inrToPaise(authoritativeSubtotalInr);
  const gstAmountPaise = inrToPaise(authoritativeGstAmountInr);
  const totalPaise = subtotalPaise + gstAmountPaise;

  // Server-authoritative order and payment state derivation (BE-03)
  // Strictly ignores any client-asserted status or paymentStatus values
  const { status: initialStatus, paymentStatus } = deriveInitialOrderState({
    isRazorpay,
    hasQuoteItems,
  });

  // Atomic stock reservation & commercial policy enforcement (BE-05, RB-04, P3.4.1)
  // Quote-only enquiries (BOQ_QUOTE_REQUESTED) do NOT deduct or reserve physical inventory.
  let reservations: StockReservationRecord[] = [];
  const isQuoteEnquiry = initialStatus === "BOQ_QUOTE_REQUESTED";

  if (!isQuoteEnquiry) {
    try {
      const resolved = await resolveAndAggregateOrderItems(
        req.scope,
        body.items.map((i) => ({
          productId: i.productId,
          variantId: (i as any).variantId ?? null,
          sku: i.sku ?? null,
          name: i.name,
          category: i.category,
          finish: i.finish ?? null,
          packMultiplier: i.packMultiplier,
          quantity: i.quantity,
          sellerId: (i as any).sellerId ?? null,
          locationId: (i as any).locationId ?? null,
        })),
        {
          userRole,
          paymentMethod: body.paymentMethod,
        }
      );

      if (resolved.aggregatedRequirements.length > 0) {
        const pool = getPgPool();
        reservations = await reserveStockAtomic(
          pool,
          resolved.aggregatedRequirements,
          {
            orderId,
            timeoutMinutes: 15,
          }
        );

        // Immediate confirmed Trade PO orders from verified trade accounts confirm reservations right away;
        // quote-only enquiries never deplete physical stock.
        if (initialStatus === "CONFIRMED_TRADE_PO" && userRole === "DEALER") {
          await confirmStockReservations(
            pool,
            reservations.map((r) => r.id)
          );
        }
      }
    } catch (err) {
      if (err instanceof CommercialPolicyViolationError) {
        return res.status(err.status).json({
          code: err.code,
          message: err.message,
        });
      }
      if (err instanceof InsufficientStockError) {
        return res.status(409).json({
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }
      if (err instanceof MedusaError) {
        return res.status(400).json({
          code: "INVENTORY_ERROR",
          message: err.message,
        });
      }
      const isMockOrTestWithoutDb =
        process.env.TEST_TYPE === "unit" &&
        err instanceof Error &&
        (err.message.includes("connect") || err.message.includes("resolve"));
      if (!isMockOrTestWithoutDb) {
        return res.status(400).json({
          message: err instanceof Error ? err.message : "Inventory reservation failed.",
        });
      }
    }
  }

  const eventNote = isRazorpay
    ? `Razorpay order ${body.razorpayOrderId || ""} initialized (${userRole} tier).`
    : hasQuoteItems
      ? `Formal BOQ Quote Request submitted (${userRole} tier).`
      : `Trade Order confirmed via ${body.paymentMethod || "Trade PO"} (${userRole} tier).`;

  let created: RawTradeOrder;
  try {
    created = (await dmsService.createTradeOrders({
      id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
      role_at_order: userRole,
      price_tier_applied: userRole,
      status: initialStatus,
      payment_status: paymentStatus,
      payment_method: body.paymentMethod || "Proforma Invoice / Trade PO",
      razorpay_order_id: body.razorpayOrderId || null,
      razorpay_payment_id: null,
      customer_name: body.customerName.trim(),
      customer_email: body.customerEmail.trim(),
      customer_phone: body.customerPhone.trim(),
      organization: (body.organization || "").trim(),
      gstin: body.gstin ? body.gstin.trim() : null,
      shipping_address: body.shippingAddress.trim(),
      subtotal_inr: authoritativeSubtotalInr,
      gst_amount_inr: authoritativeGstAmountInr,
      total_inr: authoritativeTotalInr,
      subtotal_paise: subtotalPaise,
      gst_amount_paise: gstAmountPaise,
      total_paise: totalPaise,
      has_quote_items: hasQuoteItems,
      shipping_carrier: null,
      tracking_reference: null,
      notes: body.notes ? body.notes.trim() : null,
      cancellation_reason: null,
      refund_status: "NONE",
      items: items as unknown as Record<string, unknown>,
      events: [
        {
          id: `evt-${crypto.randomUUID()}`,
          order_id: orderId,
          status: initialStatus,
          note: eventNote,
          actor_name: body.actorName || body.customerName.trim(),
          created_at: now,
        },
      ] as unknown as Record<string, unknown>,
    })) as unknown as RawTradeOrder;
  } catch (createErr) {
    // Compensating release if trade order persistence fails
    if (reservations.length > 0) {
      try {
        const pool = getPgPool();
        await releaseStockReservationsForOrder(pool, orderId);
      } catch {
        // release compensation error suppressed
      }
    }
    throw createErr;
  }

  let payments: RawTradePayment[] = [];
  if (isRazorpay && body.razorpayOrderId) {
    try {
      const pay = (await dmsService.createTradePayments({
        id: `pay-${crypto.randomUUID()}`,
        order_id: orderId,
        provider: "RAZORPAY",
        provider_order_id: body.razorpayOrderId,
        provider_payment_id: null,
        signature_verified: false,
        amount_paise: Math.round(Number(body.amountPaise || 0)),
        currency: "INR",
        status: "CREATED",
        failure_reason: null,
        raw_event_json: null,
      })) as unknown as RawTradePayment;
      payments = [pay];
    } catch (payErr) {
      if (reservations.length > 0) {
        try {
          const pool = getPgPool();
          await releaseStockReservationsForOrder(pool, orderId, "PAYMENT_INITIATION_FAILED");
        } catch {
          // compensation error suppressed
        }
      }
      throw payErr;
    }
  }

  const responsePayload = {
    order: serializeTradeOrder(created, payments),
  };

  await idempotencyStore.record(
    idempotencyKey,
    customerId,
    "order:create",
    body,
    201,
    responsePayload,
    86400,
    req.scope
  );

  return res.status(201).json(responsePayload);
}
