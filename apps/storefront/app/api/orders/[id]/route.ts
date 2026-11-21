import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  cancelOrderInMedusaStrict,
  getOrderFromMedusaStrict,
} from "@/lib/server/medusa";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  const res = await getOrderFromMedusaStrict(
    auth.user.role,
    auth.medusaToken,
    id
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ order: res.order });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  const body = (await request.json()) as {
    action?: string;
    reason?: string;
  };

  if (body.action !== "CANCEL") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const res = await cancelOrderInMedusaStrict(
    auth.user.role,
    auth.medusaToken,
    id,
    {
      reason: (body.reason || "Cancelled by customer").trim(),
      actorName: auth.user.name,
    }
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    status: res.status || "CANCELLED",
    refundStatus: res.refundStatus,
  });
}
