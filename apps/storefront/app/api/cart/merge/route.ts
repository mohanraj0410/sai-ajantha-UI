import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";
import { GUEST_CART_COOKIE_NAME } from "../route";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  const body = (await request.json().catch(() => ({}))) as { guestSessionToken?: string };
  const guestSessionToken = cookieToken || body.guestSessionToken;

  if (!guestSessionToken) {
    return NextResponse.json({ merged: false, message: "No guest cart to merge." });
  }

  const baseUrl = getMedusaBaseUrl();
  const pubKey = getMedusaPublishableKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.medusaToken}`,
  };
  if (pubKey) headers["x-publishable-api-key"] = pubKey;

  try {
    const res = await fetch(`${baseUrl}/store/sai-ajanta/cart/merge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ guestSessionToken }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    const nextRes = NextResponse.json(data, { status: res.status });
    if (res.ok) {
      // Clear guest cookie after successful merge so no cross-user leakage occurs on shared browsers
      nextRes.cookies.set(GUEST_CART_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }
    return nextRes;
  } catch (err) {
    return NextResponse.json(
      {
        code: "CART_MERGE_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Failed to merge guest cart.",
      },
      { status: 503 }
    );
  }
}
