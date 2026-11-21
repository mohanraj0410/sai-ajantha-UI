import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import {
  loadNasCatalogManifest,
  matchProductInNasManifest,
} from "../lib/nas-catalog";

interface MedusaProductNode {
  id: string;
  title: string;
  handle: string;
  metadata?: Record<string, unknown> | null;
  categories?: { id: string; name: string; handle: string }[] | null;
  variants?: { id: string; sku?: string | null }[] | null;
}

export default async function syncNasImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const manifest = loadNasCatalogManifest();
  logger.info(
    `Loaded local NAS manifest (${manifest.totalProducts} workbook products) from ${manifest.nasRoot}`
  );

  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "categories.name",
      "categories.handle",
      "variants.id",
      "variants.sku",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as { data: MedusaProductNode[] };

  const updates: {
    id: string;
    thumbnail: string;
    images: { url: string }[];
    metadata: Record<string, unknown>;
  }[] = [];

  for (const prod of products) {
    const meta = prod.metadata || {};
    const matched = matchProductInNasManifest(manifest, {
      handle: prod.handle,
      legacyId: typeof meta.legacy_id === "string" ? meta.legacy_id : null,
      sku:
        (typeof meta.sku === "string" ? meta.sku : null) ||
        prod.variants?.[0]?.sku ||
        null,
      category:
        (typeof meta.category_name === "string" ? meta.category_name : null) ||
        prod.categories?.[0]?.name ||
        null,
      title: prod.title,
    });

    if (!matched || !matched.nasUrl) {
      continue;
    }

    // BE-24 FIX: Media-only sync MUST NOT overwrite product identity, price tiers, route, stock, seller, approval status
    // Only update media fields and NAS pointers; preserve all approved pricing and lifecycle state
    const existingMeta = (meta || {}) as Record<string, unknown>;
    updates.push({
      id: prod.id,
      thumbnail: matched.nasUrl,
      images: [{ url: matched.nasUrl }],
      metadata: {
        ...existingMeta,
        legacy_id: existingMeta.legacy_id ?? matched.id,
        product_number: existingMeta.product_number ?? matched.productNumber,
        sku: existingMeta.sku ?? matched.sku,
        category_name: existingMeta.category_name ?? matched.category,
        local_nas_path: matched.nasRelativePath,
        local_nas_url: matched.nasUrl,
        // Explicitly preserve existing price tiers and approval status
        approved: existingMeta.approved !== undefined ? existingMeta.approved : matched.approved,
        customer_price_inr: existingMeta.customer_price_inr !== undefined ? existingMeta.customer_price_inr : matched.customerPriceInr,
        contractor_price_inr: existingMeta.contractor_price_inr !== undefined ? existingMeta.contractor_price_inr : matched.contractorPriceInr,
        dealer_price_inr: existingMeta.dealer_price_inr !== undefined ? existingMeta.dealer_price_inr : matched.dealerPriceInr,
        distributor_price_inr: existingMeta.distributor_price_inr !== undefined ? existingMeta.distributor_price_inr : matched.distributorPriceInr,
      },
    });
  }

  for (let i = 0; i < updates.length; i += 25) {
    await updateProductsWorkflow(container).run({
      input: { products: updates.slice(i, i + 25) },
    });
  }

  logger.info(
    `Updated ${updates.length} Medusa products with local NAS image URLs and metadata.`
  );
}
