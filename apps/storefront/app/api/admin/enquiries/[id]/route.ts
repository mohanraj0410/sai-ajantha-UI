import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { updateAdminEnquiryInMedusaStrict } from "@/lib/server/medusa";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  const body = (await request.json()) as { status?: string };
  const nextStatus = (body.status || "").toUpperCase();

  if (!["NEW", "IN_REVIEW", "QUOTED", "CLOSED"].includes(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid enquiry status." },
      { status: 400 }
    );
  }

  const res = await updateAdminEnquiryInMedusaStrict(
    auth.medusaToken,
    id,
    nextStatus
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
