import {
  type AuthContext,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export interface AuthenticatedStaffContext {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

declare module "@medusajs/framework/http" {
  interface MedusaRequest {
    staff_user?: AuthenticatedStaffContext;
    auth_context?: AuthContext;
  }
}

/**
 * Reusable server-side guard verifying staff identity and rejecting customer/unauthenticated access.
 * Returns consistent 401 (unauthenticated) and 403 (unauthorized/customer role).
 */
export async function requireStaffAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const authContext = req.auth_context;

  // 1. Check if authentication context exists
  if (!authContext || !authContext.actor_id) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authentication required as an authorized staff administrator.",
    });
  }

  // 2. Reject non-staff actor types (e.g. customers, dealers, distributors trying to access admin APIs)
  if (authContext.actor_type !== "user") {
    return res.status(403).json({
      code: "FORBIDDEN",
      message:
        "Access forbidden: Customer and trade accounts cannot access administrative resources.",
    });
  }

  // 3. Verify that the staff user exists in the database
  try {
    const userModuleService = req.scope.resolve(Modules.USER) as {
      retrieveUser: (id: string) => Promise<{
        id: string;
        email: string;
        first_name?: string | null;
        last_name?: string | null;
        deleted_at?: Date | string | null;
      } | null>;
    };
    const user = await userModuleService.retrieveUser(authContext.actor_id);

    const meta = (user as unknown as { metadata?: Record<string, unknown> | null }).metadata || null;
    if (!user || user.deleted_at || meta?.active === false || meta?.suspended === true) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Staff administrator account not found or has been deactivated.",
      });
    }

    // Attach staff context to request for mutation audit logging
    req.staff_user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      metadata: meta,
    };

    return next();
  } catch (err: unknown) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER, {
      allowUnregistered: true,
    }) as { warn?: (msg: string) => void } | undefined;

    if (logger && typeof logger.warn === "function") {
      logger.warn(
        `Staff authentication retrieval failed for actor ${authContext.actor_id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Failed to verify staff administrator credentials.",
    });
  }
}
