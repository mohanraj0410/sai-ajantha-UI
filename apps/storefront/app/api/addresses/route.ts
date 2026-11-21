import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  createMedusaAddressStrict,
  deleteMedusaAddressStrict,
  listMedusaAddressesStrict,
} from "@/lib/server/medusa";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json({ addresses: [] });
  }

  const res = await listMedusaAddressesStrict(auth.medusaToken);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ addresses: res.addresses });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Address book is managed for customer accounts." },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as {
      label?: string;
      recipient?: string;
      organization?: string;
      line1?: string;
      city?: string;
      state?: string;
      pincode?: string;
      phone?: string;
    };

    const label = (body.label || "").trim();
    const line1 = (body.line1 || "").trim();
    const city = (body.city || "Trichy").trim();
    const state = (body.state || "Tamil Nadu").trim();
    const pincode = (body.pincode || "620003").trim();
    const recipient = (body.recipient || auth.user.name).trim();
    const organization = (body.organization || auth.user.organization).trim();
    const phone = (body.phone || auth.user.phone).trim();

    if (!label || !line1) {
      return NextResponse.json(
        { error: "Address label and street address are required." },
        { status: 400 }
      );
    }

    const res = await createMedusaAddressStrict(auth.medusaToken, {
      label,
      recipient,
      organization,
      line1,
      city,
      state,
      pincode,
      phone,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json({ address: res.address }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save address." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Address book is managed for customer accounts." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Address ID required." },
      { status: 400 }
    );
  }

  const res = await deleteMedusaAddressStrict(auth.medusaToken, id);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
