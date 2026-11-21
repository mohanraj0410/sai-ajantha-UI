import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const poId = req.params.id;
    const body = req.body as {
      distributorId: string;
      utrReference: string;
    };

    if (!body?.distributorId || !body?.utrReference) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "distributorId and utrReference are required.",
      });
    }

    const updatedPo = await DistributorLifecycleService.submitPaymentProof(
      pool,
      poId,
      body.distributorId,
      body.utrReference
    );

    return res.json({ purchaseOrder: updatedPo });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "SUBMIT_PAYMENT_PROOF_FAILED",
      message: err.message,
    });
  }
}
