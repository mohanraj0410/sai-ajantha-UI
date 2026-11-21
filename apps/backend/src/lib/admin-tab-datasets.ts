/** SQL projections contain one row per entity; facets exclude only the active tab. */
export const ADMIN_DATASETS = {
  partners: {
    permission: "CUSTOMERS_MANAGE",
    sql: `SELECT c.id, c.created_at, COALESCE(NULLIF(trim(concat_ws(' ',c.first_name,c.last_name)),''),c.email) AS name, COALESCE(p.role,'CUSTOMER') AS role,
      CASE WHEN p.dynamic_attributes->>'rejection_status'='REJECTED' OR p.dynamic_attributes->>'trade_application_status'='REJECTED' THEN 'REJECTED'
        WHEN p.status IN ('PENDING_APPROVAL','SUSPENDED','REJECTED') THEN p.status ELSE 'APPROVED' END AS status,
      concat_ws(' ',c.first_name,c.last_name,c.email,c.phone,p.business_name,p.territory,p.gst_number,p.dynamic_attributes->>'phone') AS search
      FROM customer c LEFT JOIN account_profile p ON p.customer_id=c.id AND p.deleted_at IS NULL WHERE c.deleted_at IS NULL`,
    tabs: { ALL: "true", PENDING_APPROVAL: "status='PENDING_APPROVAL'", APPROVED: "status='APPROVED'", REJECTED: "status IN ('SUSPENDED','REJECTED')" },
  },
  products: {
    permission: "CATALOG_MANAGE",
    sql: `SELECT p.id, p.created_at,p.title AS name,
      COALESCE(p.metadata->>'cms_status', CASE WHEN p.status='published' THEN 'PUBLISHED'
        WHEN COALESCE(p.metadata->>'approved','false') IN ('true','1') THEN 'APPROVED' ELSE 'DRAFT' END) AS status,
      COALESCE(p.metadata->>'category_name',(SELECT pc.name FROM product_category_product pcp JOIN product_category pc ON pc.id=pcp.product_category_id AND pc.deleted_at IS NULL WHERE pcp.product_id=p.id ORDER BY pc.id LIMIT 1),'Hardware') AS category,
      concat_ws(' ',p.title,p.handle,p.metadata->>'sku',(SELECT v.sku FROM product_variant v WHERE v.product_id=p.id AND v.deleted_at IS NULL ORDER BY v.variant_rank,v.id LIMIT 1),COALESCE(p.metadata->>'category_name',(SELECT pc.name FROM product_category_product pcp JOIN product_category pc ON pc.id=pcp.product_category_id AND pc.deleted_at IS NULL WHERE pcp.product_id=p.id ORDER BY pc.id LIMIT 1),'Hardware'),COALESCE(p.metadata->>'brand','Sai Ajantha')) AS search
      FROM product p WHERE p.deleted_at IS NULL`,
    tabs: { ALL: "true", PUBLISHED: "status='PUBLISHED'", NEEDS_APPROVAL: "status IN ('DRAFT','REVIEW')", DRAFT: "status='DRAFT'", APPROVED: "status='APPROVED'" },
  },
  orders: {
    permission: "ORDERS_MANAGE",
    sql: `SELECT o.id,o.created_at,o.status,o.payment_status,o.order_number,o.total_inr,
      COALESCE(to_jsonb(o)->>'assigned_distributor_id','') <> '' OR COALESCE(to_jsonb(o)->>'routing_status','') IN ('ROUTED_TO_DISTRIBUTOR','ASSIGNED_TO_DEALER','DELIVERED_BY_DEALER') AS distributor,
      concat_ws(' ',o.order_number,o.customer_name,o.customer_email,o.shipping_address) AS search
      FROM dms_trade_order o WHERE o.deleted_at IS NULL`,
    tabs: { ALL: "true", BANK_PROOF: "payment_status IN ('AWAITING_FINANCE_APPROVAL','UTR_SUBMITTED') OR status='AWAITING_FINANCE_APPROVAL'",
      ACTION: "status NOT IN ('CANCELLED','COMPLETED','DELIVERED') AND (status IN ('PENDING_PAYMENT','BOQ_QUOTE_REQUESTED','AWAITING_FINANCE_APPROVAL') OR payment_status IN ('PENDING','UNPAID','AWAITING_FINANCE_APPROVAL','UTR_SUBMITTED'))",
      PROCESSING: "status IN ('CONFIRMED','CONFIRMED_TRADE_PO','PROCESSING','PACKED','DISPATCHED')", DELIVERED: "status IN ('DELIVERED','COMPLETED')", CANCELLED: "status='CANCELLED'", PAID: "payment_status='PAID'", UNPAID: "payment_status <> 'PAID' AND status <> 'CANCELLED'" },
  },
  enquiries: {
    permission: "ENQUIRIES_MANAGE",
    sql: `SELECT id,created_at,status,role,COALESCE(lead_type,'PRODUCT_QUOTE') AS lead_type,
      COALESCE(assigned_seller_id,'') AS assigned_seller_id,
      COALESCE(assigned_seller_name,'') AS assigned_seller_name,
      COALESCE(assigned_staff_email,'') AS assigned_staff_email,
      follow_up_date,
      lower(concat_ws(' ',source,division)) AS topic,
      concat_ws(' ',name,phone,email,city,division,notes,assigned_seller_name,assigned_staff_email,status,lead_type) AS search 
      FROM dms_trade_enquiry WHERE deleted_at IS NULL`,
    tabs: {
      ALL: "true",
      NEW: "status='NEW'",
      IN_REVIEW: "status='IN_REVIEW'",
      AWAITING_CUSTOMER_DETAILS: "status='AWAITING_CUSTOMER_DETAILS'",
      AWAITING_SELLER: "status='AWAITING_SELLER'",
      QUOTE_PREPARING: "status='QUOTE_PREPARING'",
      QUOTED: "status='QUOTED'",
      QUOTE_ACCEPTED: "status='QUOTE_ACCEPTED'",
      CONVERTED_TO_ORDER: "status='CONVERTED_TO_ORDER'",
      CLOSED: "status='CLOSED'",
      OPEN: "status IN ('NEW','IN_REVIEW','AWAITING_CUSTOMER_DETAILS','AWAITING_SELLER','QUOTE_PREPARING')",
      INSTALL: "COALESCE(lead_type,'PRODUCT_QUOTE')='INSTALLATION' OR topic LIKE '%install%'",
      QUOTE: "COALESCE(lead_type,'PRODUCT_QUOTE')='PRODUCT_QUOTE' AND topic NOT LIKE '%install%'",
      RESOLVED: "status IN ('QUOTED','QUOTE_ACCEPTED','CONVERTED_TO_ORDER','CLOSED')",
    },
  },
  quotes: {
    permission: "ENQUIRIES_MANAGE",
    sql: `SELECT id,created_at,status,quote_number,customer_name,customer_email,enquiry_id,assigned_staff_email,
      concat_ws(' ',quote_number,customer_name,organization,division,status) AS search 
      FROM dms_trade_quote WHERE deleted_at IS NULL`,
    tabs: {
      ALL: "true",
      DRAFT: "status='DRAFT'",
      REVIEWED: "status='REVIEWED'",
      SHARED_NONPAYABLE: "status='SHARED_NONPAYABLE'",
      ACCEPTED: "status='ACCEPTED'",
      REJECTED: "status='REJECTED'",
      REVISION_REQUESTED: "status='REVISION_REQUESTED'",
      CONVERTED_TO_ORDER: "status='CONVERTED_TO_ORDER'",
      EXPIRED: "status='EXPIRED'",
      ARCHIVED: "status='ARCHIVED'",
    },
  },
  returns: {
    permission: "ORDERS_MANAGE",
    sql: `SELECT id,created_at,status,COALESCE(return_status,'NONE') AS return_status,COALESCE(damage_claim_status,'NONE') AS damage_claim_status,
      concat_ws(' ',order_number,customer_name,damage_notes) AS search FROM dms_trade_order WHERE deleted_at IS NULL`,
    tabs: { ALL: "true", OPEN: "return_status <> 'NONE' OR damage_claim_status <> 'NONE'", INSPECTED: "return_status='INSPECTED'", REQUESTED: "return_status IN ('REQUESTED','RETURNED')" },
  },
} as const;

export type AdminDataset = keyof typeof ADMIN_DATASETS;

export function buildAdminDatasetQuery(dataset: AdminDataset, params: Record<string, unknown>) {
  const definition = ADMIN_DATASETS[dataset];
  const tabs: Record<string, string> = definition.tabs;
  const tab = String(params.tab || "ALL");
  if (!Object.prototype.hasOwnProperty.call(tabs, tab)) throw new Error("Unsupported tab");
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];
  const add = (sql: string, value: string) => { conditions.push(sql); bindings.push(value); };
  const q = String(params.q || "").trim().toLowerCase();
  if (q) add("strpos(lower(search), ?) > 0", q);
  if (dataset === "partners" && params.role && params.role !== "ALL") add("role = ?", String(params.role));
  if (dataset === "products" && params.category && params.category !== "ALL") add("category = ?", String(params.category));
  if (dataset === "orders") {
    if (params.status && params.status !== "ALL") add("status = ?", String(params.status));
    if (params.payment && params.payment !== "ALL") add("payment_status = ?", String(params.payment));
    if (params.seller === "DIRECT") conditions.push("NOT distributor");
    if (params.seller === "DISTRIBUTOR") conditions.push("distributor");
  }
  if (dataset === "enquiries") {
    if (params.status && params.status !== "ALL") add("status = ?", String(params.status));
    if (params.customerType && params.customerType !== "ALL") add("role = ?", String(params.customerType));
    if (params.seller && params.seller !== "ALL") {
      if (params.seller === "SAI_AJANTHA") conditions.push("(assigned_seller_id = 'SAI_AJANTHA_CENTRAL' OR assigned_seller_name LIKE '%Sai Ajantha%')");
      else if (params.seller === "DISTRIBUTOR") conditions.push("assigned_seller_id NOT IN ('SAI_AJANTHA_CENTRAL','') AND assigned_seller_id IS NOT NULL");
      else if (params.seller === "AWAITING_SELLER") conditions.push("(status = 'AWAITING_SELLER' OR assigned_seller_id IS NULL OR assigned_seller_id = '')");
    }
    if (params.staff && params.staff !== "ALL") add("assigned_staff_email = ?", String(params.staff));
    if (params.leadType && params.leadType !== "ALL") {
      if (params.leadType === "INSTALL") conditions.push("(COALESCE(lead_type,'PRODUCT_QUOTE') = 'INSTALLATION' OR topic LIKE '%install%')");
      if (params.leadType === "PRODUCT_QUOTE") conditions.push("(COALESCE(lead_type,'PRODUCT_QUOTE') = 'PRODUCT_QUOTE' AND topic NOT LIKE '%install%')");
    }
  }
  for (const name of ["from", "to"] as const) {
    if (params[name]) {
      const date = new Date(String(params[name]));
      if (!Number.isFinite(date.getTime())) throw new Error("Invalid date filter");
      add(`created_at ${name === "from" ? ">=" : "<="} ?::timestamptz`, date.toISOString());
    }
  }
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 10)));
  const requestedPage = Math.max(1, Math.min(2147483647, Math.floor(Number(params.page) || 1)));
  const sortFields: Record<string, string> = { created_at: "created_at" };
  if (dataset === "partners") sortFields.name = "name";
  if (dataset === "orders") Object.assign(sortFields, { order_number: "order_number", total_inr: "total_inr" });
  if (dataset === "products") Object.assign(sortFields, {
    product: "name", category: "category",
    customer_price_inr: `(SELECT COALESCE(CASE WHEN jsonb_typeof(p.metadata->'customer_price_inr')='number' THEN (p.metadata->>'customer_price_inr')::numeric END,
      (SELECT pr.amount FROM product_variant v JOIN product_variant_price_set ps ON ps.variant_id=v.id AND ps.deleted_at IS NULL
        JOIN price pr ON pr.price_set_id=ps.price_set_id AND pr.deleted_at IS NULL AND pr.currency_code='inr'
        WHERE v.product_id=p.id AND v.deleted_at IS NULL ORDER BY v.variant_rank,v.id,pr.id LIMIT 1),0) FROM product p WHERE p.id=matching.id)`,
    stock_qty: `(SELECT COALESCE((SELECT sum(greatest(0,l.stocked_quantity-l.reserved_quantity)) FROM inventory_level l WHERE l.deleted_at IS NULL AND l.inventory_item_id =
      (SELECT vi.inventory_item_id FROM product_variant v JOIN product_variant_inventory_item vi ON vi.variant_id=v.id AND vi.deleted_at IS NULL
        WHERE v.product_id=p.id AND v.deleted_at IS NULL ORDER BY v.variant_rank,v.id,vi.id LIMIT 1)),
      CASE WHEN jsonb_typeof(p.metadata->'stock_qty')='number' THEN (p.metadata->>'stock_qty')::numeric ELSE 0 END) FROM product p WHERE p.id=matching.id)`,
  });
  const sortField = String(params.sort || "created_at");
  if (!Object.prototype.hasOwnProperty.call(sortFields, sortField)) throw new Error("Unsupported sort field");
  const sort = sortFields[sortField];
  const direction = params.direction === "ascend" ? "ASC" : "DESC";
  const facets = Object.entries(tabs).map(([key, condition]) => `'${key}', count(*) FILTER (WHERE (${condition}))`).join(",");
  // A single statement gives ids, total, facets and clamped pagination one MVCC snapshot.
  return {
    sql: `WITH base AS (${definition.sql}), scoped AS (SELECT * FROM base ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}),
      matching AS (SELECT * FROM scoped WHERE (${tabs[tab]})),
      totals AS (SELECT count(*)::int AS total FROM matching),
      paging AS (SELECT total, LEAST(?::int,GREATEST(1,CEIL(total::numeric / ?::int)::int)) AS page FROM totals)
      SELECT (SELECT jsonb_build_object(${facets}) FROM scoped) AS counts,
        paging.total,paging.page,?::int AS "pageSize",
        COALESCE((SELECT jsonb_agg(id ORDER BY sort_value ${direction},id) FROM
          (SELECT id,${sort} AS sort_value FROM matching ORDER BY sort_value ${direction},id LIMIT ? OFFSET (paging.page-1)*?) selected),'[]'::jsonb) AS ids
      FROM paging`,
    bindings: [...bindings, requestedPage, pageSize, pageSize, pageSize, pageSize],
  };
}
