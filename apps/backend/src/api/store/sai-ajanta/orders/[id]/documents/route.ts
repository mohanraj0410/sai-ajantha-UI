import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const orderId = req.params.id;
    const customerId = req.auth_context?.actor_id;
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
            message: "Cannot access documents for another customer's order.",
          });
        }
      } finally {
        client.release();
      }
    }

    const result = await pool.query(
      `SELECT id, doc_number, doc_type, order_id, seller_id, buyer_email, total_paise, tax_paise, document_payload, disclaimer, created_at
       FROM "dms_financial_document"
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );

    return res.json({ documents: result.rows });
  } catch (err: any) {
    return res.status(500).json({
      code: "FETCH_DOCUMENTS_FAILED",
      message: err.message,
    });
  }
}
