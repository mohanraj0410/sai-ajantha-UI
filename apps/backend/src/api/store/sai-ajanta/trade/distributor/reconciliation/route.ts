import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { verifyTradeActor } from "../../../../../middlewares/trade-guard";
import { DistributorLifecycleService } from "../../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tradeAccount = await verifyTradeActor(req, res, "DISTRIBUTOR");
  if (!tradeAccount) return;

  try {
    const pool = getPgPool();
    // Strictly scoped to the verified trade account
    const report = await DistributorLifecycleService.getInventoryReconciliationReport(
      pool,
      tradeAccount.customer_id
    );

    return res.json({ report });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "RECONCILIATION_REPORT_FAILED",
      message: err.message,
    });
  }
}
