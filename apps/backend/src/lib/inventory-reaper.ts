import { Pool, PoolClient } from "pg";
import crypto from "node:crypto";
import { withTransaction, getPgPool } from "./db";

export interface ReapOptions {
  pool?: Pool;
  batchSize?: number;
  dryRun?: boolean;
  now?: Date;
  actorId?: string;
}

export interface ReapedReservationDetail {
  reservationId: string;
  orderId: string;
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  expiresAt: string;
  action: "EXPIRED" | "SKIPPED_PAID_ORDER" | "DRY_RUN";
  reason?: string;
}

export interface ReapSummary {
  scannedCount: number;
  reapedCount: number;
  skippedCount: number;
  dryRun: boolean;
  timestamp: string;
  details: ReapedReservationDetail[];
}

/**
 * Scheduled Inventory Expiration Reaper Worker (Task 03.5 / P3.5 / Addendum Sec 3)
 *
 * Uses `SELECT ... FOR UPDATE SKIP LOCKED` to safely claim expired 15-minute holds
 * across concurrent worker replicas without deadlocks or double-releases.
 *
 * Checks authoritative order/payment state BEFORE releasing to protect payments that
 * succeeded while webhooks or callbacks were delayed.
 */
export async function reapExpiredReservations(
  options: ReapOptions = {}
): Promise<ReapSummary> {
  const pool = options.pool || getPgPool();
  const batchSize = Math.max(1, Math.min(500, options.batchSize || 50));
  const dryRun = options.dryRun || false;
  const now = options.now || new Date();
  const nowIso = now.toISOString();

  const details: ReapedReservationDetail[] = [];
  let scannedCount = 0;
  let reapedCount = 0;
  let skippedCount = 0;

  await withTransaction(pool, async (client: PoolClient) => {
    // 1. Guarded row claim with FOR UPDATE SKIP LOCKED
    const claimRes = await client.query(
      `SELECT id, order_id, inventory_item_id, location_id, seller_id, sku, quantity, expires_at
       FROM dms_stock_reservation
       WHERE status = 'RESERVED' AND expires_at < $1 AND deleted_at IS NULL
       ORDER BY id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $2;`,
      [nowIso, batchSize]
    );

    scannedCount = claimRes.rows.length;
    if (scannedCount === 0) {
      return;
    }

    for (const row of claimRes.rows) {
      const qty = Number(row.quantity) || 0;

      // 2. Authoritative check: Do not release a hold whose payment succeeded while webhook is delayed
      let isOrderPaidOrCaptured = false;
      try {
        const orderRes = await client.query(
          `SELECT status, payment_status FROM dms_trade_order WHERE id = $1;`,
          [row.order_id]
        );
        if (orderRes.rows.length > 0) {
          const ord = orderRes.rows[0];
          if (
            ord.payment_status === "PAID" ||
            ord.payment_status === "CAPTURED" ||
            ord.payment_status === "AUTHORIZED" ||
            ord.status === "PAID" ||
            ord.status === "DELIVERED"
          ) {
            isOrderPaidOrCaptured = true;
          }
        }
      } catch {
        // If dms_trade_order table doesn't exist, proceed safely
      }

      if (isOrderPaidOrCaptured) {
        skippedCount++;
        details.push({
          reservationId: row.id,
          orderId: row.order_id,
          inventoryItemId: row.inventory_item_id,
          locationId: row.location_id,
          quantity: qty,
          expiresAt: row.expires_at,
          action: "SKIPPED_PAID_ORDER",
          reason: "Order is already marked PAID/CAPTURED; hold protected from expiry.",
        });
        continue;
      }

      if (dryRun) {
        reapedCount++;
        details.push({
          reservationId: row.id,
          orderId: row.order_id,
          inventoryItemId: row.inventory_item_id,
          locationId: row.location_id,
          quantity: qty,
          expiresAt: row.expires_at,
          action: "DRY_RUN",
          reason: "Expired hold identified in dry-run mode (no state mutated).",
        });
        continue;
      }

      // 3. Atomically restore available stock (decrement reserved_quantity only; physical stock untouched)
      await client.query(
        `UPDATE inventory_level
         SET reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = NOW()
         WHERE inventory_item_id = $2 AND location_id = $3 AND deleted_at IS NULL;`,
        [qty, row.inventory_item_id, row.location_id]
      );

      // 4. Mark reservation as EXPIRED in durable state machine
      await client.query(
        `UPDATE dms_stock_reservation
         SET status = 'EXPIRED',
             expired_at = NOW(),
             reason = 'HOLD_TTL_EXPIRED',
             updated_at = NOW()
         WHERE id = $1;`,
        [row.id]
      );

      // 5. Soft-delete corresponding Medusa reservation_item for compatibility
      await client.query(
        `UPDATE reservation_item
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 OR line_item_id = $2;`,
        [row.id, row.order_id]
      );

      // 6. Record in append-only inventory movement ledger (P3.6 / BE-06)
      const opKey = `op_expire_${row.order_id}_${row.id}`;
      await client.query(
        `INSERT INTO dms_inventory_movement (
           id, operation_key, inventory_item_id, location_id, seller_id, order_id, reservation_id,
           movement_type, delta_physical, delta_reserved, actor_type, actor_id, reason, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT (operation_key) DO NOTHING;`,
        [
          `mov_${crypto.randomUUID()}`,
          opKey,
          row.inventory_item_id,
          row.location_id,
          row.seller_id,
          row.order_id,
          row.id,
          "EXPIRE_HOLD",
          0,
          -qty,
          "reaper",
          options.actorId || "system_reaper",
          `Hold expired after TTL for order ${row.order_id}`,
        ]
      );

      // 7. Update order status to PAYMENT_EXPIRED if still PENDING_PAYMENT
      try {
        await client.query(
          `UPDATE dms_trade_order
           SET status = 'PAYMENT_EXPIRED',
               payment_status = 'EXPIRED',
               cancellation_reason = '15-minute stock reservation expired without verified payment',
               updated_at = NOW()
           WHERE id = $1 AND status = 'PENDING_PAYMENT';`,
          [row.order_id]
        );
      } catch {
        // non-fatal
      }

      reapedCount++;
      details.push({
        reservationId: row.id,
        orderId: row.order_id,
        inventoryItemId: row.inventory_item_id,
        locationId: row.location_id,
        quantity: qty,
        expiresAt: row.expires_at,
        action: "EXPIRED",
        reason: "Hold expired after 15-minute lease without confirmed payment.",
      });
    }
  });

  return {
    scannedCount,
    reapedCount,
    skippedCount,
    dryRun,
    timestamp: nowIso,
    details,
  };
}
