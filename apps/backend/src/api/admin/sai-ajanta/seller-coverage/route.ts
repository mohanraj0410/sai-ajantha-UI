import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { CATEGORY_ROUTING } from "@sai-ajanta/types";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { getCommercialFeatureFlags } from "../../../../lib/feature-flags";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import { AccountRole, AccountStatus } from "../../../../modules/dms/models/account-profile";
import type DmsModuleService from "../../../../modules/dms/services";

const PIN_REGEX = /^[1-9][0-9]{5}$/;

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const rawPin = req.query.pin ? String(req.query.pin).trim() : "";
  const rawCategory = req.query.category ? String(req.query.category).trim() : "";

  if (rawPin && !PIN_REGEX.test(rawPin)) {
    return res.status(400).json({
      code: "INVALID_PIN",
      message: "PIN code must be a valid 6-digit Indian postal PIN (starting 1-9).",
    });
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const [profiles, { data: locations }, { rows: coverageRows }] = await Promise.all([
    dmsService.listAccountProfiles({}, { take: null }),
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    }) as Promise<{ data: { id: string; name: string }[] }>,
    pg.raw(
      `SELECT id, distributor_id, postal_code, category_name, category_slug, canonical_route, status, assigned_by, notes, created_at
       FROM dms_distributor_coverage
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    ),
  ]);

  // Group coverages by distributor
  const coveragesByDist = new Map<string, any[]>();
  for (const cov of coverageRows) {
    const list = coveragesByDist.get(cov.distributor_id) || [];
    list.push(cov);
    coveragesByDist.set(cov.distributor_id, list);
  }

  const distributors = profiles
    .filter((p) => (p.role || "").toUpperCase() === AccountRole.DISTRIBUTOR)
    .map((d) => {
      const distCoverages = coveragesByDist.get(d.customer_id) || coveragesByDist.get(d.id) || [];
      const activeCoverages = distCoverages.filter((c: any) => c.status === "ACTIVE");

      // Extract unique active PINs from dms_distributor_coverage
      const dbPins = Array.from(new Set(activeCoverages.map((c: any) => String(c.postal_code).trim())))
        .filter((v) => PIN_REGEX.test(v));

      // Also check dynamic_attributes for legacy attributes
      const attrs = (d.dynamic_attributes || {}) as Record<string, unknown>;
      const rawPincodes = Array.isArray(attrs.service_pincodes)
        ? (attrs.service_pincodes as unknown[])
            .map((v) => String(v).trim())
            .filter((v) => PIN_REGEX.test(v))
        : [];

      const combinedPins = Array.from(new Set([...dbPins, ...rawPincodes]));

      const linkedDealers = profiles.filter(
        (child) =>
          (child.role || "").toUpperCase() === AccountRole.DEALER &&
          (child.parent_distributor_id === d.customer_id || child.parent_distributor_id === d.id)
      );

      return {
        id: d.id,
        customer_id: d.customer_id,
        business_name: d.business_name || d.customer_id,
        status: d.status,
        territory_city: d.territory || null,
        structured_pincodes: combinedPins,
        assigned_pins: combinedPins,
        coverages: distCoverages,
        coverage_mode: combinedPins.length > 0 ? "PIN_STRUCTURED" : "UNSTRUCTURED_CITY_ONLY",
        linked_dealers_count: linkedDealers.length,
        stock_location_id: d.stock_location_id || null,
      };
    });

  // Detect duplicate active 6-digit PIN claims across distributors
  const pinClaims = new Map<string, string[]>();
  for (const dist of distributors) {
    if (dist.status !== AccountStatus.ACTIVE) continue;
    for (const pin of dist.structured_pincodes) {
      const list = pinClaims.get(pin) || [];
      if (!list.includes(dist.business_name)) {
        list.push(dist.business_name);
      }
      pinClaims.set(pin, list);
    }
  }

  const overlappingPins = Array.from(pinClaims.entries())
    .filter(([, names]) => names.length > 1)
    .map(([pin, distributorsClaiming]) => ({ pin, distributors: distributorsClaiming }));

  let simulation: Record<string, unknown> | null = null;
  if (rawPin || rawCategory) {
    const flags = getCommercialFeatureFlags();
    const categoryRoute = rawCategory
      ? CATEGORY_ROUTING[rawCategory] || "ENQUIRY_ONLY"
      : "DISTRIBUTOR_RESALE";

    if (
      rawCategory.toLowerCase().includes("floor spring") &&
      !flags.floorSpringsRouteConfirmed
    ) {
      simulation = {
        pin: rawPin || null,
        category: rawCategory,
        outcome: "ENQUIRY_ONLY_BLOCKED",
        seller_route: "ENQUIRY_ONLY",
        autoAssignedSeller: null,
        reason: "Floor Springs category route unconfirmed (DEC-003 / floorSpringsRouteConfirmed=false).",
      };
    } else if (categoryRoute === "SAI_AJANTHA_DIRECT") {
      simulation = {
        pin: rawPin || null,
        category: rawCategory,
        outcome: "DIRECT_WAREHOUSE_MATCH",
        seller_route: "SAI_AJANTHA_DIRECT",
        autoAssignedSeller: locations[0]?.name || "Sai Ajantha Central Warehouse",
        reason: "Direct catalog categories ship from Sai Ajantha Central Warehouse regardless of regional distributor PINs.",
      };
    } else if (!rawPin) {
      simulation = {
        pin: null,
        category: rawCategory || "DISTRIBUTOR_RESALE",
        outcome: "PIN_REQUIRED",
        seller_route: categoryRoute,
        autoAssignedSeller: null,
        reason: "Enter a 6-digit PIN to inspect active distributor coverage. City text alone never auto-routes.",
      };
    } else {
      const candidates = distributors.filter(
        (d) => d.status === AccountStatus.ACTIVE && d.structured_pincodes.includes(rawPin)
      );
      if (candidates.length === 0) {
        simulation = {
          pin: rawPin,
          category: rawCategory || "DISTRIBUTOR_RESALE",
          outcome: "UNMATCHED_GAP_MANUAL_ENQUIRY",
          seller_route: categoryRoute,
          autoAssignedSeller: null,
          reason: `No active distributor holds structured PIN ${rawPin}. Route to manual enquiry queue.`,
        };
      } else if (candidates.length > 1) {
        simulation = {
          pin: rawPin,
          category: rawCategory || "DISTRIBUTOR_RESALE",
          outcome: "AMBIGUOUS_OVERLAP_MANUAL_REQUIRED",
          seller_route: categoryRoute,
          autoAssignedSeller: null,
          candidates: candidates.map((c) => c.business_name),
          reason: `Multiple active distributors overlap on PIN ${rawPin}. Auto-assignment disabled pending approval priority rules.`,
        };
      } else {
        simulation = {
          pin: rawPin,
          category: rawCategory || "DISTRIBUTOR_RESALE",
          outcome: "SINGLE_CANDIDATE_PREVIEW_ONLY",
          seller_route: categoryRoute,
          autoAssignedSeller: candidates[0].business_name,
          reason: `Single active distributor covers PIN ${rawPin} (quotation-led; distributor online checkout disabled per DEC-002).`,
        };
      }
    }
  }

  const isRehearsal = process.env.ALLOW_DISPOSABLE_DB_WRITES === "true";

  return res.json({
    distributors,
    stockLocations: locations,
    overlappingPins,
    coverages: coverageRows,
    unstructuredCount: distributors.filter((d) => d.coverage_mode === "UNSTRUCTURED_CITY_ONLY").length,
    writePolicyLocked: !isRehearsal,
    ownerDecisionCode: "OWN-UI-05",
    simulation,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const body = (req.body || {}) as {
    action?: string;
    distributorId?: string;
    postalCode?: string;
    categorySlug?: string;
    categoryName?: string;
    dealerId?: string;
    parentDistributorId?: string;
    notes?: string;
  };

  const action = (body.action || "ASSIGN_COVERAGE").toUpperCase();
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  if (action === "LINK_DEALER") {
    const dealerId = body.dealerId?.trim();
    const parentDistributorId = body.parentDistributorId?.trim() || null;
    if (!dealerId) {
      return res.status(400).json({ code: "VALIDATION_FAILED", message: "dealerId is required." });
    }

    await pg.raw(
      `UPDATE account_profile
       SET parent_distributor_id = ?, updated_at = now()
       WHERE (id = ? OR customer_id = ?) AND role = 'DEALER'`,
      [parentDistributorId, dealerId, dealerId]
    );

    await recordDurableAuditEvent(
      req,
      "DEALER_LINKED_TO_DISTRIBUTOR",
      "seller-coverage:link-dealer",
      { dealerId, parentDistributorId },
      { outcome: "SUCCESS" }
    );

    return res.json({ success: true, message: "Dealer linked to distributor successfully." });
  }

  // Action: ASSIGN_COVERAGE
  const distId = (body.distributorId || "").trim();
  const pin = (body.postalCode || "").trim();
  const catSlug = (body.categorySlug || "door-closer-floor-spring").trim();
  const catName = body.categoryName || (catSlug.includes("kitchen") ? "Kitchen Basket" : "Door Closer & Floor Spring");

  if (!distId || !pin || !PIN_REGEX.test(pin)) {
    return res.status(400).json({
      code: "VALIDATION_FAILED",
      message: "A valid distributorId and 6-digit Indian PIN code (1-9 followed by 5 digits) are required.",
    });
  }

  // Verify distributor exists and is ACTIVE
  const { rows: distRows } = await pg.raw(
    `SELECT id, customer_id, business_name, status, role
     FROM account_profile
     WHERE (customer_id = ? OR id = ?) AND role = 'DISTRIBUTOR' AND deleted_at IS NULL
     LIMIT 1`,
    [distId, distId]
  );

  if (distRows.length === 0) {
    return res.status(404).json({ code: "DISTRIBUTOR_NOT_FOUND", message: `Distributor '${distId}' not found.` });
  }

  const dist = distRows[0];
  if (dist.status !== "ACTIVE") {
    return res.status(400).json({
      code: "DISTRIBUTOR_NOT_ACTIVE",
      message: `Distributor '${dist.business_name}' is not ACTIVE (status: ${dist.status}). Only active distributors can receive coverage assignments.`,
    });
  }

  // Check existing active coverage for this PIN and category
  const { rows: existingRows } = await pg.raw(
    `SELECT id, distributor_id, status FROM dms_distributor_coverage
     WHERE postal_code = ? AND category_slug = ? AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [pin, catSlug]
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if (existing.distributor_id === dist.customer_id || existing.distributor_id === dist.id) {
      return res.status(409).json({
        code: "COVERAGE_ALREADY_EXISTS",
        message: `Distributor '${dist.business_name}' already holds active coverage for PIN ${pin} in ${catName}.`,
      });
    } else {
      // Overlap detected: flag duplicate assignment warning or save with status
      const covId = `dcov_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
      await pg.raw(
        `INSERT INTO dms_distributor_coverage (id, distributor_id, postal_code, category_name, category_slug, canonical_route, status, assigned_by, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'DISTRIBUTOR_RESALE', 'ACTIVE', ?, ?, now(), now())`,
        [covId, dist.customer_id, pin, catName, catSlug, req.auth_context?.actor_id || "admin", `Overlap noted with ${existing.distributor_id}`]
      );

      await recordDurableAuditEvent(
        req,
        "SELLER_COVERAGE_OVERLAP_CREATED",
        "seller-coverage:assign",
        { distributorId: dist.customer_id, pin, category: catSlug },
        { outcome: "SUCCESS", reason: `Created overlapping active coverage for PIN ${pin}` }
      );

      return res.status(201).json({
        id: covId,
        distributorId: dist.customer_id,
        postalCode: pin,
        categorySlug: catSlug,
        status: "ACTIVE",
        hasOverlap: true,
        message: `Assigned PIN ${pin} to ${dist.business_name}. Note: PIN now has overlapping coverage.`,
      });
    }
  }

  const covId = `dcov_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  await pg.raw(
    `INSERT INTO dms_distributor_coverage (id, distributor_id, postal_code, category_name, category_slug, canonical_route, status, assigned_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'DISTRIBUTOR_RESALE', 'ACTIVE', ?, ?, now(), now())`,
    [covId, dist.customer_id, pin, catName, catSlug, req.auth_context?.actor_id || "admin", body.notes || null]
  );

  await recordDurableAuditEvent(
    req,
    "SELLER_COVERAGE_ASSIGNED",
    "seller-coverage:assign",
    { distributorId: dist.customer_id, pin, category: catSlug },
    { outcome: "SUCCESS" }
  );

  return res.status(201).json({
    id: covId,
    distributorId: dist.customer_id,
    postalCode: pin,
    categorySlug: catSlug,
    status: "ACTIVE",
    message: `PIN ${pin} assigned to distributor ${dist.business_name} successfully.`,
  });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const body = (req.body || {}) as {
    coverageId?: string;
    status?: "ACTIVE" | "REVOKED" | "SUSPENDED";
    notes?: string;
  };

  if (!body.coverageId || !body.status) {
    return res.status(400).json({ code: "VALIDATION_FAILED", message: "coverageId and status are required." });
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows } = await pg.raw(
    `UPDATE dms_distributor_coverage
     SET status = ?, notes = COALESCE(notes, '') || ' | Status changed to ' || ?, updated_at = now()
     WHERE id = ? AND deleted_at IS NULL
     RETURNING id, distributor_id, postal_code, status`,
    [body.status, body.status, body.coverageId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Coverage record not found." });
  }

  await recordDurableAuditEvent(
    req,
    "SELLER_COVERAGE_STATUS_CHANGED",
    "seller-coverage:patch",
    { coverageId: body.coverageId, newStatus: body.status },
    { outcome: "SUCCESS" }
  );

  return res.json({ success: true, coverage: rows[0] });
}
