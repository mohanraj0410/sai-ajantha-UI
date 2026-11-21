import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { checkStaffPermission } from "../../../../lib/permissions";
import { MediaUploadService, MediaStatus, MediaType } from "../../../../services/media-upload.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  try {
    const q = req.query as Record<string, string | undefined>;
    const sku = q.sku;
    const status = q.status as MediaStatus | undefined;
    const mediaType = q.mediaType as MediaType | undefined;
    const limit = q.limit ? Number(q.limit) : 50;
    const offset = q.offset ? Number(q.offset) : 0;

    const result = await MediaUploadService.listMedia({
      sku,
      status,
      mediaType,
      limit,
      offset,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({
      code: "LIST_MEDIA_FAILED",
      message: err.message,
    });
  }
}
