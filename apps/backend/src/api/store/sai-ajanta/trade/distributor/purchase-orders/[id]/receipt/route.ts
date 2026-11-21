import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../../lib/db";
import { verifyTradeActor } from "../../../../../../../middlewares/trade-guard";
import { DistributorLifecycleService } from "../../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tradeAccount = await verifyTradeActor(req, res, "DISTRIBUTOR");
  if (!tradeAccount) return;

  try {
    const pool = getPgPool();
    const poId = req.params.id;
    const body = (req.body || {}) as {
      lines: unknown[];
      inspectionNotes?: string;
      inspectionEvidenceUrls?: string[];
    };

    if (!Array.isArray(body?.lines)) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "lines array is required for receipt confirmation.",
      });
    }

    const result = await DistributorLifecycleService.processWarehouseReceipt(pool, {
      poId,
      distributorId: tradeAccount.customer_id,
      lines: body.lines,
      inspectionNotes: body.inspectionNotes,
      inspectionEvidenceUrls: body.inspectionEvidenceUrls,
      verifiedBy: tradeAccount.customer_id,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "RECEIPT_PROCESSING_FAILED",
      message: err.message,
    });
  }
}
