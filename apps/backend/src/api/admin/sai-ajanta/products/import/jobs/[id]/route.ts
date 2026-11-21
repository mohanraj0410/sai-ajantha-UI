import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { checkStaffPermission } from "../../../../../../../lib/permissions";
import { getPgPool } from "../../../../../../../lib/db";
import { generateErrorReportCsv } from "../../../../../../../services/import-parser.service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const { id } = req.params;
  const pool = getPgPool();

  const jobRes = await pool.query(
    `SELECT * FROM dms_product_import_job WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
    [id]
  );

  if (jobRes.rows.length === 0) {
    return res.status(404).json({ error: `Import job '${id}' not found.` });
  }

  const job = jobRes.rows[0];

  const rowsRes = await pool.query(
    `SELECT * FROM dms_product_import_row WHERE job_id = $1 AND deleted_at IS NULL ORDER BY source_row_number ASC;`,
    [id]
  );

  // If download format requested
  if (req.query.format === "csv") {
    const mappedDto = rowsRes.rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      sourceRowNumber: r.source_row_number,
      sku: r.sku,
      name: r.product_name,
      category: r.category,
      subcategory: r.subcategory,
      brand: r.brand,
      size: null,
      material: null,
      billingUnit: r.billing_unit,
      customerPriceInr: r.customer_price_inr,
      dealerPriceInr: r.dealer_price_inr,
      distributorPriceInr: r.distributor_price_inr,
      gstRate: r.gst_rate,
      stockQty: r.stock_qty,
      isManufactured: r.is_manufactured,
      src: null,
      description: "",
      isSampleRow: r.is_sample_row,
      severity: r.severity,
      route: r.route,
      isQuoteOnly: r.is_quote_only,
      errors: r.errors || [],
      warnings: r.warnings || [],
    }));

    const csvOutput = generateErrorReportCsv(mappedDto);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${job.file_name}_report.csv"`);
    return res.send(csvOutput);
  }

  return res.json({
    job,
    rows: rowsRes.rows,
  });
}
