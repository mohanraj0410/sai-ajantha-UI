import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const distributorId = req.query.distributorId ? String(req.query.distributorId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const coverages = await DistributorLifecycleService.listCoverages(pool, {
      distributorId,
      status,
    });

    return res.json({ coverages });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "INTERNAL_ERROR",
      message: err.message,
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const staffId = req.staff_user?.id || req.auth_context?.actor_id || "staff_admin";
    const body = req.body as {
      distributorId: string;
      postalCode: string;
      categorySlug: string;
      notes?: string;
    };

    const coverage = await DistributorLifecycleService.assignCoverage(pool, {
      ...body,
      assignedBy: staffId,
    });

    return res.status(201).json({ coverage });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "ASSIGN_COVERAGE_FAILED",
      message: err.message,
    });
  }
}
