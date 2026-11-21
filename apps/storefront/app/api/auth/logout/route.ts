import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/auth";
import { GUEST_CART_COOKIE_NAME } from "@/app/api/cart/route";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  // P8.11.B: Clear guest cart cookie on logout to prevent cross-account cart carryover on shared browsers
  response.cookies.set(GUEST_CART_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
