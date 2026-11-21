import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { OrderLifecycleService } from "../../../../../../services/order-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = req.params.id;
    const customerId = req.auth_context?.actor_id;
    const body = (req.body || {}) as {
      lineId?: string;
      sku?: string;
      quantity?: number;
      reason?: string;
      customerNotes?: string;
    };

    if (!body.sku || !body.sku.trim()) {
      return res.status(400).json({
        code: "SKU_REQUIRED",
        message: "Product SKU is required for return.",
      });
    }

    if (!body.quantity || body.quantity <= 0) {
      return res.status(400).json({
        code: "INVALID_QUANTITY",
        message: "Return quantity must be greater than zero.",
      });
    }

    if (!body.reason || !body.reason.trim()) {
      return res.status(400).json({
        code: "REASON_REQUIRED",
        message: "Return reason is required.",
      });
    }

    const pool = getPgPool();

    // Verify tenant ownership
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
            message: "Cannot create return for another customer's order.",
          });
        }
      } finally {
        client.release();
      }
    }

    const result = await OrderLifecycleService.requestReturn(pool, {
      orderId,
      lineId: body.lineId || `line_${body.sku}`,
      sku: body.sku.trim(),
      quantity: Number(body.quantity),
      reason: body.reason.trim(),
      customerNotes: body.customerNotes,
    });

    return res.status(201).json({ returnRequest: result });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "RETURN_FAILED",
      message: err.message,
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = req.params.id;
    const customerId = req.auth_context?.actor_id;
    const pool = getPgPool();

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
            message: "Cannot access returns for another customer's order.",
          });
        }
      } finally {
        client.release();
      }
    }

    const result = await pool.query(
      `SELECT * FROM "dms_order_return" WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId]
    );

    return res.json({ returns: result.rows });
  } catch (err: any) {
    return res.status(500).json({
      code: "FETCH_RETURNS_FAILED",
      message: err.message,
    });
  }
}
