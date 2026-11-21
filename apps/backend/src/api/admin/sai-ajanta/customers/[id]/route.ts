import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../../lib/permissions";
import {
  parseRequestBody,
  UpdateCustomerProfileSchema,
} from "../../../../../lib/validation/schemas";
import { DMS_MODULE } from "../../../../../modules/dms";
import {
  AccountRole,
  AccountStatus,
} from "../../../../../modules/dms/models/account-profile";
import DmsModuleService from "../../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CUSTOMERS_MANAGE")) {
    return;
  }

  const customerId = req.params.id;
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const profiles = await dmsService.listAccountProfiles({
    customer_id: customerId,
  });

  if (!profiles[0]) {
    return res.status(404).json({
      code: "NOT_FOUND",
      message: "Customer profile not found.",
    });
  }

  return res.json({
    customer_id: customerId,
    profile: profiles[0],
  });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CUSTOMERS_MANAGE")) {
    return;
  }

  const customerId = req.params.id;

  const validation = parseRequestBody(UpdateCustomerProfileSchema, req.body);
  if (!validation.success) {
    return res.status(400).json(validation.envelope);
  }
  const body = validation.data;

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const profiles = await dmsService.listAccountProfiles({
    customer_id: customerId,
  });

  const requestedStatus = body.status
    ? String(body.status).toUpperCase()
    : undefined;

  const isRejectAction = requestedStatus === "REJECTED";
  const nextStatus =
    requestedStatus === AccountStatus.ACTIVE || requestedStatus === "APPROVED"
      ? AccountStatus.ACTIVE
      : requestedStatus === AccountStatus.PENDING_APPROVAL
        ? AccountStatus.PENDING_APPROVAL
        : requestedStatus === AccountStatus.SUSPENDED || isRejectAction
          ? AccountStatus.SUSPENDED
          : undefined;

  const requestedRole = body.role ? String(body.role).toUpperCase() : undefined;
  const nextRole =
    requestedRole === AccountRole.DISTRIBUTOR
      ? AccountRole.DISTRIBUTOR
      : requestedRole === AccountRole.DEALER
        ? AccountRole.DEALER
        : requestedRole === AccountRole.CUSTOMER
          ? AccountRole.CUSTOMER
          : undefined;

  const rawParentDistId =
    body.parent_distributor_id !== undefined
      ? body.parent_distributor_id
      : undefined;

  if (profiles.length > 0) {
    const prevAttrs =
      (profiles[0].dynamic_attributes as Record<string, unknown> | null) || {};
    const nowIso = new Date().toISOString();
    const staffId = (req as any).auth_context?.actor_id || "staff_admin";

    // Handle trade upgrade approval
    let resolvedRole = nextRole || profiles[0].role;
    const isApprovingUpgrade =
      (nextStatus === AccountStatus.ACTIVE || requestedStatus === "APPROVED") &&
      prevAttrs.pending_upgrade_role;

    if (isApprovingUpgrade) {
      resolvedRole = String(prevAttrs.pending_upgrade_role) as AccountRole;
    }

    let validatedParentDistributorId: string | null | undefined = undefined;
    if (rawParentDistId !== undefined) {
      if (rawParentDistId === null) {
        validatedParentDistributorId = null;
      } else {
        if (resolvedRole !== AccountRole.DEALER) {
          return res.status(400).json({
            code: "INVALID_LINK_ROLE",
            message: "Only DEALER accounts may be linked to a parent distributor.",
          });
        }
        if (rawParentDistId === customerId || rawParentDistId === profiles[0].id) {
          return res.status(400).json({
            code: "SELF_LINK_FORBIDDEN",
            message: "An account cannot link to itself as its parent distributor.",
          });
        }
        const byProfileId = await dmsService.listAccountProfiles({ id: rawParentDistId });
        const byCustId =
          byProfileId.length > 0
            ? byProfileId
            : await dmsService.listAccountProfiles({ customer_id: rawParentDistId });
        const parentProfile = byCustId[0];
        if (!parentProfile) {
          return res.status(404).json({
            code: "PARENT_DISTRIBUTOR_NOT_FOUND",
            message: `Parent distributor "${rawParentDistId}" was not found.`,
          });
        }
        if (
          parentProfile.role !== AccountRole.DISTRIBUTOR ||
          parentProfile.status !== AccountStatus.ACTIVE
        ) {
          return res.status(400).json({
            code: "INVALID_PARENT_DISTRIBUTOR",
            message: "Parent distributor must be an ACTIVE account with DISTRIBUTOR role.",
          });
        }
        validatedParentDistributorId = parentProfile.id;
      }
    }

    const nextAttrs: Record<string, unknown> = {
      ...prevAttrs,
      ...(isRejectAction
        ? {
            rejection_status: "REJECTED",
            trade_application_status: "REJECTED",
            rejection_reason: body.rejection_reason || "Trade application rejected by staff administrator.",
            rejected_at: nowIso,
            rejected_by: staffId,
          }
        : nextStatus === AccountStatus.SUSPENDED
          ? {
              suspension_reason: body.rejection_reason || "Account suspended by staff administrator.",
              suspended_at: nowIso,
              suspended_by: staffId,
            }
          : nextStatus === AccountStatus.ACTIVE
            ? {
                rejection_reason: null,
                rejection_status: null,
                trade_application_status: "APPROVED",
                approved_at: nowIso,
                approved_by: staffId,
                pending_upgrade_role: null,
                pending_upgrade_status: null,
              }
            : {}),
    };

    // Immediately revoke active sessions across all devices if account is suspended, rejected, or re-roled
    const shouldRevokeSessions =
      isRejectAction ||
      nextStatus === AccountStatus.SUSPENDED ||
      resolvedRole !== profiles[0].role ||
      nextStatus !== profiles[0].status;

    if (shouldRevokeSessions) {
      nextAttrs.session_revoked_at = nowIso;
    }

    const updated = await dmsService.updateAccountProfiles({
      id: profiles[0].id,
      ...(nextStatus ? { status: nextStatus } : {}),
      role: resolvedRole,
      ...(validatedParentDistributorId !== undefined
        ? { parent_distributor_id: validatedParentDistributorId }
        : {}),
      dynamic_attributes: nextAttrs,
    });

    await recordDurableAuditEvent(req, "STAFF_ACCOUNT_LIFECYCLE_MUTATION", `customer:${customerId}`, {
      action: isRejectAction ? "REJECT" : nextStatus || "ROLE_UPDATE",
      previous_status: profiles[0].status,
      previous_role: profiles[0].role,
      new_status: nextStatus || profiles[0].status,
      new_role: resolvedRole,
      reason: body.rejection_reason ?? null,
      parent_distributor_id: validatedParentDistributorId ?? null,
      session_revoked: shouldRevokeSessions,
    });

    return res.json({ customer_id: customerId, profile: updated });
  }

  const created = await dmsService.createAccountProfiles({
    customer_id: customerId,
    role: nextRole || AccountRole.CUSTOMER,
    status: nextStatus || AccountStatus.ACTIVE,
    dynamic_attributes:
      nextStatus === AccountStatus.SUSPENDED && body.rejection_reason
        ? { rejection_reason: body.rejection_reason }
        : null,
  });

  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);
  await link.create({
    [Modules.CUSTOMER]: { customer_id: customerId },
    [DMS_MODULE]: { account_profile_id: created.id },
  });

  await recordDurableAuditEvent(req, "CUSTOMER_PROFILE_CREATE", `customer:${customerId}`, {
    status: nextStatus || AccountStatus.ACTIVE,
    role: nextRole || AccountRole.CUSTOMER,
  });

  return res.status(201).json({ customer_id: customerId, profile: created });
}
