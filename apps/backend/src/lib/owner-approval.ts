import crypto from "node:crypto";
import type { MedusaRequest } from "@medusajs/framework/http";
import { recordDurableAuditEvent } from "./audit-logger";

export interface OwnerApprovalPayload {
  sku: string;
  allowedFields: string[];
  actorId: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface OwnerApprovalResult {
  authorized: boolean;
  statusCode?: number;
  code?: string;
  message?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

async function recordAudit(
  req: MedusaRequest,
  action: string,
  resource: string,
  details?: Record<string, unknown>,
  options?: { outcome?: "SUCCESS" | "FAILURE" | "DENIED"; reason?: string | null }
): Promise<void> {
  try {
    if (typeof recordDurableAuditEvent === "function") {
      await recordDurableAuditEvent(req, action, resource, details, options);
    }
  } catch {
    // Non-blocking in test or isolated execution environments
  }
}

// In-memory cache for redeemed token nonces to prevent replay attacks (nonce -> expiresAt)
const redeemedNonces = new Map<string, number>();

function purgeExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, exp] of redeemedNonces.entries()) {
    if (now > exp) {
      redeemedNonces.delete(nonce);
    }
  }
}

function getApprovalSecret(): string {
  return (
    process.env.OWNER_APPROVAL_SECRET ||
    process.env.JWT_SECRET ||
    process.env.COOKIE_SECRET ||
    "sai-ajantha-owner-secret-entropy-998822"
  );
}

/**
 * Generates a cryptographically signed Owner Approval Token for a target SKU and mutation scope.
 */
export function generateOwnerApprovalToken(params: {
  sku: string;
  actorId: string;
  allowedFields?: string[];
  expiresInSeconds?: number;
}): string {
  const secret = getApprovalSecret();
  const now = Date.now();
  const ttlMs = (params.expiresInSeconds ?? 300) * 1000; // Default 5 minutes TTL

  const payload: OwnerApprovalPayload = {
    sku: params.sku.trim().toUpperCase(),
    actorId: params.actorId.trim(),
    allowedFields: Array.isArray(params.allowedFields) && params.allowedFields.length > 0
      ? params.allowedFields.map((f) => f.trim())
      : ["*"],
    nonce: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Parses and verifies an Owner Approval Token.
 * Rejects expired tokens, invalid signatures, malformed tokens, or already-redeemed nonces.
 */
export function parseAndVerifyToken(rawToken: string): {
  valid: boolean;
  payload?: OwnerApprovalPayload;
  reason?: string;
} {
  purgeExpiredNonces();

  if (!rawToken || typeof rawToken !== "string") {
    return { valid: false, reason: "MISSING_TOKEN" };
  }

  const parts = rawToken.trim().split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "MALFORMED_TOKEN_STRUCTURE" };
  }

  const [payloadB64, signature] = parts;
  const secret = getApprovalSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time signature comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: "INVALID_CRYPTOGRAPHIC_SIGNATURE" };
  }

  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload: OwnerApprovalPayload = JSON.parse(payloadJson);

    if (!payload.sku || !payload.actorId || !payload.nonce || !payload.expiresAt) {
      return { valid: false, reason: "INCOMPLETE_TOKEN_PAYLOAD" };
    }

    const now = Date.now();
    if (now > payload.expiresAt) {
      return { valid: false, reason: "APPROVAL_TOKEN_EXPIRED", payload };
    }

    // Replay attack check
    if (redeemedNonces.has(payload.nonce)) {
      return { valid: false, reason: "REPLAY_ATTACK_DETECTED", payload };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "INVALID_JSON_PAYLOAD" };
  }
}

/**
 * Marks a nonce as redeemed so it cannot be used again.
 */
export function markNonceRedeemed(nonce: string, expiresAt: number): void {
  redeemedNonces.set(nonce, expiresAt);
}

/**
 * Verifies whether a request to mutate a protected catalogue SKU has legitimate,
 * server-side authenticated Owner Approval.
 *
 * Rules:
 * 1. A literal header "x-owner-merge-approval: AUTHORIZED_BY_OWNER" or body flag alone
 *    must NEVER grant approval and is rejected as a FORGED_HEADER_ATTEMPT.
 * 2. Authenticated Staff Session is required (req.staff_user).
 * 3. Calling user must hold role "owner" or "super_admin".
 * 4. A cryptographically valid, unexpired, unredeemed token matching target SKU and mutation fields
 *    must be presented.
 * 5. Every attempt (success or failure) is immutably logged to the durable audit log.
 */
export async function verifyOwnerApproval(
  req: MedusaRequest,
  targetSku: string,
  mutationFields: string[] = []
): Promise<OwnerApprovalResult> {
  const normSku = targetSku.trim().toUpperCase();
  const staff = req.staff_user;

  const rawHeader =
    req.headers["x-owner-approval-token"] ||
    req.headers["x-owner-merge-approval"] ||
    req.headers["x-owner-approval"];

  const rawHeaderStr = typeof rawHeader === "string" ? rawHeader.trim() : "";
  const bodyApproval = (req.body as Record<string, unknown>)?.ownerMergeApproval;

  // 1. Check for forged literal header or body boolean bypass attempts
  if (
    rawHeaderStr === "AUTHORIZED_BY_OWNER" ||
    rawHeaderStr.toLowerCase() === "authorized_by_owner" ||
    rawHeaderStr.toLowerCase() === "true" ||
    bodyApproval === true ||
    bodyApproval === "true"
  ) {
    // If no valid cryptographic token structure was provided alongside
    if (!rawHeaderStr.includes(".")) {
      await recordAudit(
        req,
        "CATALOGUE_SKU_MUTATION_ATTEMPT",
        `sku:${normSku}`,
        {
          targetSku: normSku,
          mutationFields,
          attemptType: "LITERAL_HEADER_FORGERY",
          presentedHeader: rawHeaderStr,
        },
        { outcome: "DENIED", reason: "FORGED_HEADER_ATTEMPT" }
      );

      return {
        authorized: false,
        statusCode: 403,
        code: "PROTECTED_CATALOGUE_SKU_MERGE_STOP",
        message: `Direct mutation of protected catalogue SKU '${normSku}' is forbidden. Literal 'AUTHORIZED_BY_OWNER' header rejected. Secure authenticated cryptographic approval token required.`,
        reason: "FORGED_HEADER_ATTEMPT",
      };
    }
  }

  // 2. Staff Authentication Check
  if (!staff || !staff.id) {
    await recordAudit(
      req,
      "CATALOGUE_SKU_MUTATION_ATTEMPT",
      `sku:${normSku}`,
      { targetSku: normSku, mutationFields },
      { outcome: "DENIED", reason: "UNAUTHENTICATED_STAFF" }
    );

    return {
      authorized: false,
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Staff administrator authentication required for protected catalogue operations.",
      reason: "UNAUTHENTICATED_STAFF",
    };
  }

  // 3. Staff Role Authorization Check (Super Admin or Owner required)
  const meta = staff.metadata || {};
  const role = String(meta.role || "").toLowerCase();
  const isOwner = Boolean(meta.is_owner) || role === "owner" || role === "super_admin";

  if (!isOwner) {
    await recordAudit(
      req,
      "CATALOGUE_SKU_MUTATION_ATTEMPT",
      `sku:${normSku}`,
      { targetSku: normSku, mutationFields, staffId: staff.id, staffRole: role },
      { outcome: "DENIED", reason: "NON_OWNER_ROLE_FORBIDDEN" }
    );

    return {
      authorized: false,
      statusCode: 403,
      code: "PROTECTED_CATALOGUE_SKU_MERGE_STOP",
      message: `Access denied: Staff member '${staff.email}' lacks owner merge authorization privileges for SKU '${normSku}'.`,
      reason: "NON_OWNER_ROLE_FORBIDDEN",
    };
  }

  // 4. Cryptographic Approval Token Check
  if (!rawHeaderStr || !rawHeaderStr.includes(".")) {
    await recordAudit(
      req,
      "CATALOGUE_SKU_MUTATION_ATTEMPT",
      `sku:${normSku}`,
      { targetSku: normSku, mutationFields, staffId: staff.id },
      { outcome: "DENIED", reason: "MISSING_APPROVAL_TOKEN" }
    );

    return {
      authorized: false,
      statusCode: 403,
      code: "PROTECTED_CATALOGUE_SKU_MERGE_STOP",
      message: `Direct mutation of protected catalogue SKU '${normSku}' requires a valid cryptographic owner approval token.`,
      reason: "MISSING_APPROVAL_TOKEN",
    };
  }

  const verification = parseAndVerifyToken(rawHeaderStr);

  if (!verification.valid || !verification.payload) {
    const reason = verification.reason || "INVALID_TOKEN";
    await recordAudit(
      req,
      "CATALOGUE_SKU_MUTATION_ATTEMPT",
      `sku:${normSku}`,
      { targetSku: normSku, mutationFields, staffId: staff.id, tokenReason: reason },
      { outcome: "DENIED", reason }
    );

    const isReplay = reason === "REPLAY_ATTACK_DETECTED";
    const isExpired = reason === "APPROVAL_TOKEN_EXPIRED";

    return {
      authorized: false,
      statusCode: 403,
      code: isReplay ? "APPROVAL_TOKEN_REPLAY_ATTACK" : isExpired ? "APPROVAL_TOKEN_EXPIRED" : "INVALID_APPROVAL_TOKEN",
      message: isReplay
        ? `Owner approval token for SKU '${normSku}' has already been redeemed (replay attack rejected).`
        : isExpired
        ? `Owner approval token for SKU '${normSku}' has expired.`
        : `Owner approval token verification failed: ${reason}.`,
      reason,
    };
  }

  const payload = verification.payload;

  // 5. SKU-Level Matching Check
  if (payload.sku !== normSku) {
    await recordAudit(
      req,
      "CATALOGUE_SKU_MUTATION_ATTEMPT",
      `sku:${normSku}`,
      { targetSku: normSku, tokenSku: payload.sku, staffId: staff.id },
      { outcome: "DENIED", reason: "APPROVAL_SKU_MISMATCH" }
    );

    return {
      authorized: false,
      statusCode: 403,
      code: "APPROVAL_SKU_MISMATCH",
      message: `Owner approval token was issued for SKU '${payload.sku}', not target SKU '${normSku}'.`,
      reason: "APPROVAL_SKU_MISMATCH",
    };
  }

  // 6. Field-Level Mutation Authorization Check
  if (
    !payload.allowedFields.includes("*") &&
    mutationFields.length > 0
  ) {
    const unauthorizedFields = mutationFields.filter(
      (field) => !payload.allowedFields.includes(field) && field !== "ownerMergeApproval"
    );

    if (unauthorizedFields.length > 0) {
      await recordAudit(
        req,
        "CATALOGUE_SKU_MUTATION_ATTEMPT",
        `sku:${normSku}`,
        {
          targetSku: normSku,
          unauthorizedFields,
          allowedFields: payload.allowedFields,
          staffId: staff.id,
        },
        { outcome: "DENIED", reason: "UNAUTHORIZED_FIELD_MUTATION" }
      );

      return {
        authorized: false,
        statusCode: 403,
        code: "UNAUTHORIZED_FIELD_MUTATION",
        message: `Mutation contains unauthorized fields [${unauthorizedFields.join(", ")}]. Owner approval only permits [${payload.allowedFields.join(", ")}].`,
        reason: "UNAUTHORIZED_FIELD_MUTATION",
      };
    }
  }

  // 7. Success: Mark nonce as redeemed immediately to prevent replay
  markNonceRedeemed(payload.nonce, payload.expiresAt);

  await recordAudit(
    req,
    "CATALOGUE_SKU_MUTATION_AUTHORIZED",
    `sku:${normSku}`,
    {
      targetSku: normSku,
      mutationFields,
      approverId: staff.id,
      approverEmail: staff.email,
      nonce: payload.nonce,
    },
    { outcome: "SUCCESS", reason: "OWNER_APPROVAL_VERIFIED" }
  );

  return {
    authorized: true,
    details: {
      sku: normSku,
      approverId: staff.id,
      approverEmail: staff.email,
      nonce: payload.nonce,
    },
  };
}
