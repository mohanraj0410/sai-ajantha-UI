import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  createUserSession,
  medusaAdminToSafeUser,
  medusaCustomerToSafeUser,
  type UserRole,
} from "@/lib/server/auth";
import {
  loginAdminInMedusaStrict,
  loginCustomerInMedusaStrict,
} from "@/lib/server/medusa";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      portalRole?: string;
    };

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const portalRole = body.portalRole
      ? (body.portalRole.toUpperCase() as UserRole)
      : null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (portalRole === "ADMIN") {
      const adminRes = await loginAdminInMedusaStrict(email, password);
      if (!adminRes.ok) {
        return NextResponse.json(
          { error: adminRes.error },
          { status: adminRes.status }
        );
      }

      const safeAdmin = medusaAdminToSafeUser(adminRes);
      const { signedCookie, expiresAt } = createUserSession(
        safeAdmin.role,
        adminRes.token
      );
      const response = NextResponse.json({
        user: safeAdmin,
        medusaSynced: true,
      });
      attachSessionCookie(response, signedCookie, expiresAt);
      return response;
    }

    const medusaRes = await loginCustomerInMedusaStrict(email, password);
    if (!medusaRes.ok) {
      return NextResponse.json(
        { error: medusaRes.error },
        { status: medusaRes.status }
      );
    }

    const safeUser = medusaCustomerToSafeUser(medusaRes);

    // TASK 03 & 04: Server-Side Approval Enforcement During Authentication
    // Only approved Dealer and Distributor accounts may establish a usable portal session.
    if (safeUser.role === "DEALER" || safeUser.role === "DISTRIBUTOR") {
      if (safeUser.approvalStatus === "PENDING_APPROVAL") {
        return NextResponse.json(
          {
            code: "ACCOUNT_PENDING_APPROVAL",
            title: "Account Approval Pending",
            error:
              "Your registration has been submitted successfully. Please wait for admin approval before logging in.",
          },
          { status: 403 }
        );
      }

      if (safeUser.approvalStatus === "REJECTED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_REJECTED",
            title: "Registration Not Approved",
            error:
              "Your registration was not approved. Please contact our support team for more information.",
          },
          { status: 403 }
        );
      }

      if (safeUser.approvalStatus === "SUSPENDED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_SUSPENDED",
            title: "Account Suspended",
            error:
              "Your account has been suspended. Please contact support for assistance.",
          },
          { status: 403 }
        );
      }

      if (safeUser.approvalStatus === "DEACTIVATED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_DEACTIVATED",
            title: "Account Unavailable",
            error: "This account is currently inactive. Please contact support.",
          },
          { status: 403 }
        );
      }
    } else {
      // General customer suspension / deactivation / rejection check
      if (safeUser.approvalStatus === "SUSPENDED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_SUSPENDED",
            title: "Account Suspended",
            error:
              "Your account has been suspended. Please contact support for assistance.",
          },
          { status: 403 }
        );
      }
      if (safeUser.approvalStatus === "DEACTIVATED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_DEACTIVATED",
            title: "Account Unavailable",
            error: "This account is currently inactive. Please contact support.",
          },
          { status: 403 }
        );
      }
      if (safeUser.approvalStatus === "REJECTED") {
        return NextResponse.json(
          {
            code: "ACCOUNT_REJECTED",
            title: "Registration Not Approved",
            error:
              "Your registration was not approved. Please contact our support team for more information.",
          },
          { status: 403 }
        );
      }
    }

    if (portalRole && safeUser.role !== portalRole) {
      return NextResponse.json(
        {
          error: `This account is registered under the ${safeUser.role} portal. Please sign in via the matching persona tab.`,
        },
        { status: 403 }
      );
    }

    const { signedCookie, expiresAt } = createUserSession(
      safeUser.role,
      medusaRes.token
    );
    const response = NextResponse.json({
      user: safeUser,
      medusaSynced: true,
    });
    attachSessionCookie(response, signedCookie, expiresAt);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed." },
      { status: 500 }
    );
  }
}

