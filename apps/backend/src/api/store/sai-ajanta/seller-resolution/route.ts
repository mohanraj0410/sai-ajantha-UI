import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../lib/db";
import { DistributorLifecycleService } from "../../../../services/distributor-lifecycle.service";
import { SellerResolutionService } from "../../../../services/seller-resolution.service";
import { CartService } from "../../../../services/cart.service";

async function resolveFromParams(
  req: MedusaRequest,
  res: MedusaResponse,
  params: {
    postalCode?: string;
    categorySlug?: string;
    sku?: string;
    actorId?: string;
    actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
  }
) {
  try {
    const pool = getPgPool();
    const postalCode = String(params.postalCode || "").trim();
    const categorySlug = String(params.categorySlug || "").trim();
    const sku = params.sku ? String(params.sku).trim() : undefined;

    const actorId = params.actorId || req.auth_context?.actor_id || undefined;
    const actorRole =
      params.actorRole || (await CartService.resolveActorRole(pool, actorId));

    let resolution;
    if (sku) {
      // P8.1: Full Canonical Server-Side Seller Resolution with Catalog & Price validation
      resolution = await SellerResolutionService.resolveCanonicalSeller(pool, {
        sku,
        postalCode,
        actorRole,
        actorId,
      });
    } else {
      // Territory resolution fallback
      resolution = await DistributorLifecycleService.resolveSellerForTerritory(pool, {
        postalCode,
        categorySlug,
        sku,
      });
    }

    return res.json({ resolution });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "SELLER_RESOLUTION_FAILED",
      message: err.message,
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return resolveFromParams(req, res, {
    postalCode: req.query.postalCode as string | undefined,
    categorySlug: req.query.categorySlug as string | undefined,
    sku: req.query.sku as string | undefined,
    actorId: req.query.actorId as string | undefined,
    actorRole: req.query.actorRole as any,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as {
    postalCode?: string;
    categorySlug?: string;
    sku?: string;
    actorId?: string;
    actorRole?: any;
  };
  return resolveFromParams(req, res, body);
}
