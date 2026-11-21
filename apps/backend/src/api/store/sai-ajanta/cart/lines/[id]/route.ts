import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { CartService } from "../../../../../../services/cart.service";

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const lineId = req.params.id;
    const body = (req.body || {}) as { cartId?: string; quantity?: number; sessionToken?: string };
    const cartId = body.cartId || (req.headers["x-cart-id"] as string);
    const sessionToken = (req.headers["x-session-token"] as string) || body.sessionToken || undefined;
    const customerId = req.auth_context?.actor_id || undefined;

    if (!cartId) {
      return res.status(400).json({
        code: "CART_ID_REQUIRED",
        message: "cartId is required to update line item.",
      });
    }

    const quantity = Number(body.quantity);
    if (isNaN(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "quantity must be a non-negative integer.",
      });
    }

    await CartService.assertCartOwnership(pool, cartId, { customerId, sessionToken });
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    const updatedCart = await CartService.updateLineQuantity(pool, cartId, lineId, quantity, {
      actorRole,
    });

    return res.json({ cart: updatedCart });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "UPDATE_LINE_FAILED",
      message: err.message,
    });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const lineId = req.params.id;
    const cartId = (req.query.cartId as string) || (req.headers["x-cart-id"] as string);
    const sessionToken =
      (req.headers["x-session-token"] as string) ||
      (req.query.sessionToken as string) ||
      undefined;
    const customerId = req.auth_context?.actor_id || undefined;

    if (!cartId) {
      return res.status(400).json({
        code: "CART_ID_REQUIRED",
        message: "cartId is required to delete line item.",
      });
    }

    await CartService.assertCartOwnership(pool, cartId, { customerId, sessionToken });
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    const updatedCart = await CartService.removeLine(pool, cartId, lineId, {
      actorRole,
    });

    return res.json({ cart: updatedCart });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "REMOVE_LINE_FAILED",
      message: err.message,
    });
  }
}
