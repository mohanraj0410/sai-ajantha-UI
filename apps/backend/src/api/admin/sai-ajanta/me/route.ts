import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { hasStaffPermission, type StaffPermission } from "../../../../lib/permissions";

const ALL_PERMS: StaffPermission[] = [
  "CATALOG_MANAGE",
  "ORDERS_MANAGE",
  "CUSTOMERS_MANAGE",
  "ANALYTICS_VIEW",
  "ENQUIRIES_MANAGE",
  "SETTINGS_MANAGE",
];

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const staff = req.staff_user;
  if (!staff) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Staff administrator authentication required.",
    });
  }

  const meta = staff.metadata || {};
  const role = typeof meta.role === "string" ? meta.role : "admin";
  const isFullAdmin = role === "admin" || role === "super_admin";
  const permissions = ALL_PERMS.filter((p) => hasStaffPermission(staff, p));

  return res.json({
    staff: {
      id: staff.id,
      email: staff.email,
      firstName: staff.first_name ?? null,
      lastName: staff.last_name ?? null,
      role,
      permissions,
      isFullAdmin,
    },
  });
}
