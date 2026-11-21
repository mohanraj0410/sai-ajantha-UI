import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const poId = req.params.id;
    const body = (req.body || {}) as { dispatchReference?: string };
    const dispatchRef = body.dispatchReference || `ASN-${Date.now().toString().slice(-6)}`;

    const updatedPo = await DistributorLifecycleService.allocateAndDispatchPo(
      pool,
      poId,
      dispatchRef
    );

    return res.json({ purchaseOrder: updatedPo });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "ALLOCATE_DISPATCH_FAILED",
      message: err.message,
    });
  }
}
