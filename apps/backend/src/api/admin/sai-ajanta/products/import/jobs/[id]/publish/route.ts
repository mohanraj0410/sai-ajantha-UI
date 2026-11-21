import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { checkStaffPermission } from "../../../../../../../../lib/permissions";
import { recordDurableAuditEvent } from "../../../../../../../../lib/audit-logger";
import { getPgPool } from "../../../../../../../../lib/db";

function toHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

  if (job.status === "COMPLETED") {
    return res.status(409).json({
      error: `Import job '${id}' has already been published to the catalog.`,
      job,
    });
  }

  const rowsRes = await pool.query(
    `SELECT * FROM dms_product_import_row
     WHERE job_id = $1
       AND status != 'COMMITTED'
       AND severity IN ('VALID', 'WARNING')
       AND deleted_at IS NULL
     ORDER BY source_row_number ASC;`,
    [id]
  );

  const eligibleRows = rowsRes.rows;
  if (eligibleRows.length === 0) {
    return res.status(400).json({
      error: `No eligible staged rows found to commit in job '${id}'.`,
      job,
    });
  }

  // Resolve sales channel and categories
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const [{ data: channels }, { data: cats }, { data: existingProducts }] = await Promise.all([
    query.graph({ entity: "sales_channel", fields: ["id"] }) as Promise<{
      data: { id: string }[];
    }>,
    query.graph({
      entity: "product_category",
      fields: ["id", "name"],
      pagination: { take: 200, skip: 0 },
    }) as Promise<{ data: { id: string; name: string }[] }>,
    query.graph({
      entity: "product",
      fields: ["id", "metadata", "variants.sku"],
      pagination: { take: 2000, skip: 0 },
    }) as Promise<{
      data: {
        id: string;
        metadata?: Record<string, unknown> | null;
        variants?: { sku?: string | null }[] | null;
      }[];
    }>,
  ]);

  const knownSkus = new Set<string>();
  for (const ep of existingProducts) {
    const mSku = typeof ep.metadata?.sku === "string" ? ep.metadata.sku : null;
    if (mSku) knownSkus.add(mSku.trim().toUpperCase());
    for (const v of ep.variants || []) {
      if (v.sku) knownSkus.add(v.sku.trim().toUpperCase());
    }
  }

  let publishedCount = 0;
  const committedSkus: string[] = [];
  const errors: { sku: string; error: string }[] = [];

  for (const r of eligibleRows) {
    const sku = (r.sku || "").trim();
    const skuKey = sku.toUpperCase();

    if (knownSkus.has(skuKey)) {
      errors.push({ sku, error: `SKU '${sku}' already exists in live Medusa catalog.` });
      continue;
    }

    const matchedCat = cats.find(
      (c) => c.name.toLowerCase() === (r.category || "").toLowerCase()
    );

    const handle = `${toHandle(sku)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const isQuoteOnly = Boolean(r.is_quote_only || r.customer_price_inr === null);

    const reviewerEmail = (req as any).staff_user?.email || "staff@sai-ajanta.com";
    const metadata: Record<string, unknown> = {
      sku,
      brand: r.brand,
      category_name: r.category,
      subcategory_name: r.subcategory,
      billing_unit: r.billing_unit,
      customer_price_inr: r.customer_price_inr,
      dealer_price_inr: r.dealer_price_inr,
      distributor_price_inr: r.distributor_price_inr,
      gst_rate: r.gst_rate,
      tax_status: r.tax_status || (r.gst_rate !== null ? "VERIFIED" : "UNVERIFIED"),
      stock_qty: r.stock_qty,
      stock_status: r.stock_status || (r.stock_qty !== null ? "VERIFIED" : "UNVERIFIED"),
      is_manufactured: r.is_manufactured,
      seller_route: r.route,
      is_quote_only: isQuoteOnly,
      approved: true,
      approved_by: reviewerEmail,
      approved_at: new Date().toISOString(),
      cms_status: "PUBLISHED",
      published_from_job: job.id,
      published_at: new Date().toISOString(),
    };

    try {
      const prices: { amount: number; currency_code: string }[] = [];
      if (!isQuoteOnly && typeof r.customer_price_inr === "number" && r.customer_price_inr > 0) {
        prices.push({
          amount: r.customer_price_inr,
          currency_code: "inr",
        });
      }

      await createProductsWorkflow(req.scope).run({
        input: {
          products: [
            {
              title: r.product_name,
              handle,
              description: r.product_name,
              status: ProductStatus.PUBLISHED,
              category_ids: matchedCat ? [matchedCat.id] : undefined,
              sales_channels: channels[0]?.id ? [{ id: channels[0].id }] : undefined,
              metadata,
              options: [{ title: "Default", values: ["Standard"] }],
              variants: [
                {
                  title: `${sku} - ${r.billing_unit || "1 unit"}`,
                  sku,
                  options: { Default: "Standard" },
                  manage_inventory: false,
                  prices,
                },
              ],
            },
          ],
        },
      });

      knownSkus.add(skuKey);
      committedSkus.push(sku);
      publishedCount++;

      await pool.query(
        `UPDATE dms_product_import_row
         SET status = 'COMMITTED',
             review_status = 'APPROVED',
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1;`,
        [r.id, reviewerEmail]
      );
    } catch (err: any) {
      errors.push({ sku, error: err.message || String(err) });
      await pool.query(
        `UPDATE dms_product_import_row SET status = 'FAILED', errors = errors || $2::jsonb, updated_at = NOW() WHERE id = $1;`,
        [r.id, JSON.stringify([err.message || String(err)])]
      );
    }
  }

  // Update job status
  const finalStatus = publishedCount > 0 ? "COMPLETED" : "FAILED";
  await pool.query(
    `UPDATE dms_product_import_job
     SET status = $1, published_rows = $2, updated_at = NOW()
     WHERE id = $3;`,
    [finalStatus, publishedCount, job.id]
  );

  const staffEmail = (req as any).staff_user?.email || "staff@sai-ajanta.com";
  await recordDurableAuditEvent(
    req,
    "CATALOG_IMPORT_PUBLISHED",
    `dms_product_import_job:${job.id}`,
    {
      published_count: publishedCount,
      failed_count: errors.length,
      committed_skus: committedSkus.slice(0, 10),
    }
  );

  return res.status(200).json({
    jobId: job.id,
    status: finalStatus,
    publishedCount,
    failedCount: errors.length,
    committedSkus,
    errors,
  });
}
