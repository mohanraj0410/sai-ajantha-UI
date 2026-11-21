import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { verifyTradeActor } from "../../../../../middlewares/trade-guard";
import { DistributorLifecycleService } from "../../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tradeAccount = await verifyTradeActor(req, res, "DISTRIBUTOR");
  if (!tradeAccount) return;

  try {
    const pool = getPgPool();
    // Strictly scoped to the verified trade account (tenant isolation)
    const inventory = await DistributorLifecycleService.getDistributorInventory(
      pool,
      tradeAccount.customer_id,
      {
        role: "DISTRIBUTOR",
        distributorId: tradeAccount.customer_id,
      }
    );

    return res.json({ inventory });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "FETCH_INVENTORY_FAILED",
      message: err.message,
    });
  }
}
