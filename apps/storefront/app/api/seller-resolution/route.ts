import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";

async function proxySellerResolution(body: {
  sku?: string;
  postalCode?: string;
  categorySlug?: string;
}) {
  const session = await getSessionContext();
  const baseUrl = getMedusaBaseUrl();
  const pubKey = getMedusaPublishableKey();

  if (!pubKey) {
    return NextResponse.json(
      { error: "Seller resolution service is temporarily unconfigured." },
      { status: 503 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  headers["x-publishable-api-key"] = pubKey;
  if (session.medusaToken && session.user?.role !== "ADMIN") {
    headers["Authorization"] = `Bearer ${session.medusaToken}`;
  }

  try {
    const res = await fetch(`${baseUrl}/store/sai-ajanta/seller-resolution`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Seller resolution service is temporarily unavailable." },
      { status: 503 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return proxySellerResolution({
    sku: searchParams.get("sku") || undefined,
    postalCode: searchParams.get("postalCode") || undefined,
    categorySlug: searchParams.get("categorySlug") || undefined,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sku?: string;
    postalCode?: string;
    categorySlug?: string;
  };
  return proxySellerResolution(body);
}
