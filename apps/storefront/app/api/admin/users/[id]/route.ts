import { NextResponse } from "next/server";
import { requireAdminUser, type ApprovalStatus } from "@/lib/server/auth";
import { updateMedusaCustomerDmsStatusStrict } from "@/lib/server/medusa";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  const body = (await request.json()) as {
    approvalStatus?: string;
    rejectionReason?: string;
  };

  const nextStatus = (body.approvalStatus || "").toUpperCase() as ApprovalStatus;
  if (!["APPROVED", "REJECTED", "PENDING_APPROVAL"].includes(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid approvalStatus value." },
      { status: 400 }
    );
  }

  const rejectionReason =
    nextStatus === "REJECTED"
      ? (body.rejectionReason || "Application declined by administrator.").trim()
      : null;

  const medusaStatus =
    nextStatus === "APPROVED"
      ? "ACTIVE"
      : nextStatus === "REJECTED"
        ? "SUSPENDED"
        : "PENDING_APPROVAL";

  const medusaSync = await updateMedusaCustomerDmsStatusStrict(
    auth.medusaToken,
    id,
    {
      status: medusaStatus,
      rejectionReason,
    }
  );
  if (!medusaSync.ok) {
    return NextResponse.json(
      { error: medusaSync.error },
      { status: medusaSync.status }
    );
  }

  return NextResponse.json({
    user: {
      id,
      approvalStatus: nextStatus,
      rejectionReason,
    },
  });
}
