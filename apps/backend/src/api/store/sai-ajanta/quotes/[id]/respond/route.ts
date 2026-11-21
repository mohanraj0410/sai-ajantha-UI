import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authentication required to respond to a quotation.",
    });
  }

  const quoteId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const { rows: [quote] } = await pg.raw(
    `SELECT * FROM dms_trade_quote WHERE (id = ? OR quote_number = ?) AND deleted_at IS NULL`,
    [quoteId, quoteId]
  );

  if (!quote) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Quotation not found." });
  }

  // Verify Ownership: Check that caller owns this quotation
  const { rows: custRows } = await pg.raw(
    `SELECT c.id, c.email, c.phone
     FROM customer c
     WHERE c.id = ? OR c.id IN (SELECT customer_id FROM account_profile WHERE id = ?)`,
    [customerId, customerId]
  );

  const validEmails: string[] = [];
  const validPhones: string[] = [];
  for (const c of custRows) {
    if (c.email) validEmails.push(c.email.toLowerCase().trim());
    if (c.phone) validPhones.push(c.phone.trim());
  }

  const isOwner =
    quote.seller_id === customerId ||
    (quote.customer_email && validEmails.includes(quote.customer_email.toLowerCase().trim())) ||
    (quote.customer_phone && validPhones.includes(quote.customer_phone.trim()));

  if (!isOwner) {
    return res.status(403).json({
      code: "FORBIDDEN",
      message: "You are not authorized to respond to this quotation.",
    });
  }

  const body = (req.body || {}) as {
    action?: string;
    notes?: string;
  };

  const action = (body.action || "").toUpperCase();
  const notes = (body.notes || "").trim();

  if (!["ACCEPT", "REJECT", "REQUEST_REVISION"].includes(action)) {
    return res.status(400).json({
      code: "INVALID_ACTION",
      message: "Action must be ACCEPT, REJECT, or REQUEST_REVISION.",
    });
  }

  // Reject already accepted or converted quotes
  if (quote.status === "ACCEPTED" || quote.status === "CONVERTED_TO_ORDER") {
    return res.status(400).json({
      code: "ALREADY_ACCEPTED",
      message: `Quotation has already been ${quote.status === "CONVERTED_TO_ORDER" ? "converted to an order" : "accepted"} and cannot be modified.`,
    });
  }

  if (quote.status === "REJECTED") {
    return res.status(400).json({
      code: "ALREADY_REJECTED",
      message: "Quotation has already been rejected and cannot be modified.",
    });
  }

  // Expiration check
  if (quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) {
    return res.status(400).json({
      code: "QUOTE_EXPIRED",
      message: "Quotation has expired and cannot be accepted.",
    });
  }

  // Quote must be in SHARED_NONPAYABLE or REVIEWED to be responded to
  if (!["SHARED_NONPAYABLE", "REVIEWED", "DRAFT"].includes(quote.status)) {
    return res.status(400).json({
      code: "INVALID_STATE",
      message: `Quotation is currently in '${quote.status}' state and cannot accept further responses.`,
    });
  }

  let nextQuoteStatus = quote.status;
  let nextEnquiryStatus = "IN_REVIEW";
  let activityAction = "CUSTOMER_RESPONSE";
  let activityNotes = notes;

  if (action === "ACCEPT") {
    nextQuoteStatus = "ACCEPTED";
    nextEnquiryStatus = "QUOTE_ACCEPTED";
    activityAction = "QUOTE_ACCEPTED";
    activityNotes = notes || "Customer reviewed and accepted the quotation.";
  } else if (action === "REJECT") {
    nextQuoteStatus = "REJECTED";
    nextEnquiryStatus = "CLOSED";
    activityAction = "QUOTE_REJECTED";
    activityNotes = notes ? `Customer declined quote: ${notes}` : "Customer declined the quotation.";
  } else if (action === "REQUEST_REVISION") {
    nextQuoteStatus = "REVISION_REQUESTED";
    nextEnquiryStatus = "QUOTE_PREPARING";
    activityAction = "REVISION_REQUESTED";
    activityNotes = notes ? `Customer requested revision: ${notes}` : "Customer requested adjustments to quoted items or pricing.";
  }

  const nowIso = new Date().toISOString();

  // Update Quotation
  await pg.raw(
    `UPDATE dms_trade_quote
     SET status = ?,
         customer_response = ?,
         customer_response_notes = ?,
         customer_response_at = ?,
         updated_at = now()
     WHERE id = ?`,
    [nextQuoteStatus, action, activityNotes, nowIso, quote.id]
  );

  // If quote has linked enquiry, update enquiry
  if (quote.enquiry_id) {
    if (action === "REJECT") {
      await pg.raw(
        `UPDATE dms_trade_enquiry
         SET status = 'CLOSED', closure_reason = ?, updated_at = now()
         WHERE id = ?`,
        [activityNotes, quote.enquiry_id]
      );
    } else {
      await pg.raw(
        `UPDATE dms_trade_enquiry
         SET status = ?, updated_at = now()
         WHERE id = ?`,
        [nextEnquiryStatus, quote.enquiry_id]
      );
    }

    const actId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    await pg.raw(
      `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, from_status, to_status, actor_id, actor_email, notes, created_at)
       VALUES (?, ?, ?, 'QUOTED', ?, 'customer', ?, ?, now())`,
      [actId, quote.enquiry_id, activityAction, nextEnquiryStatus, quote.customer_email || "customer", activityNotes]
    );
  }

  return res.json({
    ok: true,
    quoteId: quote.id,
    quoteNumber: quote.quote_number,
    action,
    quoteStatus: nextQuoteStatus,
    enquiryStatus: nextEnquiryStatus,
    message: action === "ACCEPT"
      ? `Quotation ${quote.quote_number} accepted. Our team will verify commercial eligibility and proceed.`
      : action === "REJECT"
      ? `Quotation ${quote.quote_number} declined.`
      : `Revision request for ${quote.quote_number} submitted to our technical desk.`,
  });
}
