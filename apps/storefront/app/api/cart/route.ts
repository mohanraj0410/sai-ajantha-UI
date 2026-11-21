import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";

export const GUEST_CART_COOKIE_NAME = "sa_guest_cart_token";
const GUEST_CART_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function setGuestCartCookie(res: NextResponse, token: string): void {
  res.cookies.set(GUEST_CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_CART_TTL_SECONDS,
  });
}

export async function GET(request: Request) {
  const session = await getSessionContext();
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  const { searchParams } = new URL(request.url);
  const cartId = searchParams.get("cartId") || undefined;

  const baseUrl = getMedusaBaseUrl();
  const pubKey = getMedusaPublishableKey();
  const headers: Record<string, string> = {};
  if (pubKey) headers["x-publishable-api-key"] = pubKey;
  if (session.medusaToken && session.user?.role !== "ADMIN") {
    headers["Authorization"] = `Bearer ${session.medusaToken}`;
  } else if (guestToken) {
    headers["x-session-token"] = guestToken;
  }
  if (cartId) headers["x-cart-id"] = cartId;

  try {
    const res = await fetch(`${baseUrl}/store/sai-ajanta/cart`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      cart?: { sessionToken?: string };
      [key: string]: unknown;
    };
    const nextRes = NextResponse.json(data, { status: res.status });
    if (res.ok && !session.medusaToken && data?.cart?.sessionToken) {
      setGuestCartCookie(nextRes, data.cart.sessionToken);
    }
    return nextRes;
  } catch (err) {
    return NextResponse.json(
      {
        code: "CART_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Persistent cart service unavailable.",
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

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
    const res = await fetch(`${baseUrl}/store/sai-ajanta/cart`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      cart?: { sessionToken?: string };
      [key: string]: unknown;
    };
    const nextRes = NextResponse.json(data, { status: res.status });
    if (res.ok && !session.medusaToken && data?.cart?.sessionToken) {
      setGuestCartCookie(nextRes, data.cart.sessionToken);
    }
    return nextRes;
  } catch (err) {
    return NextResponse.json(
      {
        code: "CART_UNAVAILABLE",
        message: err instanceof Error ? err.message : "Persistent cart service unavailable.",
      },
      { status: 503 }
    );
  }
}
