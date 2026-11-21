import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { updateAdminProductInMedusaStrict } from "@/lib/server/medusa";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { id } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const res = await updateAdminProductInMedusaStrict(
      auth.medusaToken,
      id,
      body
    );
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ product: res.product });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update product.",
      },
      { status: 500 }
    );
  }
}
