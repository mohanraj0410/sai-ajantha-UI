import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../../lib/db";
import { checkStaffPermission } from "../../../../../../../lib/permissions";
import { OrderLifecycleService } from "../../../../../../../services/order-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
      return;
    }

    const returnId = req.params.id;
    const body = (req.body || {}) as {
      inspectedQtyAccepted?: number;
      inspectedQtyScrapped?: number;
      notes?: string;
    };

    if (body.inspectedQtyAccepted === undefined || body.inspectedQtyScrapped === undefined) {
      return res.status(400).json({
        code: "INSPECTION_COUNTS_REQUIRED",
        message: "inspectedQtyAccepted and inspectedQtyScrapped are required.",
      });
    }

    const pool = getPgPool();
    const result = await OrderLifecycleService.inspectReturn(pool, {
      returnId,
      inspectedQtyAccepted: Number(body.inspectedQtyAccepted),
      inspectedQtyScrapped: Number(body.inspectedQtyScrapped),
      staffId: req.auth_context?.actor_id || "staff_admin",
      notes: body.notes,
    });

    return res.json({ inspection: result });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "INSPECTION_FAILED",
      message: err.message,
    });
  }
}
