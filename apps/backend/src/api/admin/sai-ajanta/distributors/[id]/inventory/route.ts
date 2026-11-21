import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const targetDistributorId = req.params.id;
    const callerRole = req.staff_user ? "STAFF" : req.auth_context?.actor_type === "customer" ? "DISTRIBUTOR" : "STAFF";
    const callerDistributorId = req.auth_context?.actor_id;

    const inventory = await DistributorLifecycleService.getDistributorInventory(
      pool,
      targetDistributorId,
      {
        role: callerRole,
        distributorId: callerDistributorId,
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
