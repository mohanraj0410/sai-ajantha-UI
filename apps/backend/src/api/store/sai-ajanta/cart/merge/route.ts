import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { CartService } from "../../../../../services/cart.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const customerId = req.auth_context?.actor_id;
    if (!customerId) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Customer authentication required to merge cart.",
      });
    }

    const pool = getPgPool();
    const body = (req.body || {}) as { guestSessionToken?: string };
    const guestSessionToken = body.guestSessionToken || (req.headers["x-session-token"] as string);

    if (!guestSessionToken) {
      return res.status(400).json({
        code: "SESSION_TOKEN_REQUIRED",
        message: "guestSessionToken is required for merge.",
      });
    }

    // Resolve authoritative customer role (suspended/pending accounts fail closed to CUSTOMER)
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    const mergedCart = await CartService.mergeGuestCart(pool, {
      guestSessionToken,
      customerId,
      actorRole,
    });

    return res.json({ cart: mergedCart });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "MERGE_CART_FAILED",
      message: err.message,
    });
  }
}
