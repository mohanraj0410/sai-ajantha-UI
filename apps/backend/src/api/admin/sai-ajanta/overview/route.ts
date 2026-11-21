import { queryGraphAll, productStage } from "../../../../lib/admin-query-all";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

  const { data: products } = (await queryGraphAll(query, {
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "thumbnail",
      "metadata",
      "categories.name",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as {
    data: {
      id: string;
      title: string;
      handle: string;
      status: string;
      thumbnail: string | null;
      metadata?: Record<string, unknown> | null;
      categories?: { name: string }[] | null;
      variants?: {
        sku?: string | null;
        prices?: { amount: number; currency_code: string }[] | null;
        inventory_items?: {
          inventory?: {
            location_levels?: {
              stocked_quantity: number;
              reserved_quantity: number;
            }[] | null;
          } | null;
        }[] | null;
      }[] | null;
    }[];
  };

  const { data: categories } = (await queryGraphAll(query, {
    entity: "product_category",
    fields: ["id", "name", "handle"],
    pagination: { take: 200, skip: 0 },
  })) as { data: { id: string; name: string; handle: string }[] };

  const { data: stockLocations } = (await queryGraphAll(query, {
    entity: "stock_location",
    fields: ["id", "name"],
  })) as { data: { id: string; name: string }[] };

  const dmsProfiles = await dmsService.listAccountProfiles({}, { take: null });

  const items = products
    .map((p) => {
      const meta = p.metadata || {};
      const primaryVariant = p.variants?.[0];
      const levels =
        primaryVariant?.inventory_items?.[0]?.inventory?.location_levels || [];
      const totalAvailable = levels.reduce(
        (sum, lvl) =>
          sum +
          Math.max(
            0,
            (lvl.stocked_quantity || 0) - (lvl.reserved_quantity || 0)
          ),
        0
      );
      const stockQty =
        levels.length > 0
          ? totalAvailable
          : typeof meta.stock_qty === "number"
            ? meta.stock_qty
            : typeof meta.stock_qty === "string" && !isNaN(Number(meta.stock_qty))
              ? Number(meta.stock_qty)
              : 0;

      const stage = productStage(p.status, meta);
      const approved = stage === "APPROVED" || stage === "PUBLISHED";
      const active = stage === "PUBLISHED";

      return {
        id: p.id,
        legacyId: typeof meta.legacy_id === "string" ? meta.legacy_id : p.handle,
        sku:
          (typeof meta.sku === "string" ? meta.sku : null) ||
          primaryVariant?.sku ||
          p.handle,
        title: p.title,
        category:
          (typeof meta.category_name === "string" ? meta.category_name : null) ||
          p.categories?.[0]?.name ||
          "Uncategorized",
        brand: typeof meta.brand === "string" ? meta.brand : "Sai Ajantha",
        size: typeof meta.size === "string" ? meta.size : "",
        thumbnail: p.thumbnail,
        customerPriceInr:
          typeof meta.customer_price_inr === "number" ? meta.customer_price_inr : null,
        contractorPriceInr:
          typeof meta.contractor_price_inr === "number" ? meta.contractor_price_inr : null,
        dealerPriceInr:
          typeof meta.dealer_price_inr === "number" ? meta.dealer_price_inr : null,
        distributorPriceInr:
          typeof meta.distributor_price_inr === "number"
            ? meta.distributor_price_inr
            : null,
        billingUnit: typeof meta.billing_unit === "string" ? meta.billing_unit : "1 unit",
        gstRate: typeof meta.gst_rate === "number" ? meta.gst_rate : 18,
        localNasUrl: typeof meta.local_nas_url === "string" ? meta.local_nas_url : "",
        stockQty,
        stock_qty: stockQty,
        approved,
        active,
      };
    })
    .sort((a, b) => a.legacyId.localeCompare(b.legacyId));

  const categoryCounts: Record<string, number> = {};
  let withNasImages = 0;
  for (const item of items) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    if (item.thumbnail || item.localNasUrl) withNasImages++;
  }

  return res.json({
    totalProducts: items.length,
    totalCategories: categories.length,
    withNasImages,
    warehouse: stockLocations[0]?.name || "Sai Ajantha Warehouse - Trichy",
    dmsProfilesCount: dmsProfiles.length,
    categoryCounts,
    products: items,
    categories,
    stockLocations,
  });
}
