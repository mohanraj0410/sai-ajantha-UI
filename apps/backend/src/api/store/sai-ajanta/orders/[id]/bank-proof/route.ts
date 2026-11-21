import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { OrderLifecycleService } from "../../../../../../services/order-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = req.params.id;
    const body = (req.body || {}) as { bankReference?: string; notes?: string };
    const customerId = req.auth_context?.actor_id;

    if (!body.bankReference || !body.bankReference.trim()) {
      return res.status(400).json({
        code: "BANK_REFERENCE_REQUIRED",
        message: "bankReference (UTR) is required.",
      });
    }

    const pool = getPgPool();

    // Verify tenant ownership: order must belong to the caller if customer
    if (customerId) {
      const client = await pool.connect();
      try {
        const orderRes = await client.query(
          `SELECT customer_id FROM "dms_trade_order" WHERE id = $1`,
          [orderId]
        );
        if (orderRes.rows.length === 0) {
          return res.status(404).json({ code: "ORDER_NOT_FOUND", message: "Order not found." });
        }
        if (orderRes.rows[0].customer_id && orderRes.rows[0].customer_id !== customerId) {
          return res.status(403).json({
            code: "FORBIDDEN_ORDER_ACCESS",
            message: "Cannot submit payment proof for another customer's order.",
          });
        }
      } finally {
        client.release();
      }
    }

    const result = await OrderLifecycleService.executeOrderCommand(pool, {
      orderId,
      command: "SUBMIT_BANK_PROOF",
      actorRole: "CUSTOMER",
      actorId: customerId || "guest",
      bankReference: body.bankReference.trim(),
      notes: body.notes,
    });

    return res.json({ transition: result });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "BANK_PROOF_FAILED",
      message: err.message,
    });
  }
}
