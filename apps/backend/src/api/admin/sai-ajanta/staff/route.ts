import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { createUsersWorkflow, deleteUsersWorkflow } from "@medusajs/medusa/core-flows";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";

const SCOPED_OPERATIONAL_PERMS = new Set([
  "CATALOG_MANAGE",
  "ORDERS_MANAGE",
  "CUSTOMERS_MANAGE",
  "ANALYTICS_VIEW",
  "ENQUIRIES_MANAGE",
]);

const CreateStaffSchema = z.object({
  email: z.string().trim().email("Valid staff email is required."),
  first_name: z.string().trim().min(1, "First name is required.").max(80),
  last_name: z.string().trim().max(80).optional().default(""),
  password: z
    .string()
    .min(10, "Initial password must be at least 10 characters.")
    .max(128),
  role: z.string().trim().optional().default("staff"),
  permissions: z.array(z.string().trim()).min(1, "Assign at least one scoped permission."),
});

interface MedusaUserRow {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: Date | string;
  deleted_at?: Date | string | null;
  metadata?: Record<string, unknown> | null;
}

function isCallerSuperAdmin(req: MedusaRequest): boolean {
  const role = req.staff_user?.metadata?.role;
  const normalized = typeof role === "string" ? role : "admin";
  return normalized === "admin" || normalized === "super_admin";
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const userModule = req.scope.resolve(Modules.USER) as {
    listUsers: (filters?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<MedusaUserRow[]>;
  };

  const users = await userModule.listUsers({}, { take: null });
  const mapped = users
    .filter((u) => !u.deleted_at)
    .map((u) => {
      const meta = u.metadata || {};
      const role = typeof meta.role === "string" ? meta.role : "admin";
      const perms = Array.isArray(meta.permissions) ? (meta.permissions as string[]) : [];
      const active = meta.active !== false && meta.suspended !== true;
      return {
        id: u.id,
        email: u.email,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
        role,
        permissions: perms,
        active,
        is_full_admin: role === "admin" || role === "super_admin" || perms.includes("*"),
        is_self: u.id === req.staff_user?.id,
        created_at:
          u.created_at instanceof Date ? u.created_at.toISOString() : String(u.created_at || ""),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return res.json({
    staff: mapped,
    count: mapped.length,
    callerIsFullAdmin: isCallerSuperAdmin(req),
    ownerPolicyGate: {
      code: "OWN-UI-07",
      superAdminCreationLocked: true,
      note: "Super Admin & SETTINGS_MANAGE elevation requires CLI / owner sign-off; scoped operational staff can be managed here.",
    },
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  if (!isCallerSuperAdmin(req)) {
    await recordDurableAuditEvent(
      req,
      "STAFF_CREATE_DENIED",
      "staff:create",
      { reason: "Non-superadmin attempted staff provisioning" },
      { outcome: "DENIED", reason: "Requires active super_admin / admin role" }
    );
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "Only active full administrators may provision staff accounts.",
    });
  }

  const parsed = CreateStaffSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();
  const reqRole = data.role.toLowerCase();

  // Strictly block creating admin/super_admin or granting SETTINGS_MANAGE / '*' via UI (OWN-UI-07)
  if (
    reqRole === "admin" ||
    reqRole === "super_admin" ||
    data.permissions.some((p) => p === "SETTINGS_MANAGE" || p === "*")
  ) {
    await recordDurableAuditEvent(
      req,
      "STAFF_PRIVILEGE_ESCALATION_BLOCKED",
      `staff:${email}`,
      { requestedRole: reqRole, permissions: data.permissions },
      { outcome: "DENIED", reason: "OWN-UI-07 locks super_admin / SETTINGS_MANAGE grants to CLI" }
    );
    return res.status(403).json({
      code: "OWNER_POLICY_LOCKED",
      message:
        "Creating Super Admin or granting SETTINGS_MANAGE / wildcard privileges from the UI is locked pending owner delegation policy (OWN-UI-07).",
    });
  }

  const cleanPerms = Array.from(
    new Set(data.permissions.filter((p) => SCOPED_OPERATIONAL_PERMS.has(p)))
  );
  if (cleanPerms.length === 0) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "At least one valid scoped operational permission is required.",
    });
  }

  const userModule = req.scope.resolve(Modules.USER) as {
    listUsers: (filters?: Record<string, unknown>) => Promise<MedusaUserRow[]>;
  };
  const existing = await userModule.listUsers({ email });
  if (existing.length > 0) {
    return res.status(409).json({
      code: "DUPLICATE_STAFF_EMAIL",
      message: `A staff user with email "${email}" already exists.`,
    });
  }

  const { result: createdUsers } = await createUsersWorkflow(req.scope).run({
    input: {
      users: [
        {
          email,
          first_name: data.first_name,
          last_name: data.last_name || undefined,
          metadata: {
            role: "staff",
            permissions: cleanPerms,
            active: true,
            provisioned_by: req.staff_user?.id || "admin",
          },
        },
      ],
    },
  });

  const created = createdUsers[0];
  try {
    const authService = req.scope.resolve(Modules.AUTH) as {
      register: (
        provider: string,
        payload: { body: Record<string, unknown> }
      ) => Promise<{ authIdentity?: { id: string }; error?: string }>;
      updateAuthIdentities: (data: {
        id: string;
        app_metadata: Record<string, unknown>;
      }) => Promise<unknown>;
    };

    const reg = await authService.register("emailpass", {
      body: { email, password: data.password },
    });
    if (reg.error || !reg.authIdentity?.id) {
      throw new Error(reg.error || "Failed to create auth identity.");
    }
    await authService.updateAuthIdentities({
      id: reg.authIdentity.id,
      app_metadata: { user_id: created.id },
    });
  } catch (err) {
    await deleteUsersWorkflow(req.scope).run({ input: { ids: [created.id] } });
    return res.status(400).json({
      code: "STAFF_AUTH_PROVISION_FAILED",
      message: err instanceof Error ? err.message : "Failed to initialize staff password identity.",
    });
  }

  await recordDurableAuditEvent(
    req,
    "STAFF_CREATE",
    `staff:${created.id}`,
    {
      targetEmail: email,
      role: "staff",
      permissions: cleanPerms,
    },
    { required: true }
  );

  return res.status(201).json({
    staff: {
      id: created.id,
      email: created.email,
      first_name: created.first_name ?? null,
      last_name: created.last_name ?? null,
      role: "staff",
      permissions: cleanPerms,
      active: true,
      is_full_admin: false,
      is_self: false,
    },
  });
}
