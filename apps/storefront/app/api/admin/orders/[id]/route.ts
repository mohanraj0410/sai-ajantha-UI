import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { updateAdminOrderInMedusaStrict } from "@/lib/server/medusa";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: string;
    paymentStatus?: string;
    shippingCarrier?: string | null;
    trackingReference?: string | null;
    refundStatus?: string;
    eventNote?: string;
  };

  const res = await updateAdminOrderInMedusaStrict(auth.medusaToken, id, {
    ...body,
    actorName: auth.user.name,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ order: res.order });
}
