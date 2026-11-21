import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../../lib/permissions";

const VALID_ENQUIRY_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "AWAITING_CUSTOMER_DETAILS",
  "AWAITING_SELLER",
  "QUOTE_PREPARING",
  "QUOTED",
  "QUOTE_ACCEPTED",
  "CONVERTED_TO_ORDER",
  "CLOSED",
] as const;

type EnquiryStatus = (typeof VALID_ENQUIRY_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  NEW: ["IN_REVIEW", "AWAITING_CUSTOMER_DETAILS", "AWAITING_SELLER", "CLOSED"],
  IN_REVIEW: ["AWAITING_CUSTOMER_DETAILS", "AWAITING_SELLER", "QUOTE_PREPARING", "QUOTED", "CLOSED"],
  AWAITING_CUSTOMER_DETAILS: ["IN_REVIEW", "QUOTE_PREPARING", "CLOSED"],
  AWAITING_SELLER: ["IN_REVIEW", "QUOTE_PREPARING", "CLOSED"],
  QUOTE_PREPARING: ["IN_REVIEW", "QUOTED", "CLOSED"],
  QUOTED: ["QUOTE_ACCEPTED", "QUOTE_PREPARING", "IN_REVIEW", "CLOSED"],
  QUOTE_ACCEPTED: ["CONVERTED_TO_ORDER", "QUOTE_PREPARING", "CLOSED"],
  CONVERTED_TO_ORDER: ["CLOSED"],
  CLOSED: ["IN_REVIEW"], // Admin can reopen closed enquiry
};

function normalizeCategorySlug(catName: string): string {
  const norm = (catName || "").toLowerCase().trim();
  if (norm.includes("door closer") || norm.includes("floor spring")) return "door-closer-floor-spring";
  if (norm.includes("kitchen basket")) return "kitchen-basket";
  return norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const id = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const { rows: [enquiry] } = await pg.raw(
    `SELECT * FROM dms_trade_enquiry WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  if (!enquiry) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Enquiry not found." });
  }

  // Linked quotations
  const { rows: quotes } = await pg.raw(
    `SELECT * FROM dms_trade_quote WHERE enquiry_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [id]
  );

  // Full activity timeline
  const { rows: activity } = await pg.raw(
    `SELECT * FROM dms_enquiry_activity WHERE enquiry_id = ? ORDER BY created_at ASC`,
    [id]
  );

  // Resolve recommended seller according to Sai Ajantha routing rules
  const division = enquiry.division || "";
  const isFloorSpring = division.toLowerCase().includes("floor spring") || (enquiry.notes || "").toLowerCase().includes("floor spring");
  const isDoorCloser = division.toLowerCase().includes("door closer");
  const isKitchenBasket = division.toLowerCase().includes("kitchen basket");
  const pin = (enquiry.postal_code || "").trim();

  let recommendedSeller: any = null;

  if (isFloorSpring) {
    recommendedSeller = {
      sellerId: "SAI_AJANTHA_CENTRAL",
      sellerName: "Sai Ajantha Central (Enquiry Only)",
      sellerType: "DIRECT_ENQUIRY",
      route: "ENQUIRY_ONLY",
      authorizedSellerExists: true,
      reason: "Floor Springs route unconfirmed per commercial policy DEC-003: strictly enquiry-only",
    };
  } else if (!isDoorCloser && !isKitchenBasket) {
    // 9 Direct Categories -> Sai Ajantha Central is the authorized seller
    recommendedSeller = {
      sellerId: "SAI_AJANTHA_CENTRAL",
      sellerName: "Sai Ajantha Central Warehouse",
      sellerType: "DIRECT",
      route: "SAI_AJANTHA_DIRECT",
      authorizedSellerExists: true,
      reason: "Direct fulfillment from Sai Ajantha Central Warehouse (9 Direct Categories)",
    };
  } else {
    // Door Closer or Kitchen Basket -> Check active distributor coverage for PIN
    const catSlug = isDoorCloser ? "door-closer-floor-spring" : "kitchen-basket";
    if (pin && /^\d{6}$/.test(pin)) {
      const { rows: covRows } = await pg.raw(
        `SELECT c.id as coverage_id, c.distributor_id, c.postal_code, c.category_slug,
                p.business_name, p.status as profile_status
         FROM dms_distributor_coverage c
         JOIN account_profile p ON p.customer_id = c.distributor_id
         WHERE c.postal_code = ? AND c.category_slug = ? AND c.status = 'ACTIVE' AND p.status = 'ACTIVE' AND c.deleted_at IS NULL
         LIMIT 1`,
        [pin, catSlug]
      );

      if (covRows.length > 0) {
        recommendedSeller = {
          sellerId: covRows[0].distributor_id,
          sellerName: covRows[0].business_name,
          sellerType: "DISTRIBUTOR",
          route: "DISTRIBUTOR_RESALE",
          authorizedSellerExists: true,
          reason: `Authorized territory distributor for PIN ${pin}`,
        };
      } else {
        recommendedSeller = {
          sellerId: null,
          sellerName: null,
          sellerType: null,
          route: "UNSERVED",
          authorizedSellerExists: false,
          reason: `No authorized distributor covers PIN ${pin} for ${isDoorCloser ? 'Door Closers' : 'Kitchen Baskets'}. Requires manual assignment or keeps in AWAITING_SELLER.`,
        };
      }
    } else {
      recommendedSeller = {
        sellerId: null,
        sellerName: null,
        sellerType: null,
        route: "PIN_REQUIRED",
        authorizedSellerExists: false,
        reason: "Valid 6-digit delivery PIN code required to route to authorized territory distributor.",
      };
    }
  }

  // Available staff users for assignment
  const { rows: staffList } = await pg.raw(
    `SELECT id, email, first_name, last_name FROM "user" LIMIT 50`
  );

  // Available contractors / dealers for installation
  const { rows: contractors } = await pg.raw(
    `SELECT customer_id as id, business_name as name, role, territory, status
     FROM account_profile
     WHERE (role = 'DEALER' OR role = 'CONTRACTOR') AND status = 'ACTIVE'
     ORDER BY business_name ASC
     LIMIT 50`
  );

  // Available active distributors (for manual override if needed)
  const { rows: distributors } = await pg.raw(
    `SELECT customer_id as id, business_name as name, role, territory, status
     FROM account_profile
     WHERE role = 'DISTRIBUTOR' AND status = 'ACTIVE'
     ORDER BY business_name ASC
     LIMIT 50`
  );

  return res.json({
    enquiry,
    quotes,
    activity,
    timeline: activity,
    recommendedSeller,
    availableStaff: staffList,
    contractors,
    distributors,
  });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const id = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const staffEmail = req.staff_user?.email || "admin@sai-ajanta.com";
  const staffId = req.staff_user?.id || "admin";

  const { rows: [enquiry] } = await pg.raw(
    `SELECT * FROM dms_trade_enquiry WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  if (!enquiry) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Enquiry not found." });
  }

  const body = (req.body || {}) as {
    action?: string;
    status?: string;
    notes?: string;
    message?: string;
    closure_reason?: string;
    seller_id?: string;
    seller_name?: string;
    seller_type?: string;
    staff_id?: string;
    staff_email?: string;
    follow_up_date?: string;
    contractor_id?: string;
    contractor_name?: string;
  };

  const action = (body.action || "").toUpperCase();
  const currentStatus = enquiry.status as EnquiryStatus;
  let nextStatus: EnquiryStatus = currentStatus;
  let activityAction = action || "UPDATE";
  let activityNotes = body.notes || "";

  // 1. Action: START_REVIEW
  if (action === "START_REVIEW") {
    nextStatus = "IN_REVIEW";
    activityAction = "REVIEW_STARTED";
    activityNotes = body.notes || "Admin initiated technical review of enquiry specifications";
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET status = 'IN_REVIEW', updated_at = now()
       WHERE id = ?`,
      [id]
    );
  }

  // 2. Action: REQUEST_DETAILS
  else if (action === "REQUEST_DETAILS") {
    if (!body.message && !body.notes) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Specify details requested from customer." });
    }
    nextStatus = "AWAITING_CUSTOMER_DETAILS";
    activityAction = "DETAILS_REQUESTED";
    activityNotes = body.message || body.notes || "Requested additional sizing or site details from customer";
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET status = 'AWAITING_CUSTOMER_DETAILS', updated_at = now()
       WHERE id = ?`,
      [id]
    );
  }

  // 3. Action: ASSIGN_SELLER
  else if (action === "ASSIGN_SELLER") {
    const sellerId = (body.seller_id || (body as any).sellerId || "").trim();
    const sellerName = (body.seller_name || (body as any).sellerName || "").trim();
    const sellerType = (body.seller_type || (body as any).sellerType || "").trim();

    if (!sellerId) {
      // If seller cannot be found, mark AWAITING_SELLER
      nextStatus = "AWAITING_SELLER";
      activityAction = "SELLER_UNASSIGNED";
      activityNotes = body.notes || "No authorized seller found. Moved to AWAITING_SELLER queue.";
      await pg.raw(
        `UPDATE dms_trade_enquiry
         SET assigned_seller_id = NULL, assigned_seller_name = NULL, assigned_seller_type = NULL, status = ?, updated_at = now()
         WHERE id = ?`,
        [nextStatus, id]
      );
    } else {
      activityAction = "SELLER_ASSIGNED";
      activityNotes = `Assigned seller: ${sellerName || sellerId} (${sellerType || "DISTRIBUTOR"})`;
      if (currentStatus === "AWAITING_SELLER" || currentStatus === "NEW") {
        nextStatus = "IN_REVIEW";
      }
      await pg.raw(
        `UPDATE dms_trade_enquiry
         SET assigned_seller_id = ?, assigned_seller_name = ?, assigned_seller_type = ?, status = ?, updated_at = now()
         WHERE id = ?`,
        [sellerId, sellerName, sellerType, nextStatus, id]
      );
    }
  }

  // 4. Action: ASSIGN_STAFF
  else if (action === "ASSIGN_STAFF") {
    const staffIdVal = (body.staff_id || (body as any).staffId || "").trim();
    const staffEmailVal = (body.staff_email || (body as any).staffEmail || "").trim();
    if (!staffEmailVal) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Staff email is required." });
    }
    activityAction = "STAFF_ASSIGNED";
    activityNotes = `Assigned to staff: ${staffEmailVal}`;
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET assigned_staff_id = ?, assigned_staff_email = ?, updated_at = now()
       WHERE id = ?`,
      [staffIdVal || null, staffEmailVal, id]
    );
  }

  // 5. Action: ASSIGN_CONTRACTOR
  else if (action === "ASSIGN_CONTRACTOR") {
    const contractorId = (body.contractor_id || (body as any).contractorId || "").trim();
    const contractorName = (body.contractor_name || (body as any).contractorName || "").trim();
    activityAction = "CONTRACTOR_ASSIGNED";
    activityNotes = `Assigned verified contractor: ${contractorName || contractorId} for independent fitting`;
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET contractor_id = ?, contractor_name = ?, updated_at = now()
       WHERE id = ?`,
      [contractorId, contractorName, id]
    );
  }

  // 6. Action: SCHEDULE_FOLLOW_UP
  else if (action === "SCHEDULE_FOLLOW_UP") {
    const fDate = body.follow_up_date || (body as any).followUpDate;
    if (!fDate) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Follow-up date is required." });
    }
    activityAction = "FOLLOW_UP_SCHEDULED";
    activityNotes = `Follow-up scheduled for ${new Date(fDate).toLocaleString('en-IN')}. Note: ${body.notes || 'Routine follow-up'}`;
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET follow_up_date = ?, updated_at = now()
       WHERE id = ?`,
      [new Date(fDate).toISOString(), id]
    );
  }

  // 7. Action: CLOSE
  else if (action === "CLOSE") {
    const reason = (body.closure_reason || (body as any).closureReason || body.notes || "").trim();
    if (!reason) {
      return res.status(400).json({ code: "VALIDATION_ERROR", message: "Closure reason is required." });
    }
    nextStatus = "CLOSED";
    activityAction = "ENQUIRY_CLOSED";
    activityNotes = `Closed: ${reason}`;
    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET status = 'CLOSED', closure_reason = ?, updated_at = now()
       WHERE id = ?`,
      [reason, id]
    );
  }

  // 8. Direct status change (or fallback)
  else if (body.status) {
    const targetStatus = body.status.trim().toUpperCase() as EnquiryStatus;
    if (!VALID_ENQUIRY_STATUSES.includes(targetStatus)) {
      return res.status(400).json({ code: "INVALID_STATUS", message: `Invalid status '${body.status}'.` });
    }

    // MANDATORY POLICY CHECK:
    // "Do not allow manually changing an enquiry to QUOTED unless a valid quotation was actually issued.
    // Use transactions and server-side state validation."
    if (targetStatus === "QUOTED") {
      const { rows: issuedQuotes } = await pg.raw(
        `SELECT id, quote_number, status
         FROM dms_trade_quote
         WHERE enquiry_id = ? AND status IN ('SHARED_NONPAYABLE', 'ACCEPTED', 'CONVERTED_TO_ORDER') AND deleted_at IS NULL
         LIMIT 1`,
        [id]
      );

      if (issuedQuotes.length === 0) {
        return res.status(400).json({
          code: "QUOTE_REQUIRED",
          message: "Cannot mark enquiry as QUOTED without an issued quotation. Please create and send a quotation first.",
        });
      }
    }

    // State machine validation
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (targetStatus !== currentStatus && !allowed.includes(targetStatus)) {
      return res.status(400).json({
        code: "INVALID_TRANSITION",
        message: `Status transition from ${currentStatus} to ${targetStatus} is not permitted.`,
      });
    }

    nextStatus = targetStatus;
    activityAction = "STATUS_CHANGED";
    activityNotes = body.notes || `Status changed from ${currentStatus} to ${targetStatus}`;

    await pg.raw(
      `UPDATE dms_trade_enquiry
       SET status = ?, updated_at = now()
       WHERE id = ?`,
      [nextStatus, id]
    );
  }

  // Log activity record
  const activityId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  await pg.raw(
    `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, from_status, to_status, actor_id, actor_email, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [activityId, id, activityAction, currentStatus, nextStatus, staffId, staffEmail, activityNotes]
  );

  await recordDurableAuditEvent(req, "ENQUIRY_UPDATE", `enquiry:${id}`, {
    id,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    action: activityAction,
    notes: activityNotes,
  });

  const { rows: [updated] } = await pg.raw(
    `SELECT * FROM dms_trade_enquiry WHERE id = ?`,
    [id]
  );

  return res.json({
    ok: true,
    enquiry: updated,
    status: nextStatus,
    message: "Enquiry updated successfully.",
  });
}
