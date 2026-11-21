import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../lib/db";
import { checkStaffPermission } from "../../../../../lib/permissions";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    if (!checkStaffPermission(req, res, "FINANCE_MANAGE")) {
      return;
    }

    const pool = getPgPool();

    // 1. Payment collections & statuses
    const ordersRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_orders,
        COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END)::int as paid_orders_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_inr END), 0)::numeric as paid_amount_inr,
        COUNT(CASE WHEN bank_proof_status = 'UTR_SUBMITTED' THEN 1 END)::int as pending_bank_verifications_count,
        COALESCE(SUM(CASE WHEN bank_proof_status = 'UTR_SUBMITTED' THEN total_inr END), 0)::numeric as pending_bank_amount_inr,
        COUNT(CASE WHEN payment_status = 'FAILED' OR bank_proof_status = 'REJECTED' THEN 1 END)::int as rejected_or_failed_count
      FROM "dms_trade_order"
    `);

    // 2. Returns and restocked summary
    const returnsRes = await pool.query(`
      SELECT
        COUNT(*)::int as total_returns,
        COUNT(CASE WHEN status = 'REQUESTED' THEN 1 END)::int as pending_inspection_count,
        COALESCE(SUM(inspected_qty_accepted), 0)::int as total_restocked_units,
        COALESCE(SUM(inspected_qty_scrapped), 0)::int as total_scrapped_units
      FROM "dms_order_return"
    `);

    // 3. Financial documents summary
    const docsRes = await pool.query(`
      SELECT
        COUNT(CASE WHEN doc_type = 'PROFORMA' THEN 1 END)::int as proforma_count,
        COUNT(CASE WHEN doc_type = 'DRAFT_INVOICE' THEN 1 END)::int as draft_invoice_count,
        COUNT(CASE WHEN doc_type = 'DRAFT_CREDIT_NOTE' THEN 1 END)::int as draft_credit_note_count,
        COALESCE(SUM(CASE WHEN doc_type = 'DRAFT_CREDIT_NOTE' THEN total_paise END), 0)::bigint as credit_note_total_paise
      FROM "dms_financial_document"
    `);

    // 4. Exception queue: pending UTR verifications
    const exceptionsRes = await pool.query(`
      SELECT id, order_number, customer_name, customer_email, total_inr, bank_reference, created_at
      FROM "dms_trade_order"
      WHERE bank_proof_status = 'UTR_SUBMITTED'
      ORDER BY created_at ASC
      LIMIT 50
    `);

    const orderStats = ordersRes.rows[0];
    const returnStats = returnsRes.rows[0];
    const docStats = docsRes.rows[0];

    const collectedInr = Number(orderStats.paid_amount_inr || 0);
    const creditNotePaise = Number(docStats.credit_note_total_paise || 0);
    const creditNoteInr = creditNotePaise / 100;
    const netCollectionsInr = collectedInr - creditNoteInr;

    return res.json({
      summary: {
        totalOrders: orderStats.total_orders,
        paidOrdersCount: orderStats.paid_orders_count,
        collectedInr,
        creditNoteInr,
        netCollectionsInr,
        pendingBankVerificationsCount: orderStats.pending_bank_verifications_count,
        pendingBankAmountInr: Number(orderStats.pending_bank_amount_inr || 0),
        rejectedOrFailedCount: orderStats.rejected_or_failed_count,
        returns: {
          totalReturns: returnStats.total_returns,
          pendingInspectionCount: returnStats.pending_inspection_count,
          totalRestockedUnits: returnStats.total_restocked_units,
          totalScrappedUnits: returnStats.total_scrapped_units,
        },
        documents: {
          proformaCount: docStats.proforma_count,
          draftInvoiceCount: docStats.draft_invoice_count,
          draftCreditNoteCount: docStats.draft_credit_note_count,
        },
      },
      exceptionQueue: exceptionsRes.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      code: "RECONCILIATION_FETCH_FAILED",
      message: err.message,
    });
  }
}
