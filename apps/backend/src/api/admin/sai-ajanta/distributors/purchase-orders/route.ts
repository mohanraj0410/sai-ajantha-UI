import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../services/distributor-lifecycle.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const distributorId = req.query.distributorId ? String(req.query.distributorId) : undefined;
    const client = await pool.connect();
    try {
      const params: any[] = [];
      const where: string[] = ["deleted_at IS NULL"];
      if (distributorId) {
        params.push(distributorId);
        where.push(`distributor_id = $${params.length}`);
      }
      const result = await client.query(
        `SELECT * FROM "dms_distributor_po" WHERE ${where.join(" AND ")} ORDER BY created_at DESC`,
        params
      );
      return res.json({ purchaseOrders: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "FETCH_PO_FAILED",
      message: err.message,
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const body = req.body as {
      distributorId: string;
      destinationLocationId?: string;
      items: { sku: string; qty: number }[];
      notes?: string;
    };

    const po = await DistributorLifecycleService.createPurchaseOrder(pool, body);
    return res.status(201).json({ purchaseOrder: po });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "CREATE_PO_FAILED",
      message: err.message,
    });
  }
}
