import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { createOrderInMedusaStrict } from "@/lib/server/medusa";
import {
  MedusaUnavailableError,
  computeAuthoritativeOrderQuote,
  type CartQuoteRequestItem,
} from "@/lib/server/pricing";
import {
  createRazorpayOrderRecord,
  generateTestModePaymentSignature,
} from "@/lib/server/razorpay";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Administrator sessions cannot initiate checkout. Sign in with a customer or trade account.",
      },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as {
      items?: CartQuoteRequestItem[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      organization?: string;
      gstin?: string;
      shippingAddress?: string;
      notes?: string;
    };

    const customerName = (body.customerName || auth.user.name).trim();
    const customerEmail = (body.customerEmail || auth.user.email).trim();
    const customerPhone = (body.customerPhone || auth.user.phone).trim();
    const shippingAddress = (body.shippingAddress || "").trim();

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
      return NextResponse.json(
        {
          error:
            "Contact name, email, phone number, and shipping address are required.",
        },
        { status: 400 }
      );
    }

    const quote = await computeAuthoritativeOrderQuote(
      body.items || [],
      auth.user,
      { validateStock: true }
    );

    if (quote.hasQuoteItems || quote.totalInr <= 0) {
      return NextResponse.json(
        {
          error:
            "Online Razorpay checkout is available only for items with verified pricing. Please submit as a Formal BOQ Quote for custom-priced items.",
        },
        { status: 400 }
      );
    }

    const amountPaise = Math.round(quote.totalInr * 100);
    const receiptRef = `SA-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const rzpOrder = await createRazorpayOrderRecord({
      amountPaise,
      receipt: receiptRef,
      notes: {
        userId: auth.user.id,
        tier: quote.priceTierApplied,
      },
    });

    const idemKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      (body as any).checkoutIntentId ||
      rzpOrder.providerOrderId;

    const createdRes = await createOrderInMedusaStrict(
      auth.medusaToken,
      {
        roleAtOrder: auth.user.role,
        priceTierApplied: quote.priceTierApplied,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentMethod: "Razorpay Online Checkout",
        razorpayOrderId: rzpOrder.providerOrderId,
        amountPaise: rzpOrder.amountPaise,
        customerName,
        customerEmail,
        customerPhone,
        organization: (body.organization || auth.user.organization).trim(),
        gstin: (body.gstin || auth.user.gstin || "").trim() || null,
        shippingAddress,
        subtotalInr: quote.subtotalInr,
        gstAmountInr: quote.gstAmountInr,
        totalInr: quote.totalInr,
        hasQuoteItems: false,
        notes: (body.notes || "").trim() || null,
        actorName: auth.user.name,
        items: quote.items,
        checkoutIntentId: idemKey,
      },
      idemKey
    );

    if (!createdRes.ok) {
      return NextResponse.json(
        { error: createdRes.error },
        { status: createdRes.status }
      );
    }

    const createdOrder = createdRes.order as {
      id: string;
      order_number: string;
    };

    const testPaymentId = rzpOrder.testMode
      ? `pay_test_${crypto.randomBytes(8).toString("hex")}`
      : undefined;
    const testSignature =
      rzpOrder.testMode && testPaymentId
        ? generateTestModePaymentSignature(rzpOrder.providerOrderId, testPaymentId)
        : undefined;

    return NextResponse.json(
      {
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        razorpayOrderId: rzpOrder.providerOrderId,
        amountPaise: rzpOrder.amountPaise,
        currency: rzpOrder.currency,
        keyId: rzpOrder.publicKeyId,
        testMode: rzpOrder.testMode,
        testPaymentId,
        testSignature,
        pricing: {
          tier: quote.priceTierApplied,
          subtotalInr: quote.subtotalInr,
          gstAmountInr: quote.gstAmountInr,
          totalInr: quote.totalInr,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const status = err instanceof MedusaUnavailableError ? err.status : 400;
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to initialize Razorpay order.",
      },
      { status }
    );
  }
}
