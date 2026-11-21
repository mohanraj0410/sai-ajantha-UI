import { queryGraphAll } from "../../../../lib/admin-query-all";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import {
  AccountRole,
  AccountStatus,
} from "../../../../modules/dms/models/account-profile";
import DmsModuleService from "../../../../modules/dms/services";

interface CustomerRecord {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company_name?: string | null;
  created_at?: Date | string;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CUSTOMERS_MANAGE")) {
    return;
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

  const roleFilter = req.query.role ? String(req.query.role).toUpperCase() : null;
  const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : null;

  const [{ data: customers }, profiles] = await Promise.all([
    queryGraphAll(query, {
      entity: "customer",
      fields: [
        "id",
        "email",
        "first_name",
        "last_name",
        "phone",
        "company_name",
        "created_at",
      ],
      pagination: { take: 1000, skip: 0 },
    }) as Promise<{ data: CustomerRecord[] }>,
    dmsService.listAccountProfiles({}, { take: null }),
  ]);

  const profileByCustomerId = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    if (p.customer_id) {
      profileByCustomerId.set(p.customer_id, p);
    }
  }

  const results = customers
    .map((c) => {
      const prof = profileByCustomerId.get(c.id);
      const attrs = (prof?.dynamic_attributes || {}) as Record<string, unknown>;
      const fullName =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email;

      const role = (prof?.role || AccountRole.CUSTOMER).toUpperCase();
      const status =
        attrs.rejection_status === "REJECTED" || attrs.trade_application_status === "REJECTED"
          ? "REJECTED"
          : (prof?.status || AccountStatus.ACTIVE).toUpperCase();

      return {
        id: c.id,
        name: fullName,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        email: c.email,
        phone: c.phone || (typeof attrs.phone === "string" ? attrs.phone : ""),
        company_name: prof?.business_name || c.company_name || "",
        gstin: prof?.gst_number || (typeof attrs.gstin === "string" ? attrs.gstin : null),
        territory: prof?.territory || (typeof attrs.city === "string" ? attrs.city : null),
        credit_limit: typeof attrs.credit_limit === "number" ? attrs.credit_limit : 500000,
        discount_tier: typeof attrs.discount_tier === "string" ? attrs.discount_tier : "30%",
        role,
        status,
        created_at: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at || ""),
      };
    })
    .filter((c) => {
      if (roleFilter && c.role !== roleFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return res.json({ customers: results, count: results.length });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CUSTOMERS_MANAGE")) {
    return;
  }
  const body = (req.body || {}) as {
    email?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    phone?: string;
    company_name?: string;
    business_name?: string;
    gstin?: string;
    gst_number?: string;
    territory?: string;
    city?: string;
    role?: string;
    status?: string;
    credit_limit?: number;
    discount_tier?: string;
    notes?: string;
  };

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ message: "Valid email address is required." });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

  let firstName = (body.first_name || "").trim();
  let lastName = (body.last_name || "").trim();
  if (!firstName && body.name) {
    const parts = body.name.trim().split(" ");
    firstName = parts[0] || "Distributor";
    lastName = parts.slice(1).join(" ");
  }
  if (!firstName) firstName = "Distributor";

  const companyName = (body.company_name || body.business_name || firstName).trim();
  const phone = (body.phone || "").trim();
  const gstin = (body.gstin || body.gst_number || "").trim().toUpperCase();
  const territory = (body.territory || body.city || "Tamil Nadu").trim();

  const reqRole = (body.role || "DISTRIBUTOR").toUpperCase();
  const role =
    reqRole === "DEALER"
      ? AccountRole.DEALER
      : reqRole === "CUSTOMER"
        ? AccountRole.CUSTOMER
        : AccountRole.DISTRIBUTOR;

  const defaultStatusForRole =
    role === AccountRole.DEALER || role === AccountRole.DISTRIBUTOR
      ? "PENDING_APPROVAL"
      : "ACTIVE";
  const reqStatus = (body.status || defaultStatusForRole).toUpperCase();
  const status =
    reqStatus === "ACTIVE"
      ? AccountStatus.ACTIVE
      : reqStatus === "SUSPENDED"
        ? AccountStatus.SUSPENDED
        : AccountStatus.PENDING_APPROVAL;

  const creditLimit = typeof body.credit_limit === "number" ? body.credit_limit : 500000;
  const discountTier = body.discount_tier || "30%";

  // Check if customer exists in Medusa
  const { data: existingCustomers } = (await queryGraphAll(query, {
    entity: "customer",
    fields: ["id", "email"],
    filters: { email },
  })) as { data: { id: string; email: string }[] };

  let customerId: string;

  if (existingCustomers && existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;
  } else {
    const { result: createdCustomers } = await createCustomersWorkflow(req.scope).run({
      input: {
        customersData: [
          {
            email,
            first_name: firstName,
            last_name: lastName || undefined,
            phone: phone || undefined,
            company_name: companyName,
          },
        ],
      },
    });
    customerId = createdCustomers[0].id;
  }

  // Check or create DMS Account Profile
  const existingProfiles = await dmsService.listAccountProfiles({
    customer_id: customerId,
  });

  const dynamicAttributes = {
    phone,
    city: territory,
    gstin,
    credit_limit: creditLimit,
    discount_tier: discountTier,
    notes: body.notes || "",
    updated_at: new Date().toISOString(),
  };

  let profile;
  if (existingProfiles.length > 0) {
    const prevAttrs = (existingProfiles[0].dynamic_attributes as Record<string, unknown> | null) || {};
    profile = await dmsService.updateAccountProfiles({
      id: existingProfiles[0].id,
      role,
      status,
      business_name: companyName,
      gst_number: gstin || null,
      territory,
      dynamic_attributes: {
        ...prevAttrs,
        ...dynamicAttributes,
      },
    });
  } else {
    profile = await dmsService.createAccountProfiles({
      customer_id: customerId,
      role,
      status,
      business_name: companyName,
      gst_number: gstin || null,
      territory,
      dynamic_attributes: dynamicAttributes,
    });

    const link = req.scope.resolve(ContainerRegistrationKeys.LINK);
    await link.create({
      [Modules.CUSTOMER]: { customer_id: customerId },
      [DMS_MODULE]: { account_profile_id: profile.id },
    });
  }

  await recordDurableAuditEvent(req, "CUSTOMER_ACCOUNT_CREATE", `customer:${customerId}`, {
    role,
    status,
    territory,
  });

  return res.status(201).json({
    customer: {
      id: customerId,
      name: `${firstName} ${lastName}`.trim(),
      email,
      phone,
      company_name: companyName,
      gstin,
      territory,
      credit_limit: creditLimit,
      discount_tier: discountTier,
      role,
      status,
      profile_id: profile.id,
    },
  });
}
