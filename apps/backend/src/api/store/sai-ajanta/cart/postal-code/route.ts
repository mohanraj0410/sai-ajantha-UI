import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { CartService } from "../../../../../services/cart.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const body = (req.body || {}) as { cartId?: string; postalCode?: string; sessionToken?: string };
    const cartId = body.cartId || (req.headers["x-cart-id"] as string);
    const sessionToken = (req.headers["x-session-token"] as string) || body.sessionToken || undefined;
    const customerId = req.auth_context?.actor_id || undefined;
    const postalCode = body.postalCode ? body.postalCode.trim() : "";

    if (!cartId) {
      return res.status(400).json({
        code: "CART_ID_REQUIRED",
        message: "cartId is required.",
      });
    }

    if (!postalCode || !/^\d{6}$/.test(postalCode)) {
      return res.status(400).json({
        code: "INVALID_POSTAL_CODE",
        message: "postalCode must be a 6-digit numeric string.",
      });
    }

    await CartService.assertCartOwnership(pool, cartId, { customerId, sessionToken });
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    const updatedCart = await CartService.updatePostalCode(pool, cartId, postalCode, {
      actorRole,
      actorId: customerId,
    });

    return res.json({ cart: updatedCart });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "UPDATE_POSTAL_CODE_FAILED",
      message: err.message,
    });
  }
}
