import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../lib/db";
import { CartService } from "../../../../services/cart.service";
import { validateAddToCartInput } from "@sai-ajanta/types";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const cartId = (req.query.cartId as string) || (req.headers["x-cart-id"] as string);
    const sessionToken =
      (req.headers["x-session-token"] as string) ||
      (req.query.sessionToken as string) ||
      undefined;
    const customerId = req.auth_context?.actor_id || undefined;
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    if (!cartId && !sessionToken && !customerId) {
      // Create empty initial cart
      const newCart = await CartService.getOrCreateCart(pool, {});
      const cartDetails = await CartService.getCartWithDetails(pool, newCart.id, { actorRole });
      return res.json({ cart: cartDetails });
    }

    let activeCartId = cartId;
    if (activeCartId) {
      // P8.3 Security: Verify ownership before returning cart contents
      await CartService.assertCartOwnership(pool, activeCartId, { customerId, sessionToken });
    } else {
      const activeCart = await CartService.getOrCreateCart(pool, { sessionToken, customerId });
      activeCartId = activeCart.id;
    }

    const cartDetails = await CartService.getCartWithDetails(pool, activeCartId, {
      actorRole,
    });

    return res.json({ cart: cartDetails });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "FETCH_CART_FAILED",
      message: err.message,
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const body = req.body as Record<string, unknown>;
    const cartId = (body.cartId as string) || (req.headers["x-cart-id"] as string);
    const sessionToken =
      (req.headers["x-session-token"] as string) ||
      (body.sessionToken as string) ||
      undefined;
    const customerId = req.auth_context?.actor_id || undefined;
    const actorRole = await CartService.resolveActorRole(pool, customerId);

    const validated = validateAddToCartInput(body);
    if (!validated.success) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "Invalid cart input",
        errors: validated.errors,
      });
    }

    let targetCartId = cartId;
    if (targetCartId) {
      // P8.3 Security: Verify ownership before adding items to an explicit cartId
      await CartService.assertCartOwnership(pool, targetCartId, { customerId, sessionToken });
    } else {
      const cart = await CartService.getOrCreateCart(pool, {
        sessionToken,
        customerId,
        postalCode: validated.data.postalCode,
      });
      targetCartId = cart.id;
    }

    const updatedCart = await CartService.addItem(
      pool,
      targetCartId,
      validated.data,
      { actorRole, actorId: customerId }
    );

    return res.status(201).json({ cart: updatedCart });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "ADD_TO_CART_FAILED",
      message: err.message,
    });
  }
}
