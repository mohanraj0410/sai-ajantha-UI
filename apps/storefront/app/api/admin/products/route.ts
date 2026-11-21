import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { createAdminProductInMedusaStrict } from "@/lib/server/medusa";

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const res = await createAdminProductInMedusaStrict(auth.medusaToken, body);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ product: res.product }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to create product.",
      },
      { status: 500 }
    );
  }
}
