import crypto from "node:crypto";
import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows";
import { Pool, PoolClient } from "pg";
import { withTransaction, getPgPool } from "./db";
import {
  isDistributorOnlineCheckoutAllowed,
  isFloorSpringsCheckoutAllowed,
} from "./feature-flags";

export interface GraphProductInventory {
  id: string;
  title: string;
  handle: string;
  metadata?: Record<string, unknown> | null;
  variants?: {
    id: string;
    title?: string;
    sku?: string | null;
    inventory_items?: {
      inventory_item_id?: string;
      inventory?: {
        id?: string;
        location_levels?: {
          id: string;
          location_id: string;
          stocked_quantity: number;
          reserved_quantity: number;
        }[] | null;
      } | null;
    }[] | null;
  }[] | null;
}

export interface StockChangeItem {
  productId: string;
  name?: string;
  units: number;
}

export interface CartLineReservationInput {
  productId: string;
  variantId?: string | null;
  sku?: string | null;
  name?: string;
  category?: string;
  finish?: string | null;
  packMultiplier?: number;
  quantity: number;
  sellerId?: string | null;
  locationId?: string | null;
}

export interface AggregatedStockRequirement {
  aggregationKey: string;
  productId: string;
  variantId: string;
  inventoryItemId: string;
  locationId: string;
  sellerId: string;
  sku: string;
  name: string;
  totalUnits: number;
  lineItemsCount: number;
}

export interface StockReservationRecord {
  id: string;
  inventory_item_id: string;
  location_id: string;
  quantity: number;
  line_item_id?: string | null;
  description?: string | null;
  status?: "RESERVED" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expires_at?: string;
  metadata?: Record<string, unknown> | null;
}

export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";
  readonly status = 409;
  readonly details: {
    sku: string;
    productId: string;
    variantId: string;
    requestedQuantity: number;
    availableQuantity: number;
    locationId: string;
    name?: string;
  };

  constructor(details: {
    sku: string;
    productId: string;
    variantId: string;
    requestedQuantity: number;
    availableQuantity: number;
    locationId: string;
    name?: string;
  }) {
    super(
      `Insufficient warehouse stock for "${details.name || details.sku || details.productId}". Requested: ${details.requestedQuantity}, Available: ${details.availableQuantity} at location ${details.locationId}.`
    );
    this.name = "InsufficientStockError";
    this.details = details;
  }
}

export class CommercialPolicyViolationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "CommercialPolicyViolationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Aggregates raw cart lines by (productId, variantId/sku, locationId, sellerId)
 * to prevent multi-line oversell within a single cart (BE-05).
 */
export function aggregateCartLines(
  items: CartLineReservationInput[]
): Map<string, { item: CartLineReservationInput; totalUnits: number; lineCount: number }> {
  const aggregated = new Map<
    string,
    { item: CartLineReservationInput; totalUnits: number; lineCount: number }
  >();

  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const mult = Math.max(1, Math.floor(Number(item.packMultiplier) || 1));
    const requestedUnits = qty * mult;

    const variantKey = (item.variantId || item.sku || "").trim().toLowerCase();
    const locKey = (item.locationId || "primary").trim();
    const sellerKey = (item.sellerId || "sai-ajantha-central").trim().toLowerCase();
    const key = `${item.productId}::${variantKey}::${locKey}::${sellerKey}`;

    const existing = aggregated.get(key);
    if (existing) {
      existing.totalUnits += requestedUnits;
      existing.lineCount += 1;
    } else {
      aggregated.set(key, {
        item: { ...item },
        totalUnits: requestedUnits,
        lineCount: 1,
      });
    }
  }

  return aggregated;
}

/**
 * Resolves product inventory items and locations from Medusa catalog graph,
 * enforcing variant specificity, commercial safety flags, and seller location scoping.
 */
export async function resolveAndAggregateOrderItems(
  container: MedusaContainer,
  items: CartLineReservationInput[],
  context?: {
    userRole?: string;
    paymentMethod?: string;
  }
): Promise<{
  aggregatedRequirements: AggregatedStockRequirement[];
}> {
  const aggregatedMap = aggregateCartLines(items);
  if (aggregatedMap.size === 0) {
    return { aggregatedRequirements: [] };
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as { data: GraphProductInventory[] };

  const byKey = new Map<string, GraphProductInventory>();
  for (const p of products) {
    byKey.set(p.id, p);
    if (p.handle) byKey.set(p.handle, p);
    const meta = p.metadata || {};
    if (typeof meta.legacy_id === "string" && meta.legacy_id) {
      byKey.set(meta.legacy_id, p);
    }
    if (typeof meta.legacy_product_id === "string" && meta.legacy_product_id) {
      byKey.set(meta.legacy_product_id, p);
    }
  }

  // Resolve primary warehouse location ID
  let primaryLocationId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z";
  try {
    const { data: locs } = (await query.graph({
      entity: "stock_location",
      fields: ["id"],
    })) as { data: { id: string }[] };
    if (locs?.[0]?.id) {
      primaryLocationId = locs[0].id;
    }
  } catch {
    // fallback to default primary warehouse location ID
  }

  const isRazorpay = context?.paymentMethod === "Razorpay Online Checkout";
  const userRole = context?.userRole || "CUSTOMER";

  const physicalMap = new Map<string, AggregatedStockRequirement>();

  for (const [aggKey, aggData] of aggregatedMap.entries()) {
    const { item, totalUnits, lineCount } = aggData;
    const product = byKey.get(item.productId);
    if (!product) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product "${item.productId}" not found in catalog.`
      );
    }

    // Commercial Safety Guard: Floor Springs direct checkout restriction
    const isFloorSpring =
      (item.category && item.category.toLowerCase().includes("floor spring")) ||
      (item.name && item.name.toLowerCase().includes("floor spring")) ||
      product.title.toLowerCase().includes("floor spring");

    if (isFloorSpring && !isFloorSpringsCheckoutAllowed()) {
      throw new CommercialPolicyViolationError(
        "FLOOR_SPRINGS_RESTRICTED",
        "Floor springs products are restricted to BOQ quotation requests and cannot be purchased via direct checkout."
      );
    }

    // Commercial Safety Guard: Distributor online checkout restriction
    if (userRole === "DISTRIBUTOR" && isRazorpay && !isDistributorOnlineCheckoutAllowed()) {
      throw new CommercialPolicyViolationError(
        "DISTRIBUTOR_ONLINE_CHECKOUT_DISABLED",
        "Distributor online checkout is currently disabled by commercial policy. Please submit a BOQ quotation request or settle via offline proforma invoice."
      );
    }

    // Variant Specificity: Never blindly default to variants[0]
    const variants = product.variants || [];
    let selectedVariant: NonNullable<GraphProductInventory["variants"]>[0] | null = null;

    if (item.variantId) {
      selectedVariant = variants.find((v) => v.id === item.variantId) || null;
      if (!selectedVariant) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant "${item.variantId}" not found on product "${product.title}".`
        );
      }
    } else if (item.sku) {
      selectedVariant =
        variants.find(
          (v) => (v.sku || "").toLowerCase() === (item.sku || "").toLowerCase()
        ) || null;
    }

    if (!selectedVariant) {
      if (variants.length === 1) {
        selectedVariant = variants[0];
      } else if (variants.length > 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Multiple variants exist for product "${product.title}"; exact variantId or sku is required for inventory reservation.`
        );
      } else {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Product "${product.title}" has no inventory variants configured.`
        );
      }
    }

    const invEntry = selectedVariant.inventory_items?.[0];
    const inventoryItemId = invEntry?.inventory_item_id || invEntry?.inventory?.id;
    if (!inventoryItemId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Inventory item linkage missing for variant "${selectedVariant.id}" of product "${product.title}".`
      );
    }

    // Location and Seller Scoping
    const resolvedLocationId = item.locationId || primaryLocationId;
    const resolvedSellerId = item.sellerId || "sai-ajantha-central";

    if (resolvedSellerId !== "sai-ajantha-central" && resolvedLocationId === primaryLocationId) {
      throw new CommercialPolicyViolationError(
        "INVALID_STOCK_LOCATION",
        `Unauthorized seller "${resolvedSellerId}" cannot allocate stock from Sai Ajantha central warehouse.`
      );
    }

    const sku = selectedVariant.sku || item.sku || product.handle || product.id;

    // Physical Inventory Item Aggregation (P3.4.1 - Audit Item A.1):
    // Group demand by physical (inventory_item_id, location_id, seller_id)
    // to combine multiple variants/SKUs sharing the exact same physical inventory pool.
    const physicalKey = `${inventoryItemId}::${resolvedLocationId}::${resolvedSellerId}`;
    const existingPhysical = physicalMap.get(physicalKey);

    if (existingPhysical) {
      existingPhysical.totalUnits += totalUnits;
      existingPhysical.lineItemsCount += lineCount;
      if (!existingPhysical.sku.includes(sku)) {
        existingPhysical.sku = `${existingPhysical.sku}, ${sku}`;
      }
    } else {
      physicalMap.set(physicalKey, {
        aggregationKey: physicalKey,
        productId: product.id,
        variantId: selectedVariant.id,
        inventoryItemId,
        locationId: resolvedLocationId,
        sellerId: resolvedSellerId,
        sku,
        name: item.name || product.title,
        totalUnits,
        lineItemsCount: lineCount,
      });
    }
  }

  return { aggregatedRequirements: Array.from(physicalMap.values()) };
}

/**
 * Atomically reserves stock in PostgreSQL with row-level locks (SELECT ... FOR UPDATE)
 * on inventory_level to guarantee ACID serialization and zero oversell under concurrency (BE-05, RB-04).
 */
export async function reserveStockAtomic(
  poolOrClient: Pool | PoolClient,
  requirements: AggregatedStockRequirement[],
  options?: {
    orderId?: string;
    timeoutMinutes?: number;
  }
): Promise<StockReservationRecord[]> {
  if (requirements.length === 0) return [];

  // Sort deterministically to prevent database deadlocks on concurrent reservations
  const sorted = [...requirements].sort((a, b) =>
    a.inventoryItemId.localeCompare(b.inventoryItemId) ||
    a.locationId.localeCompare(b.locationId)
  );

  return await withTransaction(poolOrClient, async (client) => {
    const reservations: StockReservationRecord[] = [];
    const timeoutMinutes = options?.timeoutMinutes || 15;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

    for (const req of sorted) {
      const selectRes = await client.query(
        `SELECT id, stocked_quantity, reserved_quantity
         FROM inventory_level
         WHERE inventory_item_id = $1 AND location_id = $2 AND deleted_at IS NULL
         FOR UPDATE;`,
        [req.inventoryItemId, req.locationId]
      );

      if (selectRes.rows.length === 0) {
        throw new InsufficientStockError({
          sku: req.sku,
          productId: req.productId,
          variantId: req.variantId,
          requestedQuantity: req.totalUnits,
          availableQuantity: 0,
          locationId: req.locationId,
          name: req.name,
        });
      }

      const row = selectRes.rows[0];
      const stocked = Number(row.stocked_quantity) || 0;
      const reserved = Number(row.reserved_quantity) || 0;
      const available = Math.max(0, stocked - reserved);

      if (available < req.totalUnits) {
        throw new InsufficientStockError({
          sku: req.sku,
          productId: req.productId,
          variantId: req.variantId,
          requestedQuantity: req.totalUnits,
          availableQuantity: available,
          locationId: req.locationId,
          name: req.name,
        });
      }

      // Update reserved_quantity atomically
      await client.query(
        `UPDATE inventory_level
         SET reserved_quantity = reserved_quantity + $1, updated_at = NOW()
         WHERE id = $2;`,
        [req.totalUnits, row.id]
      );

      // Create reservation item record
      const reservationId = `res_${crypto.randomUUID()}`;
      const metadata = {
        order_id: options?.orderId || null,
        expires_at: expiresAt,
        seller_id: req.sellerId,
        sku: req.sku,
        timeout_minutes: timeoutMinutes,
      };

      // 1. Insert into durable DMS stock reservation table (P3.5 explicit lifecycle)
      if (options?.orderId) {
        try {
          await client.query(
            `INSERT INTO dms_stock_reservation (
               id, order_id, inventory_item_id, location_id, seller_id, sku, quantity,
               status, expires_at, metadata, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'RESERVED', $8, $9, NOW(), NOW());`,
            [
              reservationId,
              options.orderId,
              req.inventoryItemId,
              req.locationId,
              req.sellerId,
              req.sku,
              req.totalUnits,
              expiresAt,
              JSON.stringify(metadata),
            ]
          );

          // 2. Append to immutable inventory movement ledger (P3.6 / BE-06)
          const opKey = `op_reserve_${options.orderId}_${reservationId}`;
          await client.query(
            `INSERT INTO dms_inventory_movement (
               id, operation_key, inventory_item_id, location_id, seller_id, order_id, reservation_id,
               movement_type, delta_physical, delta_reserved, actor_type, reason, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             ON CONFLICT (operation_key) DO NOTHING;`,
            [
              `mov_${crypto.randomUUID()}`,
              opKey,
              req.inventoryItemId,
              req.locationId,
              req.sellerId,
              options.orderId,
              reservationId,
              "RESERVE_HOLD",
              0,
              req.totalUnits,
              "system",
              `15-min stock hold created for order ${options.orderId}`,
            ]
          );
        } catch (dmsErr: any) {
          if (!dmsErr.message?.includes("relation") && !dmsErr.message?.includes("does not exist")) {
            throw dmsErr;
          }
        }
      }

      await client.query(
        `INSERT INTO reservation_item (
           id, inventory_item_id, location_id, quantity, line_item_id, description, metadata, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW());`,
        [
          reservationId,
          req.inventoryItemId,
          req.locationId,
          req.totalUnits,
          options?.orderId || null,
          `Order reservation for ${req.sku} (${req.totalUnits} units)`,
          JSON.stringify(metadata),
        ]
      );

      reservations.push({
        id: reservationId,
        inventory_item_id: req.inventoryItemId,
        location_id: req.locationId,
        quantity: req.totalUnits,
        line_item_id: options?.orderId || null,
        description: `Order reservation for ${req.sku} (${req.totalUnits} units)`,
        status: "RESERVED",
        expires_at: expiresAt,
        metadata,
      });
    }

    return reservations;
  });
}

/**
 * Confirms stock reservations on successful payment capture:
 * decrements stocked_quantity and reserved_quantity, then marks reservation deleted.
 */
export async function confirmStockReservations(
  poolOrClient: Pool | PoolClient,
  reservationIds: string[]
): Promise<void> {
  if (!reservationIds || reservationIds.length === 0) return;

  const sortedIds = [...reservationIds].sort();

  await withTransaction(poolOrClient, async (client) => {
    for (const resId of sortedIds) {
      const resResult = await client.query(
        `SELECT id, inventory_item_id, location_id, quantity
         FROM reservation_item
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE;`,
        [resId]
      );

      if (resResult.rows.length === 0) continue;

      const item = resResult.rows[0];
      const qty = Number(item.quantity) || 0;

      await client.query(
        `UPDATE inventory_level
         SET stocked_quantity = GREATEST(0, stocked_quantity - $1),
             reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = NOW()
         WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
        [qty, item.inventory_item_id, item.location_id]
      );

      await client.query(
        `UPDATE reservation_item
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1;`,
        [resId]
      );
    }
  });
}

/**
 * Releases stock reservations on cancellation, expiration, or checkout failure:
 * decrements reserved_quantity, restoring available stock immediately.
 */
export async function releaseStockReservations(
  poolOrClient: Pool | PoolClient,
  reservationIds: string[]
): Promise<void> {
  if (!reservationIds || reservationIds.length === 0) return;

  const sortedIds = [...reservationIds].sort();

  await withTransaction(poolOrClient, async (client) => {
    for (const resId of sortedIds) {
      const resResult = await client.query(
        `SELECT id, inventory_item_id, location_id, quantity
         FROM reservation_item
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE;`,
        [resId]
      );

      if (resResult.rows.length === 0) continue;

      const item = resResult.rows[0];
      const qty = Number(item.quantity) || 0;

      await client.query(
        `UPDATE inventory_level
         SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = NOW()
         WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
        [qty, item.inventory_item_id, item.location_id]
      );

      await client.query(
        `UPDATE reservation_item
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1;`,
        [resId]
      );
    }
  });
}

export interface OrderStockConfirmationResult {
  success: boolean;
  count: number;
  alreadyConfirmed: boolean;
  isLegacy: boolean;
  terminalState?: "CONFIRMED" | "RELEASED" | "EXPIRED" | string;
  error?: string;
}

/**
 * Idempotently and atomically confirms all active reservations associated with an order.
 * Prevents double stock decrement races between simultaneous webhook and payment capture callbacks (P3.4.1 - B.5).
 * Enforces explicit, durable reservation states (RESERVED, CONFIRMED, RELEASED, EXPIRED) per P3.5 Preflight.
 */
export async function confirmStockReservationsForOrder(
  poolOrClient: Pool | PoolClient,
  orderId: string
): Promise<OrderStockConfirmationResult> {
  return await withTransaction(poolOrClient, async (client) => {
    // 1. Check durable DMS stock reservation table first
    try {
      const dmsRes = await client.query(
        `SELECT id, inventory_item_id, location_id, seller_id, sku, quantity, status
         FROM dms_stock_reservation
         WHERE order_id = $1
         ORDER BY id ASC
         FOR UPDATE;`,
        [orderId]
      );

      if (dmsRes.rows.length > 0) {
        const rows = dmsRes.rows;
        const allConfirmed = rows.every((r: any) => r.status === "CONFIRMED");
        if (allConfirmed) {
          return {
            success: true,
            count: 0,
            alreadyConfirmed: true,
            isLegacy: false,
            terminalState: "CONFIRMED",
          };
        }

        // CRITICAL SAFETY AUDIT (Addendum Section 2):
        // If reservations are EXPIRED or RELEASED, NEVER return alreadyConfirmed: true!
        const expiredOrReleased = rows.find(
          (r: any) => r.status === "EXPIRED" || r.status === "RELEASED"
        );
        if (expiredOrReleased) {
          return {
            success: false,
            count: 0,
            alreadyConfirmed: false,
            isLegacy: false,
            terminalState: expiredOrReleased.status,
            error: `RESERVATION_${expiredOrReleased.status}`,
          };
        }

        // Process active RESERVED rows
        const reservedRows = rows.filter((r: any) => r.status === "RESERVED");
        for (const item of reservedRows) {
          const qty = Number(item.quantity) || 0;
          await client.query(
            `UPDATE inventory_level
             SET stocked_quantity = GREATEST(0, stocked_quantity - $1),
                 reserved_quantity = GREATEST(0, reserved_quantity - $1),
                 updated_at = NOW()
             WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
            [qty, item.inventory_item_id, item.location_id]
          );

          await client.query(
            `UPDATE dms_stock_reservation
             SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
             WHERE id = $1;`,
            [item.id]
          );

          await client.query(
            `UPDATE reservation_item
             SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 OR line_item_id = $2;`,
            [item.id, orderId]
          );

          // Append to immutable inventory movement ledger (P3.6 / BE-06)
          const opKey = `op_confirm_${orderId}_${item.id}`;
          await client.query(
            `INSERT INTO dms_inventory_movement (
               id, operation_key, inventory_item_id, location_id, seller_id, order_id, reservation_id,
               movement_type, delta_physical, delta_reserved, actor_type, reason, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             ON CONFLICT (operation_key) DO NOTHING;`,
            [
              `mov_${crypto.randomUUID()}`,
              opKey,
              item.inventory_item_id,
              item.location_id,
              item.seller_id,
              orderId,
              item.id,
              "CONFIRM_SALE",
              -qty,
              -qty,
              "system",
              `Stock confirmed on payment capture for order ${orderId}`,
            ]
          );
        }

        return {
          success: true,
          count: reservedRows.length,
          alreadyConfirmed: false,
          isLegacy: false,
          terminalState: "CONFIRMED",
        };
      }
    } catch (err: any) {
      if (!err.message?.includes("relation") && !err.message?.includes("does not exist")) {
        throw err;
      }
    }

    // Fallback: Legacy Medusa reservation_item records
    const resResult = await client.query(
      `SELECT id, inventory_item_id, location_id, quantity, deleted_at
       FROM reservation_item
       WHERE line_item_id = $1
       ORDER BY id ASC
       FOR UPDATE;`,
      [orderId]
    );

    if (resResult.rows.length === 0) {
      return { success: true, count: 0, alreadyConfirmed: false, isLegacy: true };
    }

    const activeRows = resResult.rows.filter((r: any) => r.deleted_at === null);
    if (activeRows.length === 0) {
      // Check if order is actually marked PAID in dms_trade_order before assuming confirmed
      try {
        const orderCheck = await client.query(
          `SELECT status, payment_status FROM dms_trade_order WHERE id = $1;`,
          [orderId]
        );
        const isPaid =
          orderCheck.rows[0]?.payment_status === "CAPTURED" ||
          orderCheck.rows[0]?.status === "PAID";
        if (!isPaid) {
          return {
            success: false,
            count: 0,
            alreadyConfirmed: false,
            isLegacy: true,
            terminalState: "RELEASED",
            error: "LEGACY_RESERVATION_DELETED_WITHOUT_PAYMENT",
          };
        }
      } catch {
        // If dms_trade_order doesn't exist, proceed safely
      }

      return {
        success: true,
        count: 0,
        alreadyConfirmed: true,
        isLegacy: true,
        terminalState: "CONFIRMED",
      };
    }

    for (const item of activeRows) {
      const qty = Number(item.quantity) || 0;
      await client.query(
        `UPDATE inventory_level
         SET stocked_quantity = GREATEST(0, stocked_quantity - $1),
             reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = NOW()
         WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
        [qty, item.inventory_item_id, item.location_id]
      );

      await client.query(
        `UPDATE reservation_item
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1;`,
        [item.id]
      );
    }

    return {
      success: true,
      count: activeRows.length,
      alreadyConfirmed: false,
      isLegacy: true,
      terminalState: "CONFIRMED",
    };
  });
}

export interface OrderStockReleaseResult {
  success: boolean;
  count: number;
  alreadyReleased: boolean;
  isLegacy: boolean;
  terminalState?: "CONFIRMED" | "RELEASED" | "EXPIRED" | string;
  error?: string;
}

/**
 * Idempotently and atomically releases all active reservations associated with an order upon cancellation or expiry.
 */
export async function releaseStockReservationsForOrder(
  poolOrClient: Pool | PoolClient,
  orderId: string,
  reason?: string
): Promise<OrderStockReleaseResult> {
  return await withTransaction(poolOrClient, async (client) => {
    // 1. Check durable DMS stock reservation table first
    try {
      const dmsRes = await client.query(
        `SELECT id, inventory_item_id, location_id, seller_id, sku, quantity, status
         FROM dms_stock_reservation
         WHERE order_id = $1
         ORDER BY id ASC
         FOR UPDATE;`,
        [orderId]
      );

      if (dmsRes.rows.length > 0) {
        const rows = dmsRes.rows;
        const allReleasedOrExpired = rows.every(
          (r: any) => r.status === "RELEASED" || r.status === "EXPIRED"
        );
        if (allReleasedOrExpired) {
          return {
            success: true,
            count: 0,
            alreadyReleased: true,
            isLegacy: false,
            terminalState: rows[0].status,
          };
        }

        const confirmedRow = rows.find((r: any) => r.status === "CONFIRMED");
        if (confirmedRow) {
          return {
            success: false,
            count: 0,
            alreadyReleased: false,
            isLegacy: false,
            terminalState: "CONFIRMED",
            error: "CANNOT_RELEASE_CONFIRMED_RESERVATION",
          };
        }

        const reservedRows = rows.filter((r: any) => r.status === "RESERVED");
        for (const item of reservedRows) {
          const qty = Number(item.quantity) || 0;
          await client.query(
            `UPDATE inventory_level
             SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
                 updated_at = NOW()
             WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
            [qty, item.inventory_item_id, item.location_id]
          );

          await client.query(
            `UPDATE dms_stock_reservation
             SET status = 'RELEASED', released_at = NOW(), reason = $2, updated_at = NOW()
             WHERE id = $1;`,
            [item.id, reason || "ORDER_CANCELLED"]
          );

          await client.query(
            `UPDATE reservation_item
             SET deleted_at = NOW(), updated_at = NOW()
             WHERE id = $1 OR line_item_id = $2;`,
            [item.id, orderId]
          );

          // Append to immutable inventory movement ledger (P3.6 / BE-06)
          const opKey = `op_release_${orderId}_${item.id}`;
          await client.query(
            `INSERT INTO dms_inventory_movement (
               id, operation_key, inventory_item_id, location_id, seller_id, order_id, reservation_id,
               movement_type, delta_physical, delta_reserved, actor_type, reason, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             ON CONFLICT (operation_key) DO NOTHING;`,
            [
              `mov_${crypto.randomUUID()}`,
              opKey,
              item.inventory_item_id,
              item.location_id,
              item.seller_id,
              orderId,
              item.id,
              "RELEASE_HOLD",
              0,
              -qty,
              "system",
              `Stock released on order cancellation/release for order ${orderId}: ${reason || "ORDER_CANCELLED"}`,
            ]
          );
        }

        return {
          success: true,
          count: reservedRows.length,
          alreadyReleased: false,
          isLegacy: false,
          terminalState: "RELEASED",
        };
      }
    } catch (err: any) {
      if (!err.message?.includes("relation") && !err.message?.includes("does not exist")) {
        throw err;
      }
    }

    // Fallback: Legacy Medusa reservation_item records
    const resResult = await client.query(
      `SELECT id, inventory_item_id, location_id, quantity, deleted_at
       FROM reservation_item
       WHERE line_item_id = $1
       ORDER BY id ASC
       FOR UPDATE;`,
      [orderId]
    );

    if (resResult.rows.length === 0) {
      return { success: true, count: 0, alreadyReleased: false, isLegacy: true };
    }

    const activeRows = resResult.rows.filter((r: any) => r.deleted_at === null);
    if (activeRows.length === 0) {
      return {
        success: true,
        count: 0,
        alreadyReleased: true,
        isLegacy: false,
        terminalState: "RELEASED",
      };
    }

    for (const item of activeRows) {
      const qty = Number(item.quantity) || 0;
      await client.query(
        `UPDATE inventory_level
         SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = NOW()
         WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
        [qty, item.inventory_item_id, item.location_id]
      );

      await client.query(
        `UPDATE reservation_item
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1;`,
        [item.id]
      );
    }

    return { success: true, count: activeRows.length, alreadyReleased: false, isLegacy: false };
  });
}

/**
 * Adjusts (`mode: "adjust"`) or sets (`mode: "set"`) stocked quantity on Medusa
 * Inventory Location Levels for catalog management and seed scripts.
 */
export async function applyCatalogStockChanges(
  container: MedusaContainer,
  items: StockChangeItem[],
  options: {
    mode: "adjust" | "set";
    rejectIfInsufficient?: boolean;
  }
): Promise<void> {
  if (items.length === 0) return;

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "variants.id",
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as { data: GraphProductInventory[] };

  const byKey = new Map<string, GraphProductInventory>();
  for (const p of products) {
    byKey.set(p.id, p);
    if (p.handle) byKey.set(p.handle, p);
    const meta = p.metadata || {};
    if (typeof meta.legacy_id === "string" && meta.legacy_id) {
      byKey.set(meta.legacy_id, p);
    }
    if (typeof meta.legacy_product_id === "string" && meta.legacy_product_id) {
      byKey.set(meta.legacy_product_id, p);
    }
  }

  let fallbackLocationId: string | null = null;
  const ensurePrimaryLocationId = async (): Promise<string | null> => {
    if (fallbackLocationId) return fallbackLocationId;
    const { data: locs } = (await query.graph({
      entity: "stock_location",
      fields: ["id"],
    })) as { data: { id: string }[] };
    fallbackLocationId = locs[0]?.id ?? null;
    return fallbackLocationId;
  };

  const updates: {
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }[] = [];
  const creates: {
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }[] = [];

  for (const entry of items) {
    const product = byKey.get(entry.productId);
    if (!product) continue;

    const invEntry = product.variants?.[0]?.inventory_items?.[0];
    const inventoryItemId =
      invEntry?.inventory_item_id || invEntry?.inventory?.id;
    if (!inventoryItemId) continue;

    const levels = invEntry?.inventory?.location_levels || [];
    const primaryLevel = levels[0];

    if (primaryLevel) {
      const currentAvailable = Math.max(
        0,
        (primaryLevel.stocked_quantity || 0) -
          (primaryLevel.reserved_quantity || 0)
      );
      if (
        options.mode === "adjust" &&
        options.rejectIfInsufficient &&
        entry.units < 0 &&
        currentAvailable < Math.abs(entry.units)
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Insufficient stock for ${entry.name || product.title}. Available: ${currentAvailable}.`
        );
      }
      const nextStocked =
        options.mode === "set"
          ? Math.max(0, Math.floor(entry.units))
          : Math.max(
              primaryLevel.reserved_quantity || 0,
              (primaryLevel.stocked_quantity || 0) + entry.units
            );

      updates.push({
        inventory_item_id: inventoryItemId,
        location_id: primaryLevel.location_id,
        stocked_quantity: nextStocked,
      });
    } else {
      const locId = await ensurePrimaryLocationId();
      if (!locId) continue;
      if (
        options.mode === "adjust" &&
        options.rejectIfInsufficient &&
        entry.units < 0
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Insufficient stock for ${entry.name || product.title}. Available: 0.`
        );
      }
      creates.push({
        inventory_item_id: inventoryItemId,
        location_id: locId,
        stocked_quantity: Math.max(0, Math.floor(entry.units)),
      });
    }
  }

  if (creates.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: creates },
    });
  }
  if (updates.length > 0) {
    await updateInventoryLevelsWorkflow(container).run({
      input: { updates },
    });
  }
}
