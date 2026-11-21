import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  createUserSession,
  medusaCustomerToSafeUser,
  type UserRole,
} from "@/lib/server/auth";
import { registerCustomerInMedusaStrict } from "@/lib/server/medusa";

const ALLOWED_PUBLIC_ROLES = new Set<UserRole>([
  "CUSTOMER",
  "DISTRIBUTOR",
  "DEALER",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      role?: string;
      organization?: string;
      gstin?: string;
      businessCity?: string;
      preferredPins?: string[] | string;
      proposedPins?: string[] | string;
      categories?: string[];
      inviteToken?: string;
      operatingLocation?: string;
    };

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const phone = (body.phone || "").trim();
    const password = body.password || "";
    const requestedRole = (body.role || "CUSTOMER").toUpperCase() as UserRole;
    const organization = (body.organization || "").trim();
    const gstin = (body.gstin || "").trim().toUpperCase() || null;
    const businessCity = (body.businessCity || "").trim() || null;
    const honeypot = (body as Record<string, unknown>).website_hp;

    // Bot trap: reject automated registration scripts that fill hidden fields
    if (honeypot) {
      return NextResponse.json(
        { error: "Invalid registration parameters." },
        { status: 400 }
      );
    }

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid full name and email address are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    // Strict privilege escalation prevention: ADMIN can never be self-registered
    if (!ALLOWED_PUBLIC_ROLES.has(requestedRole)) {
      return NextResponse.json(
        { error: "Selected account role is not permitted for self-registration." },
        { status: 403 }
      );
    }

    if (
      (requestedRole === "DISTRIBUTOR" || requestedRole === "DEALER") &&
      (!organization || !phone)
    ) {
      return NextResponse.json(
        {
          error:
            "Organization / Firm name and phone number are required for Distributor and Dealer applications.",
        },
        { status: 400 }
      );
    }

    const medusaRes = await registerCustomerInMedusaStrict({
      name,
      email,
      password,
      phone,
      role: requestedRole,
      organization,
      gstin,
      businessCity,
      preferred_pins: body.preferredPins,
      proposed_pins: body.proposedPins,
      categories: body.categories,
      invite_token: body.inviteToken,
      operating_location: body.operatingLocation,
    });

    if (!medusaRes.ok) {
      return NextResponse.json(
        { error: medusaRes.error },
        { status: medusaRes.status }
      );
    }

    const safeUser = medusaCustomerToSafeUser(medusaRes);

    // Trade accounts (DEALER & DISTRIBUTOR) strictly require prior Admin approval.
    // Never create a session, never attach a cookie, and never return active credentials.
    const isTradeRegistration =
      requestedRole === "DEALER" ||
      requestedRole === "DISTRIBUTOR" ||
      safeUser.approvalStatus === "PENDING_APPROVAL";

    if (isTradeRegistration) {
      return NextResponse.json(
        {
          success: true,
          pendingApproval: true,
          role: safeUser.role,
          message:
            "Your account is waiting for admin approval. You can log in once your account has been approved.",
        },
        { status: 201 }
      );
    }

    // Normal Homeowner/Buyer (CUSTOMER): immediate session
    const { signedCookie, expiresAt } = createUserSession(
      safeUser.role,
      medusaRes.token
    );

    const response = NextResponse.json(
      {
        user: safeUser,
        medusaSynced: true,
        message: "Account created successfully.",
      },
      { status: 201 }
    );
    attachSessionCookie(response, signedCookie, expiresAt);
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to register account.",
      },
      { status: 500 }
    );
  }
}

