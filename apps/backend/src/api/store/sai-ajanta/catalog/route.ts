import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

type CallerPriceTier = "ANONYMOUS" | "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ADMIN";

function sanitizeMetadata(
  meta: Record<string, unknown>,
  role: CallerPriceTier
): Record<string, unknown> {
  const sanitized = { ...meta };
  // Never leak supplier cost price or SOP Block B internal notes to public/trade
  delete sanitized.supplier_cost;
  delete sanitized.supplier_price;
  delete sanitized.cost_price;
  delete sanitized.internal_notes;

  if (role === "ADMIN") {
    return sanitized;
  }

  if (role !== "DISTRIBUTOR") {
    delete sanitized.distributor_price_inr;
    delete sanitized.distributor_price;
  }
  if (role !== "DISTRIBUTOR" && role !== "DEALER") {
    delete sanitized.dealer_price_inr;
    delete sanitized.dealer_price;
    delete sanitized.contractor_price_inr;
    delete sanitized.contractor_price;
  }
  return sanitized;
}

interface CatalogGraphProduct {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  handle: string;
  status: string;
  thumbnail: string | null;
  images?: { url: string }[] | null;
  categories?: { id: string; name: string; handle: string }[] | null;
  metadata?: Record<string, unknown> | null;
  variants?: {
    id: string;
    title: string;
    sku: string | null;
    prices?: { amount: number; currency_code: string }[] | null;
    inventory_items?: {
      inventory?: {
        location_levels?: { stocked_quantity: number; reserved_quantity: number }[] | null;
      } | null;
    }[] | null;
  }[] | null;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  let callerRole: CallerPriceTier = "ANONYMOUS";

  if (req.auth_context?.actor_type === "user") {
    callerRole = "ADMIN";
  } else if (customerId && req.auth_context?.actor_type === "customer") {
    try {
      const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE, {
        allowUnregistered: true,
      });
      if (dmsService) {
        const profiles = await dmsService.listAccountProfiles({
          customer_id: customerId,
        });
        const profile = profiles[0];
        if (profile?.status === "ACTIVE") {
          if (profile.role === "DISTRIBUTOR") callerRole = "DISTRIBUTOR";
          else if (profile.role === "DEALER") callerRole = "DEALER";
          else callerRole = "CUSTOMER";
        } else {
          callerRole = "CUSTOMER";
        }
      }
    } catch {
      callerRole = "CUSTOMER";
    }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: products } = (await query.graph({
    entity: "product",
    filters: { status: "published" },
    pagination: { take: 2000, skip: 0 },
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "handle",
      "status",
      "thumbnail",
      "images.url",
      "categories.id",
      "categories.name",
      "categories.handle",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
  })) as { data: CatalogGraphProduct[] };

  const mapped = products
    .filter((p) => {
      if (callerRole === "ADMIN") return true;
      const meta = (p.metadata || {}) as Record<string, unknown>;
      const sku =
        (typeof meta.sku === "string" ? meta.sku : "") ||
        p.variants?.[0]?.sku ||
        "";
      if (
        p.handle?.startsWith("sa-test-") ||
        sku.startsWith("SA-TEST-") ||
        meta.test_fixture === true ||
        meta.is_test_fixture === true
      ) {
        return false;
      }
      return true;
    })
    .map((p) => {
    const meta = (p.metadata || {}) as Record<string, unknown>;
    const primaryVariant = p.variants?.[0];
    const inrPrice = primaryVariant?.prices?.find(
      (pr) => pr.currency_code?.toLowerCase() === "inr"
    )?.amount;

    const levels =
      primaryVariant?.inventory_items?.[0]?.inventory?.location_levels || [];
    const totalAvailable = levels.reduce(
      (sum, lvl) =>
        sum + Math.max(0, (lvl.stocked_quantity || 0) - (lvl.reserved_quantity || 0)),
      0
    );

    const legacyId =
      typeof meta.legacy_id === "string"
        ? meta.legacy_id
        : typeof meta.legacy_product_id === "string"
          ? meta.legacy_product_id
          : p.handle || p.id;

    const rawCustomerPrice =
      typeof meta.customer_price_inr === "number"
        ? meta.customer_price_inr
        : typeof inrPrice === "number"
          ? inrPrice
          : null;

    const rawContractorPrice =
      typeof meta.contractor_price_inr === "number" ? meta.contractor_price_inr : null;
    const rawDealerPrice =
      typeof meta.dealer_price_inr === "number" ? meta.dealer_price_inr : null;
    const rawDistributorPrice =
      typeof meta.distributor_price_inr === "number"
        ? meta.distributor_price_inr
        : null;

    // Confidentiality projection: omit trade prices for unauthenticated or unauthorized callers (BE-07 / SF-01)
    const customerPriceInr = rawCustomerPrice;
    const contractorPriceInr =
      callerRole === "ADMIN" ? rawContractorPrice : null;
    const dealerPriceInr =
      callerRole === "ADMIN" || callerRole === "DISTRIBUTOR" || callerRole === "DEALER"
        ? rawDealerPrice
        : null;
    const distributorPriceInr =
      callerRole === "ADMIN" || callerRole === "DISTRIBUTOR"
        ? rawDistributorPrice
        : null;

    return {
      medusaId: p.id,
      id: legacyId,
      handle: p.handle,
      sku:
        (typeof meta.sku === "string" ? meta.sku : null) ||
        primaryVariant?.sku ||
        legacyId.toUpperCase(),
      name: p.title,
      description: p.description || null,
      category:
        (typeof meta.category_name === "string" ? meta.category_name : null) ||
        p.categories?.[0]?.name ||
        "Hardware",
      subcategory:
        typeof meta.source_sheet === "string" ? meta.source_sheet : null,
      src: p.thumbnail || p.images?.[0]?.url || "",
      images: (p.images || []).map((img) => img.url),
      customerPriceInr,
      contractorPriceInr,
      dealerPriceInr,
      distributorPriceInr,
      billingUnit:
        typeof meta.billing_unit === "string" ? meta.billing_unit : "1 unit",
      gstRate: typeof meta.gst_rate === "number" ? meta.gst_rate : 18,
      gstMode: typeof meta.gst_mode === "string" ? meta.gst_mode : "Excluded",
      stockQty:
        levels.length > 0
          ? totalAvailable
          : typeof meta.stock_qty === "number"
            ? meta.stock_qty
            : 0,
      approved: Boolean(meta.approved),
      metadata: sanitizeMetadata(meta, callerRole),
    };
  });

  mapped.sort((a, b) => a.id.localeCompare(b.id));

  return res.json({
    count: mapped.length,
    products: mapped,
  });
}
