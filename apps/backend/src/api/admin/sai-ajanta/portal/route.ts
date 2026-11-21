import { queryGraphAll, productStage } from "../../../../lib/admin-query-all";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  RawTradeOrder,
  RawTradePayment,
  serializeTradeOrder,
  serializeTradePayment,
} from "../../../../lib/order-serializer";
import { hasStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

interface PortalCustomerGraph {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company_name?: string | null;
  created_at?: Date | string;
}

interface PortalProductGraph {
  id: string;
  title: string;
  description?: string | null;
  handle: string;
  status: string;
  thumbnail: string | null;
  images?: { url: string }[] | null;
  categories?: { name: string }[] | null;
  metadata?: Record<string, unknown> | null;
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
}

function toIso(v: Date | string | undefined): string {
  if (!v) return new Date().toISOString();
  return v instanceof Date ? v.toISOString() : String(v);
}

function mapDmsRoleToStorefront(dmsRole?: string): string {
  const upper = (dmsRole || "RETAIL").toUpperCase();
  if (upper === "DEALER" || upper === "CONTRACTOR") return "DEALER";
  if (upper === "DISTRIBUTOR") return "DISTRIBUTOR";
  return "CUSTOMER";
}

function mapDmsStatusToStorefront(
  dmsStatus?: string,
  dynamicAttrs?: Record<string, unknown> | null
): string {
  if (
    dynamicAttrs?.rejection_status === "REJECTED" ||
    dynamicAttrs?.trade_application_status === "REJECTED"
  ) {
    return "REJECTED";
  }
  const upper = (dmsStatus || "ACTIVE").toUpperCase();
  if (upper === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (upper === "SUSPENDED") return "SUSPENDED";
  if (upper === "REJECTED") return "REJECTED";
  return "APPROVED";
}

export interface PortalSelection {
  customerIds?: string[];
  productIds?: string[];
  orderIds?: string[];
  enquiryIds?: string[];
}

export async function loadPortalSnapshot(req: MedusaRequest, selection?: PortalSelection) {
  const staff = req.staff_user;
  const canCustomers = hasStaffPermission(staff, "CUSTOMERS_MANAGE");
  const canOrders = hasStaffPermission(staff, "ORDERS_MANAGE");
  const canEnquiries = hasStaffPermission(staff, "ENQUIRIES_MANAGE");
  const canCatalog =
    hasStaffPermission(staff, "CATALOG_MANAGE") ||
    hasStaffPermission(staff, "ANALYTICS_VIEW");

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

  const [{ data: customers }, { data: products }, profiles, rawOrders, rawPayments, rawEnquiries] =
    await Promise.all([
      (!canCustomers || (selection && !selection.customerIds?.length) ? Promise.resolve({ data: [] }) : (selection ? query.graph.bind(query) : (input: any) => queryGraphAll(query, input))({
        entity: "customer",
        filters: selection?.customerIds ? { id: selection.customerIds } : {},
        fields: [
          "id",
          "email",
          "first_name",
          "last_name",
          "phone",
          "company_name",
          "created_at",
        ],
        pagination: { take: selection?.customerIds?.length || 100, skip: 0 },
      })) as Promise<{ data: PortalCustomerGraph[] }>,
      (!canCatalog || (selection && !selection.productIds?.length) ? Promise.resolve({ data: [] }) : (selection ? query.graph.bind(query) : (input: any) => queryGraphAll(query, input))({
        entity: "product",
        filters: selection?.productIds ? { id: selection.productIds } : {},
        fields: [
          "id",
          "title",
          "description",
          "handle",
          "status",
          "thumbnail",
          "images.url",
          "categories.name",
          "metadata",
          "variants.sku",
          "variants.prices.amount",
          "variants.prices.currency_code",
          "variants.inventory_items.inventory.location_levels.stocked_quantity",
          "variants.inventory_items.inventory.location_levels.reserved_quantity",
        ],
        pagination: { take: selection?.productIds?.length || 100, skip: 0 },
      })) as Promise<{ data: PortalProductGraph[] }>,
      !canCustomers || (selection && !selection.customerIds?.length) ? Promise.resolve([]) : dmsService.listAccountProfiles(selection?.customerIds ? { customer_id: selection.customerIds } : {}, { take: null }),
      (!canOrders || (selection && !selection.orderIds?.length) ? Promise.resolve([]) : dmsService.listTradeOrders(selection?.orderIds ? { id: selection.orderIds } : {}, { take: null })) as Promise<unknown> as Promise<RawTradeOrder[]>,
      (!canOrders || (selection && !selection.orderIds?.length) ? Promise.resolve([]) : dmsService.listTradePayments(selection?.orderIds ? { order_id: selection.orderIds } : {}, { take: null })) as Promise<unknown> as Promise<RawTradePayment[]>,
      !canEnquiries || (selection && !selection.enquiryIds?.length) ? Promise.resolve([]) : dmsService.listTradeEnquiries(selection?.enquiryIds ? { id: selection.enquiryIds } : {}, { take: null }),
    ]);

  const profileByCustomerId = new Map<
    string,
    (typeof profiles)[number]
  >();
  for (const prof of profiles) {
    if (prof.customer_id) {
      profileByCustomerId.set(prof.customer_id, prof);
    }
  }

  const users = customers
    .map((c) => {
      const prof = profileByCustomerId.get(c.id);
      const attrs = (prof?.dynamic_attributes || {}) as Record<string, unknown>;
      const fullName =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.email;

      return {
        id: c.id,
        name: fullName,
        email: c.email,
        phone:
          c.phone ||
          (typeof attrs.phone === "string" ? attrs.phone : ""),
        organization: prof?.business_name || c.company_name || "",
        gstin: prof?.gst_number || null,
        business_city: prof?.territory || null,
        role: mapDmsRoleToStorefront(prof?.role),
        approval_status: mapDmsStatusToStorefront(prof?.status, attrs),
        rejection_reason:
          typeof attrs.rejection_reason === "string"
            ? attrs.rejection_reason
            : null,
        approved_by: typeof attrs.approved_by === "string" ? attrs.approved_by : null,
        approved_at: typeof attrs.approved_at === "string" ? attrs.approved_at : null,
        created_at: toIso(c.created_at),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const mappedProducts = products
    .map((p) => {
      const meta = p.metadata || {};
      const primaryVariant = p.variants?.[0];
      const inrPrice = primaryVariant?.prices?.find(
        (pr) => pr.currency_code?.toLowerCase() === "inr"
      )?.amount;
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

      const id =
        typeof meta.legacy_id === "string"
          ? meta.legacy_id
          : typeof meta.legacy_product_id === "string"
            ? meta.legacy_product_id
            : p.handle || p.id;

      return {
        id,
        medusa_id: p.id,
        sku:
          (typeof meta.sku === "string" ? meta.sku : null) ||
          primaryVariant?.sku ||
          id.toUpperCase(),
        name: p.title,
        category:
          (typeof meta.category_name === "string" ? meta.category_name : null) ||
          p.categories?.[0]?.name ||
          "Hardware",
        subcategory:
          typeof meta.source_sheet === "string" ? meta.source_sheet : null,
        brand: typeof meta.brand === "string" ? meta.brand : "Sai Ajantha",
        size: typeof meta.size === "string" ? meta.size : "",
        material: typeof meta.material === "string" ? meta.material : "",
        description: p.description || "",
        src: p.thumbnail || p.images?.[0]?.url || "",
        customer_price_inr:
          typeof meta.customer_price_inr === "number"
            ? meta.customer_price_inr
            : typeof inrPrice === "number"
              ? inrPrice
              : null,
        dealer_price_inr:
          typeof meta.dealer_price_inr === "number" ? meta.dealer_price_inr : null,
        distributor_price_inr:
          typeof meta.distributor_price_inr === "number"
            ? meta.distributor_price_inr
            : null,
        billing_unit:
          typeof meta.billing_unit === "string" ? meta.billing_unit : "1 unit",
        stock_qty:
          levels.length > 0
            ? totalAvailable
            : typeof meta.stock_qty === "number"
              ? meta.stock_qty
              : 0,
        cms_status: productStage(p.status, meta),
        headline_need:
          typeof meta.headline_need === "string" ? meta.headline_need : "",
        highlights: Array.isArray(meta.highlights)
          ? (meta.highlights as string[])
          : [],
        benefits: Array.isArray(meta.benefits)
          ? (meta.benefits as string[])
          : [],
        internal_notes:
          typeof meta.internal_notes === "string" ? meta.internal_notes : "",
        spec_fields:
          meta.spec_fields && typeof meta.spec_fields === "object"
            ? (meta.spec_fields as Record<string, string>)
            : {},
        is_manufactured:
          typeof meta.is_manufactured === "boolean"
            ? meta.is_manufactured
            : true,
        approved: ["APPROVED", "PUBLISHED"].includes(productStage(p.status, meta)) ? 1 : 0,
        active: productStage(p.status, meta) === "PUBLISHED" ? 1 : 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const orderById = new Map(rawOrders.map((o) => [o.id, o]));
  const paymentsByOrder = new Map<string, RawTradePayment[]>();
  for (const p of rawPayments) {
    const list = paymentsByOrder.get(p.order_id) || [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  }

  const orders = rawOrders
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((o) => serializeTradeOrder(o, paymentsByOrder.get(o.id)));

  const payments = rawPayments
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((p) => {
      const o = orderById.get(p.order_id);
      return serializeTradePayment(p, {
        order_number: o?.order_number,
        customer_name: o?.customer_name,
      });
    });

  const enquiries = rawEnquiries
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((e) => ({
      ...e,
      created_at: toIso(e.created_at),
      updated_at: toIso(e.updated_at),
    }));

  const paidOrdersList = orders.filter((o) => o.payment_status === "PAID");
  const paidRevenueInr = paidOrdersList.reduce(
    (sum, o) => sum + (Number(o.total_inr) || 0),
    0
  );


  return {
    users: canCustomers ? users : [],
    products: canCatalog ? mappedProducts : [],
    orders: canOrders ? orders : [],
    payments: canOrders ? payments : [],
    enquiries: canEnquiries ? enquiries : [],
    reports: {
      totalUsers: canCustomers ? users.length : 0,
      pendingApplications: canCustomers
        ? users.filter((u) => u.approval_status === "PENDING_APPROVAL").length
        : 0,
      totalProducts: canCatalog ? mappedProducts.length : 0,
      lowStockProducts: canCatalog
        ? mappedProducts.filter((p) => p.stock_qty > 0 && p.stock_qty <= 10).length
        : 0,
      totalOrders: canOrders ? orders.length : 0,
      paidOrders: canOrders ? paidOrdersList.length : 0,
      paidRevenueInr: canOrders ? paidRevenueInr : 0,
      totalEnquiries: canEnquiries ? enquiries.length : 0,
    },
  };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return res.json(await loadPortalSnapshot(req));
}
