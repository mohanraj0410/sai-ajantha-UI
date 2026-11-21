import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const poId = req.params.id;
    const staffId = req.staff_user?.id || req.auth_context?.actor_id || "staff_finance";

    const updatedPo = await DistributorLifecycleService.financeApprovePayment(
      pool,
      poId,
      staffId
    );

    return res.json({ purchaseOrder: updatedPo });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "FINANCE_APPROVE_FAILED",
      message: err.message,
    });
  }
}
