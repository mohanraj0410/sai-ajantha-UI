import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/auth";
import { getMedusaBaseUrl, getMedusaPublishableKey } from "@/lib/server/medusa";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { user, medusaToken } = await getSessionContext();

  // Strict ownership enforcement: Must be authenticated
  if (!user || !medusaToken) {
    return NextResponse.json(
      { error: "Authentication required to respond to a quotation." },
      { status: 401 }
    );
  }

  const baseUrl = getMedusaBaseUrl();
  const publishableKey = getMedusaPublishableKey();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${medusaToken}`,
    };
    if (publishableKey) headers["x-publishable-api-key"] = publishableKey;

    const res = await fetch(`${baseUrl}/store/sai-ajanta/quotes/${encodeURIComponent(id)}/respond`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: body.action,
        notes: body.notes,
        customer_email: user.email,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to process quote response" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error updating quotation" },
      { status: 500 }
    );
  }
}
