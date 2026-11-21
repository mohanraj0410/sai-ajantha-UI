import { Pool, PoolClient } from "pg";
import {
  reserveStockAtomic,
  confirmStockReservationsForOrder,
  releaseStockReservationsForOrder,
  AggregatedStockRequirement,
  StockReservationRecord,
  OrderStockConfirmationResult,
  OrderStockReleaseResult,
} from "../lib/inventory";
import { reapExpiredReservations, ReapSummary } from "../lib/inventory-reaper";
import { getPgPool } from "../lib/db";

export class InventoryReservationService {
  /**
   * Atomically acquires row locks (SELECT ... FOR UPDATE) and reserves stock.
   */
  static async reserveStock(
    clientOrPool: Pool | PoolClient,
    requirements: AggregatedStockRequirement[],
    options?: { orderId?: string; timeoutMinutes?: number }
  ): Promise<StockReservationRecord[]> {
    return reserveStockAtomic(clientOrPool, requirements, options);
  }

  /**
   * Confirms stock reservations for an order upon successful payment capture.
   * Atomically transitions status to CONFIRMED, decrements stocked and reserved inventory,
   * and writes an append-only entry to dms_inventory_movement.
   */
  static async confirmOrderReservations(
    clientOrPool: Pool | PoolClient,
    orderId: string
  ): Promise<OrderStockConfirmationResult> {
    return confirmStockReservationsForOrder(clientOrPool, orderId);
  }

  /**
   * Releases stock reservations for an order on cancellation, payment failure, or timeout.
   */
  static async releaseOrderReservations(
    clientOrPool: Pool | PoolClient,
    orderId: string,
    reason?: string
  ): Promise<OrderStockReleaseResult> {
    return releaseStockReservationsForOrder(clientOrPool, orderId, reason);
  }

  /**
   * Executes scheduled reaper worker using FOR UPDATE SKIP LOCKED batching.
   */
  static async reapExpired(pool?: Pool): Promise<ReapSummary> {
    const targetPool = pool || getPgPool();
    return reapExpiredReservations({ pool: targetPool });
  }
}
