import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  fetchMedusaAdminSessionStrict,
  fetchMedusaCustomerSessionStrict,
  type MedusaAdminAuthResult,
  type MedusaAuthSessionResult,
} from "@/lib/server/medusa";

export const SESSION_COOKIE_NAME = "sa_session";
const SESSION_TTL_DAYS = 7;

export type UserRole = "CUSTOMER" | "DISTRIBUTOR" | "DEALER" | "ADMIN";
export type ApprovalStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED" | "DEACTIVATED";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  businessCity: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

interface EncryptedSessionPayload {
  role: "ADMIN" | "CUSTOMER";
  medusaToken: string;
  exp: number;
  iat: number;
}

let ephemeralSessionSecret: string | null = null;

function getSessionKey(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim();
  if (
    secret &&
    secret.length >= 32 &&
    !secret.includes("dev-only") &&
    !secret.includes("change-in-prod")
  ) {
    return crypto.createHash("sha256").update(secret).digest();
  }

  if (process.env.NODE_ENV === "production") {
    if (!ephemeralSessionSecret) {
      ephemeralSessionSecret = crypto.randomBytes(32).toString("hex");
      console.warn(
        "[AI Studio] SESSION_SECRET not configured — using ephemeral in-memory session key."
      );
    }
    return crypto.createHash("sha256").update(ephemeralSessionSecret).digest();
  }

  // Development fallback for local DX
  const devSecret = secret || "dev-only-sai-ajantha-session-secret-change-in-prod";
  return crypto.createHash("sha256").update(devSecret).digest();
}

function sealSessionPayload(payload: EncryptedSessionPayload): string {
  const key = getSessionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function unsealSessionPayload(cookieValue: string): EncryptedSessionPayload | null {
  try {
    const parts = cookieValue.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    if (!ivB64 || !tagB64 || !dataB64) return null;

    const key = getSessionKey();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const parsed = JSON.parse(
      decrypted.toString("utf8")
    ) as Partial<EncryptedSessionPayload>;

    if (
      (parsed.role !== "ADMIN" && parsed.role !== "CUSTOMER") ||
      typeof parsed.medusaToken !== "string" ||
      !parsed.medusaToken.trim() ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }

    return {
      role: parsed.role,
      medusaToken: parsed.medusaToken.trim(),
      exp: parsed.exp,
      iat: typeof parsed.iat === "number" ? parsed.iat : 0,
    };
  } catch {
    return null;
  }
}

function mapMedusaStatusToApproval(
  status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "DEACTIVATED" | string | null,
  dynamicAttrs?: Record<string, unknown> | null,
  role?: UserRole
): ApprovalStatus {
  if (
    dynamicAttrs?.deactivated === true ||
    dynamicAttrs?.account_status === "DEACTIVATED" ||
    status === "DEACTIVATED"
  ) {
    return "DEACTIVATED";
  }
  if (
    dynamicAttrs?.rejection_status === "REJECTED" ||
    dynamicAttrs?.trade_application_status === "REJECTED" ||
    status === "REJECTED"
  ) {
    return "REJECTED";
  }
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (status === "ACTIVE") return "APPROVED";

  // If a trade account has no explicit ACTIVE status, default to PENDING_APPROVAL
  if (role === "DEALER" || role === "DISTRIBUTOR") {
    return "PENDING_APPROVAL";
  }
  return "APPROVED";
}

export function medusaCustomerToSafeUser(
  medusaAuth: Extract<MedusaAuthSessionResult, { ok: true }>
): SafeUser {
  const { customer, profile } = medusaAuth;
  const email = customer.email.trim().toLowerCase();
  const fullName =
    [customer.first_name, customer.last_name]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" ")
      .trim() || email.split("@")[0];
  const attrPhone =
    profile?.dynamic_attributes &&
    typeof profile.dynamic_attributes.phone === "string"
      ? profile.dynamic_attributes.phone
      : "";
  const rejectionReason =
    profile?.dynamic_attributes &&
    typeof profile.dynamic_attributes.rejection_reason === "string"
      ? profile.dynamic_attributes.rejection_reason
      : null;

  const role: UserRole =
    profile?.role === "DEALER" || profile?.role === "DISTRIBUTOR"
      ? profile.role
      : "CUSTOMER";
  const approvalStatus = mapMedusaStatusToApproval(
    profile?.status,
    profile?.dynamic_attributes as Record<string, unknown> | null,
    role
  );
  const phone = (customer.phone || attrPhone || "").trim();
  const organization = (
    profile?.business_name ||
    customer.company_name ||
    (role === "CUSTOMER" ? "Direct Customer" : "")
  ).trim();

  return {
    id: customer.id,
    name: fullName,
    email,
    phone,
    organization,
    gstin: profile?.gst_number || null,
    businessCity: profile?.territory || null,
    role,
    approvalStatus,
    rejectionReason:
      approvalStatus === "REJECTED" || approvalStatus === "SUSPENDED"
        ? rejectionReason
        : null,
    createdAt: customer.created_at || new Date().toISOString(),
  };
}

export function medusaAdminToSafeUser(
  medusaAdmin: Extract<MedusaAdminAuthResult, { ok: true }>
): SafeUser {
  const { adminUser } = medusaAdmin;
  const email = adminUser.email.trim().toLowerCase();
  const fullName =
    [adminUser.first_name, adminUser.last_name]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(" ")
      .trim() || "Sai Ajantha Operations Admin";

  return {
    id: adminUser.id,
    name: fullName,
    email,
    phone: "",
    organization: "Sai Ajantha Interior Solutions",
    gstin: null,
    businessCity: "Trichy",
    role: "ADMIN",
    approvalStatus: "APPROVED",
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  };
}

export function createUserSession(
  role: UserRole,
  medusaToken: string
): {
  signedCookie: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400 * 1000);
  const signedCookie = sealSessionPayload({
    role: role === "ADMIN" ? "ADMIN" : "CUSTOMER",
    medusaToken,
    exp: expiresAt.getTime(),
    iat: Date.now(),
  });
  return {
    signedCookie,
    expiresAt,
  };
}

export function attachSessionCookie(
  res: NextResponse,
  signedCookie: string,
  expiresAt: Date
): void {
  res.cookies.set(SESSION_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export interface SessionContext {
  user: SafeUser | null;
  medusaToken: string | null;
  medusaError?: string;
  medusaStatus?: number;
}

export async function getSessionContext(): Promise<SessionContext> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return { user: null, medusaToken: null };

  const session = unsealSessionPayload(raw);
  if (!session) return { user: null, medusaToken: null };

  if (session.role === "ADMIN") {
    const adminRes = await fetchMedusaAdminSessionStrict(session.medusaToken);
    if (!adminRes.ok) {
      if (adminRes.status === 401 || adminRes.status === 404) {
        return { user: null, medusaToken: null };
      }
      return {
        user: null,
        medusaToken: null,
        medusaError: adminRes.error,
        medusaStatus: adminRes.status,
      };
    }
    return {
      user: medusaAdminToSafeUser(adminRes),
      medusaToken: session.medusaToken,
    };
  }

  const custRes = await fetchMedusaCustomerSessionStrict(session.medusaToken);
  if (!custRes.ok) {
    if (custRes.status === 401 || custRes.status === 404) {
      return { user: null, medusaToken: null };
    }
    return {
      user: null,
      medusaToken: null,
      medusaError: custRes.error,
      medusaStatus: custRes.status,
    };
  }

  // Cross-device server-enforced session revocation:
  // If the customer profile has a session_revoked_at timestamp, and the cookie was issued BEFORE that timestamp,
  // the session has been invalidated (e.g. after a password reset, credential update, or staff revocation).
  const sessionRevokedAtStr =
    custRes.profile?.dynamic_attributes &&
    typeof custRes.profile.dynamic_attributes.session_revoked_at === "string"
      ? custRes.profile.dynamic_attributes.session_revoked_at
      : null;

  if (sessionRevokedAtStr) {
    const revokedAtMs = new Date(sessionRevokedAtStr).getTime();
    if (session.iat && session.iat < revokedAtMs) {
      return {
        user: null,
        medusaToken: null,
        medusaError:
          "Session invalidated due to password reset or security update. Please sign in again.",
        medusaStatus: 401,
      };
    }
  }

  const safeUser = medusaCustomerToSafeUser(custRes);

  // Authoritative server-side approval & security check for existing sessions:
  // If a Dealer or Distributor account is PENDING_APPROVAL, REJECTED, SUSPENDED, or DEACTIVATED,
  // existing tokens must not bypass the approval restriction.
  if (safeUser.role === "DEALER" || safeUser.role === "DISTRIBUTOR") {
    if (safeUser.approvalStatus !== "APPROVED") {
      return {
        user: null,
        medusaToken: null,
        medusaError:
          safeUser.approvalStatus === "PENDING_APPROVAL"
            ? "Your account is waiting for admin approval. You can log in once your account has been approved."
            : safeUser.approvalStatus === "REJECTED"
            ? "Your trade application was not approved. Please contact our support team."
            : "Your trade account has been suspended. Please contact support.",
        medusaStatus: 403,
      };
    }
  } else if (
    safeUser.approvalStatus === "SUSPENDED" ||
    safeUser.approvalStatus === "DEACTIVATED" ||
    safeUser.approvalStatus === "REJECTED"
  ) {
    return {
      user: null,
      medusaToken: null,
      medusaError: "This account is currently inactive. Please contact support.",
      medusaStatus: 403,
    };
  }

  return {
    user: safeUser,
    medusaToken: session.medusaToken,
  };
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const ctx = await getSessionContext();
  return ctx.user;
}

export async function requireAuthenticatedUser(): Promise<
  { user: SafeUser; medusaToken: string } | { errorResponse: NextResponse }
> {
  const ctx = await getSessionContext();
  if (ctx.medusaError) {
    return {
      errorResponse: NextResponse.json(
        { error: ctx.medusaError },
        { status: ctx.medusaStatus || 503 }
      ),
    };
  }
  if (!ctx.user || !ctx.medusaToken) {
    return {
      errorResponse: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }
  return { user: ctx.user, medusaToken: ctx.medusaToken };
}

export async function requireAdminUser(): Promise<
  { user: SafeUser; medusaToken: string } | { errorResponse: NextResponse }
> {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth;
  if (auth.user.role !== "ADMIN") {
    return {
      errorResponse: NextResponse.json(
        { error: "Administrator authorization required." },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export async function requireActiveTradeUser(): Promise<
  { user: SafeUser; medusaToken: string } | { errorResponse: NextResponse }
> {
  const auth = await requireAuthenticatedUser();
  if ("errorResponse" in auth) return auth;
  if (auth.user.approvalStatus === "SUSPENDED") {
    return {
      errorResponse: NextResponse.json(
        { error: "Account is suspended. Access to trade privileges is denied." },
        { status: 403 }
      ),
    };
  }
  if (auth.user.approvalStatus === "REJECTED") {
    return {
      errorResponse: NextResponse.json(
        { error: "Trade account application was not approved." },
        { status: 403 }
      ),
    };
  }
  if (auth.user.approvalStatus !== "APPROVED") {
    return {
      errorResponse: NextResponse.json(
        { error: "Trade approval required." },
        { status: 403 }
      ),
    };
  }
  return auth;
}
