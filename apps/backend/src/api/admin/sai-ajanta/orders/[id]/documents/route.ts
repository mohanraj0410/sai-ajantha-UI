import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getPgPool } from "../../../../../../lib/db";
import { checkStaffPermission } from "../../../../../../lib/permissions";
import { OrderLifecycleService } from "../../../../../../services/order-lifecycle.service";
import { CanonicalDocumentType } from "@sai-ajanta/types";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
      return;
    }

    const orderId = req.params.id;
    const body = (req.body || {}) as {
      docType?: CanonicalDocumentType;
      issuerLegalName?: string;
      issuerGstin?: string | null;
      buyerStateCode?: string;
    };

    if (!body.docType) {
      return res.status(400).json({
        code: "DOC_TYPE_REQUIRED",
        message: "docType is required (PROFORMA, DRAFT_INVOICE, or DRAFT_CREDIT_NOTE).",
      });
    }

    if (!["PROFORMA", "DRAFT_INVOICE", "DRAFT_CREDIT_NOTE"].includes(body.docType)) {
      return res.status(400).json({
        code: "INVALID_DOC_TYPE",
        message: "docType must be PROFORMA, DRAFT_INVOICE, or DRAFT_CREDIT_NOTE.",
      });
    }

    const pool = getPgPool();
    const document = await OrderLifecycleService.generateFinancialDocument(pool, {
      orderId,
      docType: body.docType,
      issuerLegalName: body.issuerLegalName,
      issuerGstin: body.issuerGstin,
      buyerStateCode: body.buyerStateCode,
    });

    return res.json({ document });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      code: err.code || "DOCUMENT_GENERATION_FAILED",
      message: err.message,
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
      return;
    }

    const orderId = req.params.id;
    const pool = getPgPool();
    const result = await pool.query(
      `SELECT * FROM "dms_financial_document" WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId]
    );

    return res.json({ documents: result.rows });
  } catch (err: any) {
    return res.status(500).json({
      code: "FETCH_DOCUMENTS_FAILED",
      message: err.message,
    });
  }
}
