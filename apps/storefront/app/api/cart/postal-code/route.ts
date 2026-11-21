import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";
import { GUEST_CART_COOKIE_NAME } from "../route";

export async function POST(request: Request) {
  const session = await getSessionContext();
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  const body = (await request.json().catch(() => ({}))) as {
    cartId?: string;
    postalCode?: string;
  };

  const baseUrl = getMedusaBaseUrl();
  const pubKey = getMedusaPublishableKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (pubKey) headers["x-publishable-api-key"] = pubKey;
  if (session.medusaToken && session.user?.role !== "ADMIN") {
    headers["Authorization"] = `Bearer ${session.medusaToken}`;
  } else if (guestToken) {
    headers["x-session-token"] = guestToken;
  }

  try {
    const res = await fetch(`${baseUrl}/store/sai-ajanta/cart/postal-code`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        code: "CART_REVALIDATION_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Failed to revalidate cart postal code.",
      },
      { status: 503 }
    );
  }
}
