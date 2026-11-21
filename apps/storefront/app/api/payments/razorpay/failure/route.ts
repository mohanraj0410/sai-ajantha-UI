import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { updateOrderPaymentInMedusaStrict } from "@/lib/server/medusa";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      razorpayOrderId?: string;
      reason?: string;
    };

    const orderId = (body.orderId || "").trim();
    const razorpayOrderId = (body.razorpayOrderId || "").trim();
    const reason = (
      body.reason || "Payment cancelled or declined by gateway"
    ).trim();

    if (!orderId || !razorpayOrderId) {
      return NextResponse.json(
        { error: "orderId and razorpayOrderId are required." },
        { status: 400 }
      );
    }

    const res = await updateOrderPaymentInMedusaStrict(
      auth.medusaToken,
      orderId,
      {
        action: "FAIL",
        razorpayOrderId,
        reason,
        actorName: auth.user.name,
      }
    );
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json({ ok: true, paymentStatus: "FAILED" });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to record failure.",
      },
      { status: 500 }
    );
  }
}
