import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const coverageId = req.params.id;
    const staffId = req.staff_user?.id || req.auth_context?.actor_id || "staff_admin";
    const body = (req.body || {}) as { reason?: string };

    const success = await DistributorLifecycleService.revokeCoverage(
      pool,
      coverageId,
      staffId,
      body.reason
    );

    if (!success) {
      return res.status(404).json({
        code: "COVERAGE_NOT_FOUND",
        message: `Active coverage record '${coverageId}' not found.`,
      });
    }

    return res.json({ success: true, message: `Coverage '${coverageId}' revoked.` });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "REVOKE_COVERAGE_FAILED",
      message: err.message,
    });
  }
}
