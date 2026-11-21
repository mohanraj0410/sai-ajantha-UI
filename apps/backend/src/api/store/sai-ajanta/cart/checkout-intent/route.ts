import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { CartService } from "../../../../../services/cart.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const body = (req.body || {}) as {
      cartId?: string;
      customerEmail?: string;
      sessionToken?: string;
      idempotencyKey?: string;
    };
    const cartId = body.cartId || (req.headers["x-cart-id"] as string);
    const sessionToken = (req.headers["x-session-token"] as string) || body.sessionToken || undefined;
    const idempotencyKey = (req.headers["x-idempotency-key"] as string) || body.idempotencyKey || undefined;
    const customerEmail = body.customerEmail || "customer@example.com";
    const customerId = req.auth_context?.actor_id || undefined;

    if (!cartId) {
      return res.status(400).json({
        code: "CART_ID_REQUIRED",
        message: "cartId is required to create checkout intent.",
      });
    }

    await CartService.assertCartOwnership(pool, cartId, { customerId, sessionToken });

    const intent = await CartService.createMixedSellerCheckoutIntent(pool, cartId, {
      customerId,
      customerEmail,
      idempotencyKey,
    });

    return res.status(intent.isReplay ? 200 : 201).json({ checkoutIntent: intent });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "CREATE_CHECKOUT_INTENT_FAILED",
      message: err.message,
    });
  }
}
