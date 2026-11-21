import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { OrderLifecycleService } from "../../../../../../services/order-lifecycle.service";
import { checkStaffPermission, hasStaffPermission, StaffPermission } from "../../../../../../lib/permissions";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = req.params.id;
    const body = (req.body || {}) as {
      command: any;
      notes?: string;
      carrierName?: string;
      trackingNumber?: string;
      bankReference?: string;
      verifiedAmountPaise?: number;
      cancellationReason?: string;
    };

    if (!body.command) {
      return res.status(400).json({
        code: "COMMAND_REQUIRED",
        message: "Transition command is required.",
      });
    }

    // Security & Separation of Duties:
    // Bank payment verification and rejection require FINANCE_MANAGE.
    // Fulfillment and cancellation commands require ORDERS_MANAGE.
    const isFinanceCommand =
      body.command === "VERIFY_BANK_PAYMENT" || body.command === "REJECT_BANK_PAYMENT";
    const requiredPermission: StaffPermission = isFinanceCommand
      ? "FINANCE_MANAGE"
      : "ORDERS_MANAGE";

    if (!checkStaffPermission(req, res, requiredPermission)) {
      return;
    }

    // Server-derived actor role: do not trust client assertion
    const metadata = req.staff_user?.metadata || {};
    const userRole = (metadata.role as string) || "admin";
    let actorRole: "STAFF_ADMIN" | "STAFF_FINANCE" | "STAFF_LOGISTICS" = "STAFF_LOGISTICS";
    if (userRole === "admin" || userRole === "super_admin") {
      actorRole = "STAFF_ADMIN";
    } else if (hasStaffPermission(req.staff_user, "FINANCE_MANAGE")) {
      actorRole = "STAFF_FINANCE";
    }

    const pool = getPgPool();
    const result = await OrderLifecycleService.executeOrderCommand(pool, {
      orderId,
      command: body.command,
      actorRole,
      actorId: req.staff_user?.id || req.auth_context?.actor_id || "staff_admin",
      notes: body.notes,
      carrierName: body.carrierName,
      trackingNumber: body.trackingNumber,
      bankReference: body.bankReference,
      verifiedAmountPaise: body.verifiedAmountPaise,
      cancellationReason: body.cancellationReason,
    });

    return res.json({ transition: result });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "TRANSITION_FAILED",
      message: err.message,
    });
  }
}
