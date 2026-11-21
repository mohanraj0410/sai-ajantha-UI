import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { DMS_MODULE } from "../../../../modules/dms";
import {
  AccountRole,
  AccountStatus,
} from "../../../../modules/dms/models/account-profile";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const profiles = await dmsService.listAccountProfiles({
    customer_id: customerId,
  });

  return res.json({
    customer_id: customerId,
    profile: profiles[0] || null,
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  const body = (req.body || {}) as {
    role?: string;
    business_name?: string;
    gst_number?: string;
    territory?: string;
    phone?: string;
    preferred_pins?: string[] | string;
    proposed_pins?: string[] | string;
    categories?: string[];
    invite_token?: string;
    operating_location?: string;
  };

  const requestedRole = String(body.role || "CUSTOMER").toUpperCase();
  const safeRole =
    requestedRole === AccountRole.DEALER
      ? AccountRole.DEALER
      : requestedRole === AccountRole.DISTRIBUTOR
        ? AccountRole.DISTRIBUTOR
        : AccountRole.CUSTOMER;

  // Authoritative server-side status: new trade accounts start strictly in PENDING_APPROVAL
  const status =
    safeRole === AccountRole.CUSTOMER
      ? AccountStatus.ACTIVE
      : AccountStatus.PENDING_APPROVAL;

  // Sanitize PIN inputs (comma-separated string or array of 6-digit PINs)
  function parsePinList(val?: string[] | string): string[] {
    if (!val) return [];
    const raw = Array.isArray(val) ? val.join(",") : String(val);
    return raw
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter((p) => /^\d{6}$/.test(p));
  }

  const preferredPins = parsePinList(body.preferred_pins);
  const proposedPins = parsePinList(body.proposed_pins);

  // Category restriction: Distributor applications are strictly limited to Door Closers and Kitchen Baskets
  const allowedDistributorCategories = new Set([
    "Door Closer & Floor Spring",
    "Kitchen Basket",
  ]);
  const safeCategories =
    safeRole === AccountRole.DISTRIBUTOR
      ? (body.categories || ["Door Closer & Floor Spring", "Kitchen Basket"]).filter((c) =>
          allowedDistributorCategories.has(c)
        )
      : Array.isArray(body.categories)
        ? body.categories
        : [];

  const applicationAttributes: Record<string, unknown> = {
    phone: body.phone || undefined,
    preferred_pins: preferredPins.length > 0 ? preferredPins : undefined,
    proposed_pins: proposedPins.length > 0 ? proposedPins : undefined,
    categories: safeCategories.length > 0 ? safeCategories : undefined,
    invite_token: body.invite_token ? String(body.invite_token).trim() : undefined,
    operating_location: body.operating_location ? String(body.operating_location).trim() : undefined,
    application_submitted_at: new Date().toISOString(),
  };

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const existing = await dmsService.listAccountProfiles({
    customer_id: customerId,
  });

  if (existing.length > 0) {
    const prevAttrs =
      (existing[0].dynamic_attributes as Record<string, unknown> | null) || {};

    // Prevent privilege escalation: An existing account cannot directly self-promote role or status.
    // If upgrading from CUSTOMER, record a pending trade application review.
    const isUpgradeRequest =
      safeRole !== AccountRole.CUSTOMER && existing[0].role === AccountRole.CUSTOMER;

    const updatedAttrs: Record<string, unknown> = {
      ...prevAttrs,
      ...applicationAttributes,
      phone: body.phone !== undefined ? body.phone : prevAttrs.phone,
    };

    if (isUpgradeRequest) {
      updatedAttrs.pending_upgrade_role = safeRole;
      updatedAttrs.pending_upgrade_status = AccountStatus.PENDING_APPROVAL;
    }

    const updated = await dmsService.updateAccountProfiles({
      id: existing[0].id,
      business_name: body.business_name ?? existing[0].business_name,
      gst_number: body.gst_number ?? existing[0].gst_number,
      territory: body.territory ?? existing[0].territory,
      dynamic_attributes: updatedAttrs,
    });
    return res.json({ profile: updated });
  }

  const created = await dmsService.createAccountProfiles({
    customer_id: customerId,
    role: safeRole,
    status,
    business_name: body.business_name || null,
    gst_number: body.gst_number || null,
    territory: body.territory || body.operating_location || null,
    dynamic_attributes: applicationAttributes,
  });

  const link = req.scope.resolve(ContainerRegistrationKeys.LINK);
  await link.create({
    [Modules.CUSTOMER]: { customer_id: customerId },
    [DMS_MODULE]: { account_profile_id: created.id },
  });

  return res.status(201).json({ profile: created });
}

export const PATCH = POST;
