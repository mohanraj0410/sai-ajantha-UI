import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { checkStaffPermission } from "../../../../../../lib/permissions";
import { recordDurableAuditEvent } from "../../../../../../lib/audit-logger";
import { parseAndValidateImportBuffer } from "../../../../../../services/import-parser.service";
import { getPgPool } from "../../../../../../lib/db";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
      return;
    }

  const body = (req.body || {}) as {
    intentId?: string;
    fileName?: string;
    fileContentBase64?: string;
    fileContentText?: string;
  };

  const intentId = (body.intentId || `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();
  const fileName = (body.fileName || "products_import.csv").trim();

  let buffer: Buffer;
  if (body.fileContentBase64) {
    buffer = Buffer.from(body.fileContentBase64, "base64");
  } else if (body.fileContentText) {
    buffer = Buffer.from(body.fileContentText, "utf8");
  } else {
    return res.status(400).json({
      error: "Missing file content. Provide fileContentBase64 or fileContentText.",
    });
  }

  const pool = getPgPool();

  // Check for idempotent retry by intent_id
  const existingJobRes = await pool.query(
    `SELECT * FROM dms_product_import_job WHERE intent_id = $1 AND deleted_at IS NULL LIMIT 1;`,
    [intentId]
  );

  if (existingJobRes.rows.length > 0) {
    const existingJob = existingJobRes.rows[0];
    const rowsRes = await pool.query(
      `SELECT * FROM dms_product_import_row WHERE job_id = $1 AND deleted_at IS NULL ORDER BY source_row_number ASC;`,
      [existingJob.id]
    );

    return res.status(200).json({
      job: existingJob,
      rows: rowsRes.rows,
      isReplay: true,
      message: `Replaying previously staged import job '${existingJob.id}'.`,
    });
  }

  // Parse and validate the buffer using canonical parser service
  const parseResult = parseAndValidateImportBuffer({
    fileName,
    buffer,
    jobId: `pimp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  });

  if (parseResult.globalErrors.length > 0) {
    return res.status(400).json({
      error: parseResult.globalErrors.join(" | "),
      parseResult,
    });
  }

  const jobId = `pimp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const fileHash = `sha256_${Date.now().toString(36)}`; // Fast hash tag
  const staffEmail = (req as any).staff_user?.email || "staff@sai-ajanta.com";

  // Persist job atomically
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    await client.query(
      `INSERT INTO dms_product_import_job (
        id, intent_id, file_name, file_hash, status,
        total_rows, candidate_rows, excluded_samples, invalid_rows, staged_rows, published_rows,
        uploaded_by, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, NOW(), NOW());`,
      [
        jobId,
        intentId,
        fileName,
        fileHash,
        "STAGED",
        parseResult.totalRows,
        parseResult.candidateRows,
        parseResult.excludedSampleRows,
        parseResult.blockedRows,
        parseResult.validRows + parseResult.warningRows,
        staffEmail,
        JSON.stringify({ format: parseResult.fileFormat }),
      ]
    );

    for (const r of parseResult.rows) {
      await client.query(
        `INSERT INTO dms_product_import_row (
          id, job_id, source_row_number, sku, product_name, category, subcategory,
          brand, billing_unit, customer_price_inr, dealer_price_inr, distributor_price_inr,
          gst_rate, stock_qty, is_manufactured, route, is_quote_only, is_sample_row,
          severity, errors, warnings, status, review_status, tax_status, stock_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, 'STAGED', $22, $23, $24, NOW(), NOW()
        );`,
        [
          `prow_${jobId}_${r.sourceRowNumber}`,
          jobId,
          r.sourceRowNumber,
          r.sku,
          r.name,
          r.category,
          r.subcategory,
          r.brand,
          r.billingUnit,
          r.customerPriceInr,
          r.dealerPriceInr,
          r.distributorPriceInr,
          r.gstRate,
          r.stockQty,
          r.isManufactured,
          r.route,
          r.isQuoteOnly,
          r.isSampleRow,
          r.severity,
          JSON.stringify(r.errors),
          JSON.stringify(r.warnings),
          r.reviewStatus || "DRAFT",
          r.taxStatus || "UNVERIFIED",
          r.stockStatus || "UNVERIFIED",
        ]
      );
    }

    await client.query("COMMIT;");
  } catch (err: any) {
    await client.query("ROLLBACK;");
    return res.status(500).json({
      error: `Failed to persist staged import job: ${err.message || String(err)}`,
    });
  } finally {
    client.release();
  }

  await recordDurableAuditEvent(
    req,
    "CATALOG_IMPORT_STAGED",
    `dms_product_import_job:${jobId}`,
    {
      intent_id: intentId,
      file_name: fileName,
      total_rows: parseResult.totalRows,
      candidate_rows: parseResult.candidateRows,
      excluded_samples: parseResult.excludedSampleRows,
      staged_rows: parseResult.validRows + parseResult.warningRows,
    }
  );

  const jobPayload = {
    id: jobId,
    intent_id: intentId,
    file_name: fileName,
    status: "STAGED",
    total_rows: parseResult.totalRows,
    candidate_rows: parseResult.candidateRows,
    excluded_samples: parseResult.excludedSampleRows,
    invalid_rows: parseResult.blockedRows,
    staged_rows: parseResult.validRows + parseResult.warningRows,
  };

    return res.status(201).json({
      job: jobPayload,
      jobId,
      intentId,
      fileName,
      status: "STAGED",
      totalRows: parseResult.totalRows,
      candidateRows: parseResult.candidateRows,
      excludedSamples: parseResult.excludedSampleRows,
      invalidRows: parseResult.blockedRows,
      stagedRows: parseResult.validRows + parseResult.warningRows,
      rows: parseResult.rows,
    });
  } catch (outerErr: any) {
    console.error("STAGE_ROUTE_OUTER_ERROR:", outerErr);
    return res.status(500).json({
      error: outerErr.message || String(outerErr),
      stack: outerErr.stack,
    });
  }
}
