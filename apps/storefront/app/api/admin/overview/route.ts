import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth";
import { fetchAdminPortalOverviewStrict } from "@/lib/server/medusa";

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const res = await fetchAdminPortalOverviewStrict(auth.medusaToken);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json(res.data);
}
