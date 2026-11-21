import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const summary = await DistributorLifecycleService.getFinancialSeparationSummary(pool);
    return res.json({ financialSummary: summary });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "FINANCIAL_SUMMARY_FAILED",
      message: err.message,
    });
  }
}
