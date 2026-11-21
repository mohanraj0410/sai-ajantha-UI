import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { verifyTradeActor } from "../../../../../middlewares/trade-guard";
import { DistributorLifecycleService } from "../../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const tradeAccount = await verifyTradeActor(req, res, "DISTRIBUTOR");
  if (!tradeAccount) return;

  try {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM "dms_distributor_po" 
         WHERE distributor_id = $1 AND deleted_at IS NULL 
         ORDER BY created_at DESC`,
        [tradeAccount.customer_id]
      );
      return res.json({ purchaseOrders: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "FETCH_TRADE_PO_FAILED",
      message: err.message,
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const tradeAccount = await verifyTradeActor(req, res, "DISTRIBUTOR");
  if (!tradeAccount) return;

  try {
    const pool = getPgPool();
    const body = (req.body || {}) as {
      destinationLocationId?: string;
      items: { sku: string; qty: number }[];
      notes?: string;
    };

    // Server-enforced distributor ID from verified session (prevents tenant impersonation)
    const po = await DistributorLifecycleService.createPurchaseOrder(pool, {
      distributorId: tradeAccount.customer_id,
      destinationLocationId: body.destinationLocationId || tradeAccount.stock_location_id || undefined,
      items: body.items,
      notes: body.notes,
    });

    return res.status(201).json({ purchaseOrder: po });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "CREATE_TRADE_PO_FAILED",
      message: err.message,
    });
  }
}
