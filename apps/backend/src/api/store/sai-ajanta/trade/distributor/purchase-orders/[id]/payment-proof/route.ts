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
    const body = (req.body || {}) as { utrReference?: string };

    if (!body?.utrReference || !body.utrReference.trim()) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "utrReference is required.",
      });
    }

    const updatedPo = await DistributorLifecycleService.submitPaymentProof(
      pool,
      poId,
      tradeAccount.customer_id,
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
