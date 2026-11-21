import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { updateUsersWorkflow } from "@medusajs/medusa/core-flows";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../../lib/permissions";

const SCOPED_OPERATIONAL_PERMS = new Set([
  "CATALOG_MANAGE",
  "ORDERS_MANAGE",
  "CUSTOMERS_MANAGE",
  "ANALYTICS_VIEW",
  "ENQUIRIES_MANAGE",
]);

const UpdateStaffSchema = z.object({
  first_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  active: z.boolean().optional(),
  permissions: z.array(z.string().trim()).optional(),
});

interface MedusaUserRow {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  deleted_at?: Date | string | null;
  metadata?: Record<string, unknown> | null;
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const callerRole =
    typeof req.staff_user?.metadata?.role === "string" ? req.staff_user.metadata.role : "admin";
  if (callerRole !== "admin" && callerRole !== "super_admin") {
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "Only active full administrators may modify staff permissions or status.",
    });
  }

  const targetId = req.params.id;
  const parsed = UpdateStaffSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }
  const body = parsed.data;

  const userModule = req.scope.resolve(Modules.USER) as {
    listUsers: (filters?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<MedusaUserRow[]>;
  };

  const allUsers = await userModule.listUsers({}, { take: null });
  const target = allUsers.find((u) => u.id === targetId && !u.deleted_at);
  if (!target) {
    return res.status(404).json({
      code: "NOT_FOUND",
      message: "Staff account not found.",
    });
  }

  if (target.id === req.staff_user?.id) {
    if (body.active === false) {
      return res.status(400).json({
        code: "SELF_DEACTIVATION_FORBIDDEN",
        message: "You cannot deactivate your own active administrator account.",
      });
    }
    if (body.permissions !== undefined) {
      return res.status(403).json({
        code: "SELF_PRIVILEGE_MODIFICATION_FORBIDDEN",
        message: "You cannot modify your own permission matrix.",
      });
    }
  }

  const targetMeta = { ...(target.metadata || {}) };
  const targetRole = typeof targetMeta.role === "string" ? targetMeta.role : "admin";
  const isTargetFullAdmin = targetRole === "admin" || targetRole === "super_admin";

  // Protect last active superadmin/admin
  if (isTargetFullAdmin && body.active === false) {
    const activeAdmins = allUsers.filter((u) => {
      if (u.deleted_at) return false;
      const m = u.metadata || {};
      const r = typeof m.role === "string" ? m.role : "admin";
      return (r === "admin" || r === "super_admin") && m.active !== false && m.suspended !== true;
    });
    if (activeAdmins.length <= 1) {
      return res.status(409).json({
        code: "LAST_ADMIN_PROTECTED",
        message: "Cannot deactivate the last remaining active administrator.",
      });
    }
  }

  if (body.permissions !== undefined) {
    if (isTargetFullAdmin) {
      return res.status(403).json({
        code: "OWNER_POLICY_LOCKED",
        message: "Full administrator permissions cannot be modified via UI (OWN-UI-07).",
      });
    }
    if (body.permissions.some((p) => p === "SETTINGS_MANAGE" || p === "*")) {
      await recordDurableAuditEvent(
        req,
        "STAFF_PRIVILEGE_ESCALATION_BLOCKED",
        `staff:${target.id}`,
        { requestedPermissions: body.permissions },
        { outcome: "DENIED", reason: "OWN-UI-07 locks SETTINGS_MANAGE / * grants" }
      );
      return res.status(403).json({
        code: "OWNER_POLICY_LOCKED",
        message: "Granting SETTINGS_MANAGE or wildcard '*' is locked pending owner policy (OWN-UI-07).",
      });
    }
  }

  const nextPerms =
    body.permissions !== undefined
      ? Array.from(new Set(body.permissions.filter((p) => SCOPED_OPERATIONAL_PERMS.has(p))))
      : Array.isArray(targetMeta.permissions)
        ? (targetMeta.permissions as string[])
        : [];

  if (!isTargetFullAdmin && body.permissions !== undefined && nextPerms.length === 0) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Scoped staff must hold at least one valid operational permission.",
    });
  }

  const nextActive = body.active !== undefined ? body.active : targetMeta.active !== false;
  const nextMeta = {
    ...targetMeta,
    role: targetRole,
    permissions: nextPerms,
    active: nextActive,
    suspended: !nextActive,
    updated_by: req.staff_user?.id || "admin",
  };

  await updateUsersWorkflow(req.scope).run({
    input: {
      updates: [
        {
          id: target.id,
          ...(body.first_name !== undefined ? { first_name: body.first_name } : {}),
          ...(body.last_name !== undefined ? { last_name: body.last_name } : {}),
          metadata: nextMeta,
        },
      ],
    },
  });

  await recordDurableAuditEvent(
    req,
    body.active !== undefined && body.active !== (targetMeta.active !== false)
      ? body.active
        ? "STAFF_REACTIVATE"
        : "STAFF_DEACTIVATE"
      : "STAFF_UPDATE",
    `staff:${target.id}`,
    {
      targetEmail: target.email,
      role: targetRole,
      permissions: nextPerms,
      active: nextActive,
    },
    { required: true }
  );

  return res.json({
    staff: {
      id: target.id,
      email: target.email,
      first_name: body.first_name !== undefined ? body.first_name : (target.first_name ?? null),
      last_name: body.last_name !== undefined ? body.last_name : (target.last_name ?? null),
      role: targetRole,
      permissions: nextPerms,
      active: nextActive,
      is_full_admin: isTargetFullAdmin,
      is_self: false,
    },
  });
}
