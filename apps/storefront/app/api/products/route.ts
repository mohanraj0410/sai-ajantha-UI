import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import {
  fetchMedusaCatalogStrict,
  medusaCatalogProductToProductItem,
  type MedusaCatalogProduct,
} from "@/lib/server/medusa";
import { getEffectivePriceTier, type EffectivePriceTier } from "@/lib/server/pricing";

function resolveMedusaTierPrice(
  prod: MedusaCatalogProduct,
  tier: EffectivePriceTier
): number | null {
  if (tier === "DISTRIBUTOR") {
    return (
      prod.distributorPriceInr ??
      prod.dealerPriceInr ??
      prod.customerPriceInr
    );
  }
  if (tier === "DEALER") {
    return prod.dealerPriceInr ?? prod.customerPriceInr;
  }
  return prod.customerPriceInr;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const { tier, wholesaleUnlocked } = getEffectivePriceTier(user);

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");

  const result = await fetchMedusaCatalogStrict();
  if (!result.ok) {
    return NextResponse.json(
      {
        source: "medusa",
        error: result.error,
        products: [],
      },
      { status: result.status || 503 }
    );
  }

  const mapped = result.products.map((mp) => {
    const unitPriceInr = resolveMedusaTierPrice(mp, tier);
    return medusaCatalogProductToProductItem(mp, unitPriceInr, tier);
  });

  if (idParam) {
    const idLower = idParam.toLowerCase();
    const found = mapped.find(
      (item) =>
        item.id === idParam ||
        item.medusaId === idParam ||
        item.handle === idParam ||
        item.code === idParam ||
        (item as any).sku === idParam ||
        (item.code || "").toLowerCase() === idLower ||
        ((item as any).sku || "").toLowerCase() === idLower
    );
    if (!found) {
      return NextResponse.json(
        { error: "Product not found in Medusa catalog." },
        { status: 404 }
      );
    }

    const res = NextResponse.json({
      source: "medusa",
      effectivePriceTier: tier,
      wholesaleUnlocked,
      product: found,
    });
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.headers.set("Vary", "Cookie, Authorization");
    return res;
  }

  const res = NextResponse.json({
    source: "medusa",
    effectivePriceTier: tier,
    wholesaleUnlocked,
    count: mapped.length,
    products: mapped,
  });
  res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.headers.set("Vary", "Cookie, Authorization");
  return res;
}
