import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  getOrderFromMedusaStrict,
  updateOrderPaymentInMedusaStrict,
} from "@/lib/server/medusa";
import { verifyRazorpayPaymentSignature } from "@/lib/server/razorpay";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as {
      orderId?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    const orderId = (body.orderId || "").trim();
    const razorpayOrderId = (body.razorpayOrderId || "").trim();
    const razorpayPaymentId = (body.razorpayPaymentId || "").trim();
    const razorpaySignature = (body.razorpaySignature || "").trim();

    if (!orderId || !razorpayOrderId) {
      return NextResponse.json(
        { error: "orderId and razorpayOrderId are required." },
        { status: 400 }
      );
    }

    // Fail-closed verification (SF-02 / Task 02.5):
    // Cryptographic signature and payment ID are strictly required from provider callback.
    // Client-asserted test simulation bypass has been completely removed.
    if (!razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "Missing Razorpay payment ID or signature. Client-asserted capture is rejected." },
        { status: 400 }
      );
    }

    const orderRes = await getOrderFromMedusaStrict(
      auth.user.role,
      auth.medusaToken,
      orderId
    );
    if (!orderRes.ok) {
      return NextResponse.json(
        { error: orderRes.error },
        { status: orderRes.status }
      );
    }

    const order = orderRes.order as {
      razorpay_order_id?: string | null;
      payment_status?: string;
    };

    if (order.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order ID mismatch." },
        { status: 400 }
      );
    }

    if (order.payment_status === "PAID") {
      return NextResponse.json(
        { error: "Duplicate payment rejected: this order is already paid." },
        { status: 409 }
      );
    }

    const isValid = verifyRazorpayPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      const failRes = await updateOrderPaymentInMedusaStrict(
        auth.medusaToken,
        orderId,
        {
          action: "SIGNATURE_FAILED",
          razorpayOrderId,
        }
      );
      if (!failRes.ok && failRes.status >= 500) {
        return NextResponse.json(
          { error: failRes.error },
          { status: failRes.status }
        );
      }
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    const captureRes = await updateOrderPaymentInMedusaStrict(
      auth.medusaToken,
      orderId,
      {
        action: "CAPTURE",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      }
    );
    if (!captureRes.ok) {
      return NextResponse.json(
        { error: captureRes.error },
        { status: captureRes.status }
      );
    }

    return NextResponse.json({
      verified: true,
      orderId,
      razorpayPaymentId,
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Payment verification error.",
      },
      { status: 500 }
    );
  }
}
