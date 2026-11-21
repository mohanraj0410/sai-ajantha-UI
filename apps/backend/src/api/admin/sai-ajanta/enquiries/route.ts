import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ENQUIRIES_MANAGE")) {
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Derive counts from actual persisted records
  const countsQuery = `
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE status = 'NEW') AS count_new,
      count(*) FILTER (WHERE status = 'IN_REVIEW') AS count_in_review,
      count(*) FILTER (WHERE status = 'AWAITING_CUSTOMER_DETAILS') AS count_awaiting_details,
      count(*) FILTER (WHERE status = 'AWAITING_SELLER') AS count_awaiting_seller,
      count(*) FILTER (WHERE status = 'QUOTE_PREPARING') AS count_quote_preparing,
      count(*) FILTER (WHERE status = 'QUOTED') AS count_quoted,
      count(*) FILTER (WHERE status = 'QUOTE_ACCEPTED') AS count_quote_accepted,
      count(*) FILTER (WHERE status = 'CONVERTED_TO_ORDER') AS count_converted_order,
      count(*) FILTER (WHERE status = 'CLOSED') AS count_closed,
      count(*) FILTER (WHERE COALESCE(lead_type,'PRODUCT_QUOTE') = 'INSTALLATION' OR lower(concat_ws(' ',source,division)) LIKE '%install%') AS count_install,
      count(*) FILTER (WHERE COALESCE(lead_type,'PRODUCT_QUOTE') = 'PRODUCT_QUOTE' AND lower(concat_ws(' ',source,division)) NOT LIKE '%install%') AS count_product_quote
    FROM dms_trade_enquiry
    WHERE deleted_at IS NULL
  `;
  const { rows: [countsRow] } = await pg.raw(countsQuery);

  const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
  const leadType = typeof req.query.lead_type === "string" ? req.query.lead_type.trim().toUpperCase() : "";
  const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
  const seller = typeof req.query.seller === "string" ? req.query.seller.trim() : "";
  const staff = typeof req.query.staff === "string" ? req.query.staff.trim() : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

  const conditions: string[] = ["deleted_at IS NULL"];
  const bindings: any[] = [];

  if (status && status !== "ALL") {
    conditions.push("status = ?");
    bindings.push(status);
  }

  if (leadType && leadType !== "ALL") {
    if (leadType === "INSTALL" || leadType === "INSTALLATION") {
      conditions.push("(COALESCE(lead_type,'PRODUCT_QUOTE') = 'INSTALLATION' OR lower(concat_ws(' ',source,division)) LIKE '%install%')");
    } else if (leadType === "PRODUCT" || leadType === "PRODUCT_QUOTE" || leadType === "QUOTE") {
      conditions.push("(COALESCE(lead_type,'PRODUCT_QUOTE') = 'PRODUCT_QUOTE' AND lower(concat_ws(' ',source,division)) NOT LIKE '%install%')");
    }
  }

  if (role && role !== "ALL") {
    conditions.push("role = ?");
    bindings.push(role);
  }

  if (seller && seller !== "ALL") {
    if (seller === "SAI_AJANTHA") {
      conditions.push("(assigned_seller_id = 'SAI_AJANTHA_CENTRAL' OR assigned_seller_name ILIKE '%Sai Ajantha%')");
    } else if (seller === "DISTRIBUTOR") {
      conditions.push("assigned_seller_id NOT IN ('SAI_AJANTHA_CENTRAL','') AND assigned_seller_id IS NOT NULL");
    } else if (seller === "AWAITING_SELLER") {
      conditions.push("(status = 'AWAITING_SELLER' OR assigned_seller_id IS NULL OR assigned_seller_id = '')");
    }
  }

  if (staff && staff !== "ALL") {
    conditions.push("assigned_staff_email = ?");
    bindings.push(staff);
  }

  if (q) {
    conditions.push("strpos(lower(concat_ws(' ',name,phone,email,city,division,notes,assigned_seller_name,assigned_staff_email,postal_code)), ?) > 0");
    bindings.push(q);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const selectQuery = `
    SELECT *
    FROM dms_trade_enquiry
    ${whereClause}
    ORDER BY created_at DESC
  `;

  const { rows: enquiries } = await pg.raw(selectQuery, bindings);

  const formattedCounts = {
    total: Number(countsRow?.total || 0),
    new: Number(countsRow?.count_new || 0),
    in_review: Number(countsRow?.count_in_review || 0),
    awaiting_details: Number(countsRow?.count_awaiting_details || 0),
    awaiting_seller: Number(countsRow?.count_awaiting_seller || 0),
    quote_preparing: Number(countsRow?.count_quote_preparing || 0),
    quoted: Number(countsRow?.count_quoted || 0),
    quote_accepted: Number(countsRow?.count_quote_accepted || 0),
    converted_order: Number(countsRow?.count_converted_order || 0),
    closed: Number(countsRow?.count_closed || 0),
    install: Number(countsRow?.count_install || 0),
    product_quote: Number(countsRow?.count_product_quote || 0),
  };

  return res.json({
    enquiries,
    count: enquiries.length,
    counts: formattedCounts,
  });
}
