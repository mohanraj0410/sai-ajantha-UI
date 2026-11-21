import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  listEnquiriesFromMedusaStrict,
  submitEnquiryToMedusaStrict,
} from "@/lib/server/medusa";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const res = await listEnquiriesFromMedusaStrict(auth.medusaToken);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ enquiries: res.enquiries });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      role?: string;
      organization?: string;
      phone?: string;
      email?: string;
      city?: string;
      postal_code?: string;
      pincode?: string;
      division?: string;
      notes?: string;
      source?: string;
      lead_type?: string;
      items?: any[];
      attachments?: any[];
    };

    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const email = (body.email || "").trim();
    const postalCode = (body.postal_code || body.pincode || "").trim();
    const honeypot = (body as Record<string, unknown>).website_hp || (body as Record<string, unknown>).confirm_fax;

    // Bot trap: automated scrapers filling hidden honeypot fields
    if (honeypot) {
      return NextResponse.json({
        id: "enq_bot_absorbed",
        message: "Enquiry saved. Our Trichy technical desk will respond within 24 working hours.",
      });
    }

    if (!name && !phone && !email) {
      return NextResponse.json(
        { error: "Contact name, phone, or email is required." },
        { status: 400 }
      );
    }

    const res = await submitEnquiryToMedusaStrict({
      name: name || "Callback Request",
      role: (body.role || "Visitor").trim(),
      organization: (body.organization || "").trim(),
      phone,
      email,
      city: (body.city || "").trim(),
      postal_code: postalCode,
      division: (body.division || "General Infrastructure").trim(),
      notes: (body.notes || "").trim(),
      source: (body.source || "website").trim(),
      lead_type: body.lead_type,
      items: body.items,
      attachments: body.attachments,
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }

    return NextResponse.json(
      {
        id: res.id,
        message:
          "Enquiry logged with reference ID " + res.id + ". Our Trichy desk will review and follow up.",
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save enquiry." },
      { status: 500 }
    );
  }
}
