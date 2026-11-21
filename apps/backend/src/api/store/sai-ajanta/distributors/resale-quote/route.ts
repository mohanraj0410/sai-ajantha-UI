import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { DistributorLifecycleService } from "../../../../../services/distributor-lifecycle.service";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pool = getPgPool();
    const body = req.body as {
      distributorId: string;
      buyerId?: string;
      buyerRole?: string;
      buyerName: string;
      buyerEmail: string;
      buyerPhone: string;
      postalCode: string;
      items: { sku: string; qty: number; unitPricePaise?: number }[];
    };

    if (!body?.distributorId || !body?.buyerName || !Array.isArray(body?.items) || body.items.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_FAILED",
        message: "distributorId, buyerName, and at least one item are required.",
      });
    }

    const buyerId = body.buyerId || req.auth_context?.actor_id || `guest_${Date.now().toString(36)}`;
    const buyerRole = body.buyerRole || (req.auth_context?.actor_type === "customer" ? "DEALER" : "CUSTOMER");

    const result = await DistributorLifecycleService.createResaleQuote(pool, {
      distributorId: body.distributorId,
      buyerId,
      buyerRole,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      buyerPhone: body.buyerPhone,
      postalCode: body.postalCode,
      items: body.items,
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      code: err.code || "RESALE_QUOTE_FAILED",
      message: err.message,
    });
  }
}
