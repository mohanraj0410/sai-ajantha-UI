import { NextResponse } from "next/server";
import { forwardRazorpayWebhookToMedusaStrict } from "@/lib/server/medusa";
import { verifyRazorpayWebhookSignature } from "@/lib/server/razorpay";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "Invalid Razorpay webhook signature." },
      { status: 401 }
    );
  }

  try {
    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            error_description?: string;
          };
        };
      };
    };

    const eventType = payload.event || "";
    const entity = payload.payload?.payment?.entity;
    const providerOrderId = entity?.order_id;
    const providerPaymentId = entity?.id;

    if (!providerOrderId) {
      return NextResponse.json({ received: true });
    }

    const res = await forwardRazorpayWebhookToMedusaStrict(signature, {
      rawEventJson: rawBody,
      eventType,
      providerOrderId,
      providerPaymentId,
      failureReason: entity?.error_description,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook error." },
      { status: 400 }
    );
  }
}
