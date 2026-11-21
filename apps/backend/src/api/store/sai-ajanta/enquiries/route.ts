import crypto from "node:crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as {
    name?: string;
    role?: string;
    organization?: string;
    phone?: string;
    email?: string;
    city?: string;
    postal_code?: string;
    pincode?: string;
    division?: string;
    notes?: string;
    source?: string;
    lead_type?: string;
    items?: any[];
    attachments?: any[];
  };

  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  const email = (body.email || "").trim();
  if (!name && !phone && !email) {
    return res
      .status(400)
      .json({ message: "Contact name, phone, or email is required." });
  }

  const postalCode = (body.postal_code || body.pincode || "").trim();
  const division = (body.division || "General Enquiry").trim();
  const source = (body.source || "website").trim();
  const isInstall =
    source.includes("install") ||
    division.toLowerCase().includes("install") ||
    (body.lead_type || "").toUpperCase() === "INSTALLATION";

  const leadType = isInstall ? "INSTALLATION" : "PRODUCT_QUOTE";
  const items = Array.isArray(body.items) ? body.items : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Automatic routing & initial seller resolution
  let assignedSellerId: string | null = null;
  let assignedSellerName: string | null = null;
  let assignedSellerType: string | null = null;
  let initialStatus = "NEW";

  if (isInstall) {
    // Installation leads go to admin review to be assigned to verified contractor
    assignedSellerId = null;
    assignedSellerName = null;
    assignedSellerType = "CONTRACTOR_FLOW";
    initialStatus = "NEW";
  } else {
    const itemText = items
      .map((it: any) => `${it.category || ""} ${it.name || ""} ${it.sku || ""}`)
      .join(" ")
      .toLowerCase();

    const hasFloorSpringExplicit =
      itemText.includes("floor spring") ||
      itemText.includes("fs-ton90") ||
      itemText.includes("-fs-") ||
      ((body.notes || "").toLowerCase().includes("floor spring") &&
        !itemText.includes("door closer") &&
        !itemText.includes("dc-"));

    const isFloorSpring = hasFloorSpringExplicit;

    const isDoorCloser =
      !hasFloorSpringExplicit &&
      (division.toLowerCase().includes("door closer") ||
        itemText.includes("door closer") ||
        itemText.includes("dc-100") ||
        itemText.includes("dc-60") ||
        itemText.includes("dc-80"));

    const isKitchenBasket =
      division.toLowerCase().includes("kitchen basket") ||
      itemText.includes("kitchen basket") ||
      itemText.includes("partition basket") ||
      itemText.includes("thali basket") ||
      itemText.includes("kb-oo18");

    if (isFloorSpring) {
      assignedSellerId = "SAI_AJANTHA_CENTRAL";
      assignedSellerName = "Sai Ajantha Central (Enquiry Only)";
      assignedSellerType = "DIRECT_ENQUIRY";
      initialStatus = "NEW";
    } else if (!isDoorCloser && !isKitchenBasket) {
      // 9 Direct Categories -> Sai Ajantha Central Warehouse
      assignedSellerId = "SAI_AJANTHA_CENTRAL";
      assignedSellerName = "Sai Ajantha Central Warehouse";
      assignedSellerType = "DIRECT";
      initialStatus = "NEW";
    } else {
      // Door Closer or Kitchen Basket -> Check active distributor coverage for PIN
      const catSlug = isDoorCloser ? "door-closer-floor-spring" : "kitchen-basket";
      const isDealer = (body.role || "").toUpperCase().includes("DEALER");

      if (postalCode && /^\d{6}$/.test(postalCode)) {
        let dealerLinkedDistId: string | null = null;
        if (isDealer) {
          // Check dealer profile for parent_distributor_id
          const { rows: dRows } = await pg.raw(
            `SELECT parent_distributor_id FROM account_profile
             WHERE (email = ? OR phone = ? OR business_name = ?) AND role = 'DEALER' AND deleted_at IS NULL LIMIT 1`,
            [email, phone, (body.organization || name).trim()]
          );
          if (dRows.length > 0 && dRows[0].parent_distributor_id) {
            dealerLinkedDistId = dRows[0].parent_distributor_id;
          }
        }

        if (isDealer && dealerLinkedDistId) {
          // Verify dealer's linked distributor serves this PIN
          const isCloserCat = catSlug.includes("closer");
          const isBasketCat = catSlug.includes("basket");
          const { rows: linkRows } = await pg.raw(
            `SELECT c.distributor_id, p.business_name
             FROM dms_distributor_coverage c
             JOIN account_profile p ON (p.customer_id = c.distributor_id OR p.id = c.distributor_id)
             WHERE (c.distributor_id = ? OR p.id = ? OR p.customer_id = ?)
               AND c.postal_code = ?
               AND (
                 c.category_slug = ?
                 OR c.category_slug = 'all'
                 OR (? = true AND (c.category_slug = 'door-closer-floor-spring' OR c.category_slug = 'door-closers'))
                 OR (? = true AND (c.category_slug = 'kitchen-basket' OR c.category_slug = 'kitchen-baskets'))
               )
               AND c.status = 'ACTIVE' AND p.status = 'ACTIVE' AND c.deleted_at IS NULL
             LIMIT 1`,
            [dealerLinkedDistId, dealerLinkedDistId, dealerLinkedDistId, postalCode, catSlug, isCloserCat, isBasketCat]
          );

          if (linkRows.length > 0) {
            assignedSellerId = linkRows[0].distributor_id;
            assignedSellerName = linkRows[0].business_name;
            assignedSellerType = "DISTRIBUTOR";
            initialStatus = "NEW";
          } else {
            // Dealer linked distributor does not serve this PIN -> AWAITING_SELLER fallback
            assignedSellerId = null;
            assignedSellerName = null;
            assignedSellerType = null;
            initialStatus = "AWAITING_SELLER";
          }
        } else {
          // Customer / Standard routing: Query active distributor coverage without LIMIT 1 to check overlaps
          const isCloserCat = catSlug.includes("closer");
          const isBasketCat = catSlug.includes("basket");
          const { rows: covRows } = await pg.raw(
            `SELECT c.id, c.distributor_id, p.business_name, p.status as profile_status
             FROM dms_distributor_coverage c
             JOIN account_profile p ON (p.customer_id = c.distributor_id OR p.id = c.distributor_id)
             WHERE c.postal_code = ?
               AND (
                 c.category_slug = ?
                 OR c.category_slug = 'all'
                 OR (? = true AND (c.category_slug = 'door-closer-floor-spring' OR c.category_slug = 'door-closers'))
                 OR (? = true AND (c.category_slug = 'kitchen-basket' OR c.category_slug = 'kitchen-baskets'))
               )
               AND c.status = 'ACTIVE' AND c.deleted_at IS NULL`,
            [postalCode, catSlug, isCloserCat, isBasketCat]
          );

          // Group by unique active distributor
          const uniqueDists = new Map<string, any>();
          for (const r of covRows) {
            if ((r.profile_status || "").toUpperCase() === "ACTIVE") {
              if (!uniqueDists.has(r.distributor_id)) {
                uniqueDists.set(r.distributor_id, r);
              }
            }
          }

          if (uniqueDists.size === 1) {
            const dist = Array.from(uniqueDists.values())[0];
            assignedSellerId = dist.distributor_id;
            assignedSellerName = dist.business_name;
            assignedSellerType = "DISTRIBUTOR";
            initialStatus = "NEW";
          } else {
            // Unserved (0) or Ambiguous Overlap (>1) -> Never guess first row, route to unassigned queue
            assignedSellerId = null;
            assignedSellerName = null;
            assignedSellerType = null;
            initialStatus = "AWAITING_SELLER";
          }
        }
      } else {
        // No PIN provided for distributor category
        assignedSellerId = null;
        assignedSellerName = null;
        assignedSellerType = null;
        initialStatus = "AWAITING_SELLER";
      }
    }
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const created = await dmsService.createTradeEnquiries({
    name: name || "Callback Request",
    role: (body.role || "Retail / Individual").trim(),
    organization: (body.organization || "").trim(),
    phone,
    email,
    city: (body.city || "").trim(),
    postal_code: postalCode,
    division,
    notes: (body.notes || "").trim(),
    source,
    lead_type: leadType,
    items: items as unknown as Record<string, unknown>,
    attachments: attachments as unknown as Record<string, unknown>,
    assigned_seller_id: assignedSellerId,
    assigned_seller_name: assignedSellerName,
    assigned_seller_type: assignedSellerType,
    status: initialStatus,
  });

  // Log initial activity in timeline
  const actId = `act_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  await pg.raw(
    `INSERT INTO dms_enquiry_activity (id, enquiry_id, action, to_status, notes, created_at)
     VALUES (?, ?, 'ENQUIRY_LOGGED', ?, ?, now())`,
    [
      actId,
      created.id,
      initialStatus,
      `Enquiry submitted via ${source}${assignedSellerName ? ` — Routed to ${assignedSellerName}` : (initialStatus === 'AWAITING_SELLER' ? ' — Awaiting distributor coverage' : '')}`
    ]
  );

  return res.status(201).json({
    id: created.id,
    enquiry: created,
    status: initialStatus,
    assignedSellerName,
    message:
      "Enquiry logged successfully. Our Trichy trade desk will connect shortly.",
  });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({ message: "Authentication required to view enquiries." });
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows: custRows } = await pg.raw(
    `SELECT email, phone FROM customer WHERE id = ? LIMIT 1`,
    [customerId]
  );

  const customerEmail = (custRows[0]?.email || "").toLowerCase().trim();
  const customerPhone = (custRows[0]?.phone || "").trim();

  // Check if caller is distributor or dealer
  const { rows: profRows } = await pg.raw(
    `SELECT role FROM account_profile WHERE customer_id = ? OR id = ? LIMIT 1`,
    [customerId, customerId]
  );
  const userRole = profRows[0]?.role || "CUSTOMER";

  let query: string;
  let params: any[];

  if (userRole === "DISTRIBUTOR") {
    // Distributor sees enquiries assigned to them or submitted by them
    query = `SELECT * FROM dms_trade_enquiry 
             WHERE (assigned_seller_id = ? OR (lower(email) = ? AND email != '') OR (phone = ? AND phone != '')) AND deleted_at IS NULL
             ORDER BY created_at DESC`;
    params = [customerId, customerEmail, customerPhone];
  } else {
    // Customer / Dealer sees only their own enquiries
    query = `SELECT * FROM dms_trade_enquiry 
             WHERE ((lower(email) = ? AND email != '') OR (phone = ? AND phone != '')) AND deleted_at IS NULL
             ORDER BY created_at DESC`;
    params = [customerEmail, customerPhone];
  }

  const { rows } = await pg.raw(query, params);
  return res.json({ enquiries: rows });
}

