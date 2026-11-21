import { NextResponse } from "next/server";
import {
  getSessionContext,
  medusaCustomerToSafeUser,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { updateMedusaCustomerProfileStrict } from "@/lib/server/medusa";
import { getEffectivePriceTier } from "@/lib/server/pricing";

export async function GET() {
  const ctx = await getSessionContext();
  if (ctx.medusaError) {
    return NextResponse.json(
      {
        user: null,
        effectivePriceTier: "CUSTOMER",
        wholesaleUnlocked: false,
        error: ctx.medusaError,
      },
      { status: ctx.medusaStatus || 503 }
    );
  }

  const pricing = getEffectivePriceTier(ctx.user);
  return NextResponse.json({
    user: ctx.user,
    effectivePriceTier: pricing.tier,
    wholesaleUnlocked: pricing.wholesaleUnlocked,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      organization?: string;
      gstin?: string | null;
      businessCity?: string | null;
    };

    const name = (body.name ?? auth.user.name).trim();
    const phone = (body.phone ?? auth.user.phone).trim();
    const organization = (body.organization ?? auth.user.organization).trim();
    const gstin =
      body.gstin !== undefined
        ? (body.gstin || "").trim().toUpperCase() || null
        : auth.user.gstin;
    const businessCity =
      body.businessCity !== undefined
        ? (body.businessCity || "").trim() || null
        : auth.user.businessCity;

    if (!name) {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
    }

    if (auth.user.role === "ADMIN") {
      return NextResponse.json(
        { error: "Admin profile updates are managed in Medusa Admin." },
        { status: 400 }
      );
    }

    const medusaRes = await updateMedusaCustomerProfileStrict(auth.medusaToken, {
      name,
      phone,
      organization,
      gstin,
      businessCity,
    });
    if (!medusaRes.ok) {
      return NextResponse.json(
        { error: medusaRes.error },
        { status: medusaRes.status }
      );
    }

    const updatedUser = medusaCustomerToSafeUser(medusaRes);
    return NextResponse.json({ user: updatedUser });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile update failed." },
      { status: 500 }
    );
  }
}

