import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const poId = req.params.id;
    const body = req.body as {
      distributorId: string;
      lines: unknown[];
      inspectionNotes?: string;
      inspectionEvidenceUrls?: string[];
    };

    if (!body?.distributorId || !Array.isArray(body?.lines)) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "distributorId and lines array are required.",
      });
    }

    const verifiedBy = req.staff_user?.id || req.auth_context?.actor_id || body.distributorId;

    const result = await DistributorLifecycleService.processWarehouseReceipt(pool, {
      poId,
      distributorId: body.distributorId,
      lines: body.lines,
      inspectionNotes: body.inspectionNotes,
      inspectionEvidenceUrls: body.inspectionEvidenceUrls,
      verifiedBy,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "RECEIPT_PROCESSING_FAILED",
      message: err.message,
    });
  }
}
