import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  createOrderInMedusaStrict,
  listOrdersFromMedusaStrict,
} from "@/lib/server/medusa";
import {
  MedusaUnavailableError,
  computeAuthoritativeOrderQuote,
  type CartQuoteRequestItem,
} from "@/lib/server/pricing";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const res = await listOrdersFromMedusaStrict(auth.user.role, auth.medusaToken);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ orders: res.orders });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Administrator sessions cannot place storefront orders. Sign in with a customer or trade account.",
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
      paymentMethod?: string;
      notes?: string;
    };

    const customerName = (body.customerName || auth.user.name).trim();
    const customerEmail = (body.customerEmail || auth.user.email).trim();
    const customerPhone = (body.customerPhone || auth.user.phone).trim();
    const shippingAddress = (body.shippingAddress || "").trim();
    const paymentMethod = (
      body.paymentMethod || "Proforma Invoice / Trade PO"
    ).trim();

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress) {
      return NextResponse.json(
        {
          error:
            "Contact name, email, phone number, and shipping address are required.",
        },
        { status: 400 }
      );
    }

    if (paymentMethod === "Razorpay Online Checkout") {
      return NextResponse.json(
        {
          error:
            "Use /api/payments/razorpay/order for Razorpay Online Checkout.",
        },
        { status: 400 }
      );
    }

    const quote = await computeAuthoritativeOrderQuote(
      body.items || [],
      auth.user,
      { validateStock: true }
    );

    const idemKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      (body as any).checkoutIntentId ||
      undefined;

    const res = await createOrderInMedusaStrict(
      auth.medusaToken,
      {
        roleAtOrder: auth.user.role,
        priceTierApplied: quote.priceTierApplied,
        status: quote.hasQuoteItems
          ? "BOQ_QUOTE_REQUESTED"
          : "CONFIRMED_TRADE_PO",
        paymentStatus: "PENDING_OFFLINE_SETTLEMENT",
        paymentMethod,
        customerName,
        customerEmail,
        customerPhone,
        organization: (body.organization || auth.user.organization).trim(),
        gstin: (body.gstin || auth.user.gstin || "").trim() || null,
        shippingAddress,
        subtotalInr: quote.subtotalInr,
        gstAmountInr: quote.gstAmountInr,
        totalInr: quote.totalInr,
        hasQuoteItems: quote.hasQuoteItems,
        notes: (body.notes || "").trim() || null,
        actorName: auth.user.name,
        items: quote.items,
        checkoutIntentId: idemKey,
      },
      idemKey
    );

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json({ order: res.order }, { status: 201 });
  } catch (err) {
    const status = err instanceof MedusaUnavailableError ? err.status : 400;
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create order.",
      },
      { status }
    );
  }
}
