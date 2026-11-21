import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { checkStaffPermission } from "../../../../../lib/permissions";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { MediaUploadService, MediaType } from "../../../../../services/media-upload.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  try {
    const body = (req.body || {}) as {
      sku?: string;
      fileName?: string;
      fileType?: string;
      fileContentBase64?: string;
      mediaType?: MediaType;
      caption?: string;
    };

    if (!body.sku || !body.fileName || !body.fileContentBase64 || !body.fileType) {
      return res.status(400).json({
        code: "INVALID_UPLOAD_PAYLOAD",
        message: "Missing required fields: sku, fileName, fileType, fileContentBase64.",
      });
    }

    const reviewerEmail = (req as any).staff_user?.email || "staff@sai-ajanta.com";
    const uploaded = await MediaUploadService.uploadMedia({
      sku: body.sku,
      fileName: body.fileName,
      fileType: body.fileType,
      fileContentBase64: body.fileContentBase64,
      mediaType: body.mediaType || (body.fileType.includes("pdf") ? "TECHNICAL_PDF" : "IMAGE"),
      caption: body.caption,
      uploadedBy: reviewerEmail,
    });

    await recordDurableAuditEvent(
      req,
      "MEDIA_UPLOADED",
      `dms_media_upload:${uploaded.id}`,
      {
        sku: uploaded.sku,
        fileName: uploaded.fileName,
        mediaType: uploaded.mediaType,
        status: uploaded.status,
      }
    );

    return res.status(201).json({
      media: uploaded,
      message: "Media file uploaded to quarantine staging. Pending staff review and approval.",
    });
  } catch (err: any) {
    return res.status(400).json({
      code: "MEDIA_UPLOAD_FAILED",
      message: err.message,
    });
  }
}
