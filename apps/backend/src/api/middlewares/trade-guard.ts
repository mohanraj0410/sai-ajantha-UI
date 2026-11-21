import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../lib/db";
import { assertDisposableDbConnection } from "../../lib/disposable-db-guard";

export interface VerifiedTradeAccount {
  id: string;
  customer_id: string;
  role: "DEALER" | "DISTRIBUTOR" | "CUSTOMER";
  status: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "REJECTED";
  business_name?: string | null;
  gst_number?: string | null;
  territory?: string | null;
  stock_location_id?: string | null;
}

export async function verifyTradeActor(
  req: MedusaRequest,
  res: MedusaResponse,
  requiredRole?: "DEALER" | "DISTRIBUTOR"
): Promise<VerifiedTradeAccount | null> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authentication required as a registered trade account.",
    });
    return null;
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await assertDisposableDbConnection(client);
    const profRes = await client.query(
      `SELECT id, customer_id, role, status, business_name, gst_number, territory, stock_location_id
       FROM "account_profile" 
       WHERE (customer_id = $1 OR id = $1) AND deleted_at IS NULL LIMIT 1`,
      [customerId]
    );

    if (profRes.rows.length === 0) {
      res.status(403).json({
        code: "TRADE_PROFILE_NOT_FOUND",
        message: "No trade account profile found for this authenticated user.",
      });
      return null;
    }

    const prof = profRes.rows[0] as VerifiedTradeAccount;
    const roleUpper = (prof.role || "").toUpperCase();
    const statusUpper = (prof.status || "").toUpperCase();

    if (requiredRole && roleUpper !== requiredRole) {
      res.status(403).json({
        code: "INSUFFICIENT_TRADE_ROLE",
        message: `Access forbidden: Operation requires ${requiredRole} account (current role: ${roleUpper}).`,
      });
      return null;
    }

    if (statusUpper !== "ACTIVE") {
      res.status(403).json({
        code: "ACCOUNT_NOT_ACTIVE",
        message: `Trade account is currently ${statusUpper}. Active account status is required for trade operations.`,
      });
      return null;
    }

    return prof;
  } finally {
    client.release();
  }
}
