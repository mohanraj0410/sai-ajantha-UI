import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";

export async function GET(request: Request) {
  const { user, medusaToken } = await getSessionContext();

  // Strict ownership enforcement: Must be authenticated
  if (!user || !medusaToken) {
    return NextResponse.json(
      { error: "Authentication required to view quotations." },
      { status: 401 }
    );
  }

  // Derive identity strictly from verified session, never from untrusted query params or headers
  const email = user.email?.trim().toLowerCase() || "";
  const phone = user.phone?.trim() || "";

  if (!email && !phone) {
    return NextResponse.json(
      { error: "No verified email or phone associated with this session." },
      { status: 403 }
    );
  }

  const baseUrl = getMedusaBaseUrl();
  const publishableKey = getMedusaPublishableKey();

  const searchParams = new URLSearchParams();
  if (email) searchParams.set("email", email);
  if (phone) searchParams.set("phone", phone);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${medusaToken}`,
    };
    if (publishableKey) headers["x-publishable-api-key"] = publishableKey;

    const res = await fetch(`${baseUrl}/store/sai-ajanta/quotes?${searchParams}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || "Failed to fetch quotations" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ quotes: data.quotes || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load quotations" },
      { status: 500 }
    );
  }
}
