import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const distributorId = req.params.id;

    const report = await DistributorLifecycleService.getInventoryReconciliationReport(
      pool,
      distributorId
    );

    return res.json({ report });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "RECONCILIATION_REPORT_FAILED",
      message: err.message,
    });
  }
}
