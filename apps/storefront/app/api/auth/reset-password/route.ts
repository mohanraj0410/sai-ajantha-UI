import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/auth";
import { completePasswordResetInMedusaStrict } from "@/lib/server/medusa";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
    };

    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) {
      return NextResponse.json(
        { error: "Password reset token is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const medusaRes = await completePasswordResetInMedusaStrict(token, password);

    if (!medusaRes.ok) {
      return NextResponse.json(
        { error: medusaRes.error || "Password reset failed." },
        { status: medusaRes.status || 400 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message:
        "Password has been successfully reset. You may now sign in with your new credentials.",
    });

    // Revoke any existing active session cookie on password change
    clearSessionCookie(response);

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to reset password. Please try again.",
      },
      { status: 500 }
    );
  }
}
