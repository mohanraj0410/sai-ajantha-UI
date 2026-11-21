import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { AuthenticatedStaffContext } from "../api/middlewares/staff-guard";

export type StaffPermission =
  | "CUSTOMERS_MANAGE"
  | "ORDERS_MANAGE"
  | "CATALOG_MANAGE"
  | "ANALYTICS_VIEW"
  | "ENQUIRIES_MANAGE"
  | "SETTINGS_MANAGE"
  | "FINANCE_MANAGE";

/**
 * Checks whether an authenticated staff member has the required operational permission.
 * By default, staff without restricted metadata (or with role 'admin' / 'super_admin')
 * are granted access to preserve business continuity (ADM-01 / ADM-14).
 * Restricted staff accounts must explicitly carry the permission or wildcard '*'.
 */
export function hasStaffPermission(
  staffUser: AuthenticatedStaffContext | undefined,
  requiredPermission: StaffPermission
): boolean {
  if (!staffUser) return false;

  const metadata = staffUser.metadata || {};
  if (metadata.active === false || metadata.suspended === true) {
    return false;
  }

  const role = (metadata.role as string) || "admin";

  // Full administrators have unrestricted staff permissions
  if (role === "admin" || role === "super_admin") {
    return true;
  }

  // Explicit permission array in user metadata
  const permissions = Array.isArray(metadata.permissions)
    ? (metadata.permissions as string[])
    : [];

  return permissions.includes(requiredPermission) || permissions.includes("*");
}

/**
 * Enforces staff permission check directly in route handlers.
 * Emits 401 if unauthenticated, 403 if missing required permission.
 */
export function checkStaffPermission(
  req: MedusaRequest,
  res: MedusaResponse,
  permission: StaffPermission
): boolean {
  if (!req.staff_user) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Staff administrator authentication required.",
    });
    return false;
  }

  if (!hasStaffPermission(req.staff_user, permission)) {
    res.status(403).json({
      code: "FORBIDDEN",
      message: `Access forbidden: Missing required operational permission [${permission}].`,
    });
    return false;
  }

  return true;
}
