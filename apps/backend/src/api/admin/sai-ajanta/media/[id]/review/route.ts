import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { checkStaffPermission } from "../../../../../../lib/permissions";
import { recordDurableAuditEvent } from "../../../../../../lib/audit-logger";
import { MediaUploadService } from "../../../../../../services/media-upload.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const { id } = req.params;
  const body = (req.body || {}) as {
    action?: "APPROVE" | "REJECT";
    reviewNotes?: string;
  };

  if (!body.action || (body.action !== "APPROVE" && body.action !== "REJECT")) {
    return res.status(400).json({
      code: "INVALID_REVIEW_ACTION",
      message: "Action must be either 'APPROVE' or 'REJECT'.",
    });
  }

  try {
    const reviewerEmail = (req as any).staff_user?.email || "staff@sai-ajanta.com";
    const reviewed = await MediaUploadService.reviewMedia({
      mediaId: id,
      action: body.action,
      reviewerEmail,
      reviewNotes: body.reviewNotes,
    });

    await recordDurableAuditEvent(
      req,
      body.action === "APPROVE" ? "MEDIA_APPROVED" : "MEDIA_REJECTED",
      `dms_media_upload:${reviewed.id}`,
      {
        sku: reviewed.sku,
        action: body.action,
        status: reviewed.status,
        publicUrl: reviewed.publicUrl,
      }
    );

    return res.status(200).json({
      media: reviewed,
      message: `Media successfully marked as ${reviewed.status}.`,
    });
  } catch (err: any) {
    return res.status(400).json({
      code: "MEDIA_REVIEW_FAILED",
      message: err.message,
    });
  }
}
