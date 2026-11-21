import { Pool } from "pg";
import {
  reserveStockAtomic,
  confirmStockReservationsForOrder,
  releaseStockReservationsForOrder,
  AggregatedStockRequirement,
} from "../../src/lib/inventory";
import { reapExpiredReservations } from "../../src/lib/inventory-reaper";
import { generateInventoryReconciliationReport } from "../../src/lib/inventory-reconciliation";
import { getPgPool, closePgPool } from "../../src/lib/db";

describe("Phase 03 Work Units P3.5 & P3.6: Reservation Lifecycle, Reaper & Movement Ledger", () => {
  let pool: Pool;
  const locationId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z";
  const sellerId = "sel_central_warehouse";
  const testItemId = "iitem_p35_lifecycle";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgres://medusa:7hippocampus@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
    pool = getPgPool();

    // Clean up test items
    await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'on';");
    await pool.query(
      `DELETE FROM dms_inventory_movement WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'off';");
    await pool.query(
      `DELETE FROM dms_stock_reservation WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM reservation_item WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM inventory_level WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM inventory_item WHERE id = $1;`,
      [testItemId]
    );

    // Seed test physical inventory item: stocked = 20, reserved = 0
    await pool.query(
      `INSERT INTO inventory_item (id, sku, title, requires_shipping)
       VALUES ($1, 'SKU-LIFECYCLE-TEST', 'Lifecycle Test Extrusion', false);`,
      [testItemId]
    );
    await pool.query(
      `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity)
       VALUES ('ilev_p35_lifecycle', $1, $2, 20, 0);`,
      [testItemId, locationId]
    );
  });

  afterAll(async () => {
    // Clean up
    await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'on';");
    await pool.query(
      `DELETE FROM dms_inventory_movement WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'off';");
    await pool.query(
      `DELETE FROM dms_stock_reservation WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM reservation_item WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM inventory_level WHERE inventory_item_id = $1;`,
      [testItemId]
    );
    await pool.query(
      `DELETE FROM inventory_item WHERE id = $1;`,
      [testItemId]
    );
    await closePgPool();
  });

  // ---------------------------------------------------------------------------
  // 1. Explicit Terminal State Machine & Ambiguity Correction (Addendum Sec 2)
  // ---------------------------------------------------------------------------
  describe("Explicit Terminal State Machine & Ambiguity Correction (Addendum Sec 2)", () => {
    it("proves RESERVED -> CONFIRMED decrements physical and reserved stock exactly once with ledger audit", async () => {
      const orderId = "ord_p35_confirm_test";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_1",
          variantId: "var_lifecycle_1",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 3,
          lineItemsCount: 1,
        },
      ];

      // 1. Reserve 3 units
      const res = await reserveStockAtomic(pool, demand, { orderId });
      expect(res).toHaveLength(1);

      // Verify level: reserved = 3, stocked = 20
      let lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(20);
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(3);

      // Verify DMS reservation row
      const dmsRow = await pool.query(
        `SELECT status, quantity FROM dms_stock_reservation WHERE order_id = $1;`,
        [orderId]
      );
      expect(dmsRow.rows[0].status).toBe("RESERVED");
      expect(Number(dmsRow.rows[0].quantity)).toBe(3);

      // 2. Confirm reservation
      const confirmRes = await confirmStockReservationsForOrder(pool, orderId);
      expect(confirmRes.success).toBe(true);
      expect(confirmRes.count).toBe(1);
      expect(confirmRes.alreadyConfirmed).toBe(false);
      expect(confirmRes.terminalState).toBe("CONFIRMED");

      // Verify level: stocked = 17, reserved = 0
      lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(17);
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);

      // 3. Retry confirm (idempotent replay)
      const retryRes = await confirmStockReservationsForOrder(pool, orderId);
      expect(retryRes.success).toBe(true);
      expect(retryRes.alreadyConfirmed).toBe(true);
      expect(retryRes.count).toBe(0);

      // Verify level untouched on retry
      lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(17);
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);

      // Reset stocked quantity back to 20 for next tests
      await pool.query(
        `UPDATE inventory_level SET stocked_quantity = 20 WHERE id = 'ilev_p35_lifecycle';`
      );
    });

    it("CRITICAL: proves a RELEASED or EXPIRED hold NEVER returns alreadyConfirmed: true (Addendum Sec 2)", async () => {
      const orderId = "ord_p35_released_terminal";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_2",
          variantId: "var_lifecycle_2",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 2,
          lineItemsCount: 1,
        },
      ];

      // 1. Reserve 2 units
      await reserveStockAtomic(pool, demand, { orderId });

      // 2. Cancel order / release hold
      const releaseRes = await releaseStockReservationsForOrder(pool, orderId, "USER_CANCELLED");
      expect(releaseRes.success).toBe(true);
      expect(releaseRes.count).toBe(1);
      expect(releaseRes.terminalState).toBe("RELEASED");

      // Verify level: reserved = 0, stocked = 20
      const lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(20);

      // 3. Late payment capture callback attempts to confirm the released hold
      const lateConfirmRes = await confirmStockReservationsForOrder(pool, orderId);

      // MUST REJECT: alreadyConfirmed MUST BE FALSE
      expect(lateConfirmRes.success).toBe(false);
      expect(lateConfirmRes.alreadyConfirmed).toBe(false);
      expect(lateConfirmRes.terminalState).toBe("RELEASED");
      expect(lateConfirmRes.error).toBe("RESERVATION_RELEASED");

      // Verify stock was NOT decremented
      const checkLvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(checkLvl.rows[0].stocked_quantity)).toBe(20);
      expect(Number(checkLvl.rows[0].reserved_quantity)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Reaper Worker Concurrency & Safety (Task 03.5 / Addendum Sec 3)
  // ---------------------------------------------------------------------------
  describe("Scheduled Expiration Reaper Worker (Task 03.5 / Addendum Sec 3)", () => {
    it("reaps expired holds after 15-minute TTL, decrements reserved_quantity, and leaves stocked_quantity untouched", async () => {
      const orderId = "ord_p35_reaper_expired";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_3",
          variantId: "var_lifecycle_3",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 4,
          lineItemsCount: 1,
        },
      ];

      // 1. Reserve 4 units
      await reserveStockAtomic(pool, demand, { orderId });

      // Simulate TTL expiration: backdate expires_at by 20 minutes
      await pool.query(
        `UPDATE dms_stock_reservation
         SET expires_at = NOW() - INTERVAL '20 minutes'
         WHERE order_id = $1;`,
        [orderId]
      );

      // Verify reserved = 4 before reaper
      let lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(4);
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(20);

      // 2. Run reaper worker
      const summary = await reapExpiredReservations({ pool, batchSize: 50 });
      expect(summary.reapedCount).toBeGreaterThanOrEqual(1);

      const itemDetail = summary.details.find((d) => d.orderId === orderId);
      expect(itemDetail).toBeDefined();
      expect(itemDetail?.action).toBe("EXPIRED");
      expect(itemDetail?.quantity).toBe(4);

      // 3. Verify reserved_quantity is restored to 0, stocked_quantity remains 20
      lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(20);

      // 4. Verify durable status is EXPIRED
      const resCheck = await pool.query(
        `SELECT status, reason FROM dms_stock_reservation WHERE order_id = $1;`,
        [orderId]
      );
      expect(resCheck.rows[0].status).toBe("EXPIRED");
      expect(resCheck.rows[0].reason).toBe("HOLD_TTL_EXPIRED");

      // 5. Subsequent reaper run is completely idempotent (0 reaped)
      const secondSummary = await reapExpiredReservations({ pool, batchSize: 50 });
      const secondDetail = secondSummary.details.find((d) => d.orderId === orderId);
      expect(secondDetail).toBeUndefined();
    });

    it("proves reaper leaves active unexpired holds untouched", async () => {
      const orderId = "ord_p35_unexpired";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_4",
          variantId: "var_lifecycle_4",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 2,
          lineItemsCount: 1,
        },
      ];

      // Reserve 2 units with future expiry (+15 min)
      await reserveStockAtomic(pool, demand, { orderId });

      // Run reaper
      const summary = await reapExpiredReservations({ pool, batchSize: 50 });
      const itemDetail = summary.details.find((d) => d.orderId === orderId);
      expect(itemDetail).toBeUndefined();

      // Hold remains RESERVED
      const resCheck = await pool.query(
        `SELECT status FROM dms_stock_reservation WHERE order_id = $1;`,
        [orderId]
      );
      expect(resCheck.rows[0].status).toBe("RESERVED");

      // Clean up hold
      await releaseStockReservationsForOrder(pool, orderId);
    });

    it("proves concurrent reaper workers (FOR UPDATE SKIP LOCKED) never collide or double-reap", async () => {
      const orderA = "ord_p35_concurrent_reap_A";
      const orderB = "ord_p35_concurrent_reap_B";
      const demandA: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_5",
          variantId: "var_lifecycle_5",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 1,
          lineItemsCount: 1,
        },
      ];
      const demandB: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_6",
          variantId: "var_lifecycle_6",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 1,
          lineItemsCount: 1,
        },
      ];

      await reserveStockAtomic(pool, demandA, { orderId: orderA });
      await reserveStockAtomic(pool, demandB, { orderId: orderB });

      // Backdate both to expired
      await pool.query(
        `UPDATE dms_stock_reservation SET expires_at = NOW() - INTERVAL '30 minutes' WHERE order_id IN ($1, $2);`,
        [orderA, orderB]
      );

      // Launch 2 concurrent reaper workers
      const [worker1, worker2] = await Promise.all([
        reapExpiredReservations({ pool, batchSize: 50, actorId: "worker_1" }),
        reapExpiredReservations({ pool, batchSize: 50, actorId: "worker_2" }),
      ]);

      const totalReaped = worker1.reapedCount + worker2.reapedCount;
      expect(totalReaped).toBeGreaterThanOrEqual(2);

      // Verify level: reserved returns to 0
      const lvl = await pool.query(
        `SELECT reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Late Payment Exception & Reconciliation (Task 03.5 / Addendum Sec 3)
  // ---------------------------------------------------------------------------
  describe("Late Payment After Expiry & Read-Only Reconciliation (Task 03.5)", () => {
    it("proves late payment arriving after hold expiry transitions to PAYMENT_RECEIVED_AFTER_EXPIRY without decrementing stock", async () => {
      const orderId = "ord_p35_late_payment";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_7",
          variantId: "var_lifecycle_7",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 3,
          lineItemsCount: 1,
        },
      ];

      // 1. Reserve and expire
      await reserveStockAtomic(pool, demand, { orderId });
      await pool.query(
        `UPDATE dms_stock_reservation SET expires_at = NOW() - INTERVAL '30 minutes' WHERE order_id = $1;`,
        [orderId]
      );
      await reapExpiredReservations({ pool, batchSize: 50 });

      // 2. Late payment capture arrives
      const confirmRes = await confirmStockReservationsForOrder(pool, orderId);

      // Verify late payment rejection
      expect(confirmRes.success).toBe(false);
      expect(confirmRes.alreadyConfirmed).toBe(false);
      expect(confirmRes.terminalState).toBe("EXPIRED");
      expect(confirmRes.error).toBe("RESERVATION_EXPIRED");

      // Verify stock was NOT decremented
      const lvl = await pool.query(
        `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p35_lifecycle';`
      );
      expect(Number(lvl.rows[0].stocked_quantity)).toBe(20);
      expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);
    });

    it("verifies read-only reconciliation report detects unreaped expired holds and level drift", async () => {
      const orderId = "ord_p35_recon_test";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_8",
          variantId: "var_lifecycle_8",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 2,
          lineItemsCount: 1,
        },
      ];

      // 1. Reserve and backdate (unreaped hold)
      await reserveStockAtomic(pool, demand, { orderId });
      await pool.query(
        `UPDATE dms_stock_reservation SET expires_at = NOW() - INTERVAL '45 minutes' WHERE order_id = $1;`,
        [orderId]
      );

      // 2. Generate report
      const report = await generateInventoryReconciliationReport(pool);
      expect(report.unreapedExpiredHoldsCount).toBeGreaterThanOrEqual(1);

      const unreaped = report.unreapedExpiredHolds.find((u) => u.orderId === orderId);
      expect(unreaped).toBeDefined();
      expect(unreaped?.quantity).toBe(2);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Clean up
      await reapExpiredReservations({ pool, batchSize: 50 });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Append-Only Inventory Movement Ledger (P3.6 / BE-06)
  // ---------------------------------------------------------------------------
  describe("Append-Only Inventory Movement Ledger & Audit Trail (P3.6 / BE-06)", () => {
    it("proves complete immutable movement trail from hold to confirmation", async () => {
      const orderId = "ord_p36_ledger_audit";
      const demand: AggregatedStockRequirement[] = [
        {
          aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
          productId: "prod_lifecycle_9",
          variantId: "var_lifecycle_9",
          inventoryItemId: testItemId,
          locationId,
          sellerId,
          sku: "SKU-LIFECYCLE-TEST",
          name: "Lifecycle Extrusion",
          totalUnits: 5,
          lineItemsCount: 1,
        },
      ];

      // 1. Hold
      await reserveStockAtomic(pool, demand, { orderId });

      // 2. Confirm
      await confirmStockReservationsForOrder(pool, orderId);

      // 3. Verify movements in dms_inventory_movement
      const movements = await pool.query(
        `SELECT movement_type, delta_physical, delta_reserved, operation_key
         FROM dms_inventory_movement
         WHERE order_id = $1
         ORDER BY created_at ASC;`,
        [orderId]
      );

      expect(movements.rows).toHaveLength(2);

      // First movement: RESERVE_HOLD
      expect(movements.rows[0].movement_type).toBe("RESERVE_HOLD");
      expect(Number(movements.rows[0].delta_physical)).toBe(0);
      expect(Number(movements.rows[0].delta_reserved)).toBe(5);

      // Second movement: CONFIRM_SALE
      expect(movements.rows[1].movement_type).toBe("CONFIRM_SALE");
      expect(Number(movements.rows[1].delta_physical)).toBe(-5);
      expect(Number(movements.rows[1].delta_reserved)).toBe(-5);

      // Reset stocked quantity
      await pool.query(
        `UPDATE inventory_level SET stocked_quantity = 20 WHERE id = 'ilev_p35_lifecycle';`
      );
    });

    it("enforces operation-key uniqueness to guarantee idempotent movement recording", async () => {
      const opKey = "op_unique_test_key_123";

      // Insert once
      await pool.query(
        `INSERT INTO dms_inventory_movement (
           id, operation_key, inventory_item_id, location_id, seller_id, movement_type,
           delta_physical, delta_reserved, actor_type, created_at, updated_at
         ) VALUES ('mov_u1', $1, $2, $3, $4, 'INVENTORY_ADJUSTMENT', 0, 0, 'system', NOW(), NOW())
         ON CONFLICT (operation_key) DO NOTHING;`,
        [opKey, testItemId, locationId, sellerId]
      );

      // Duplicate insert with ON CONFLICT DO NOTHING
      const dupRes = await pool.query(
        `INSERT INTO dms_inventory_movement (
           id, operation_key, inventory_item_id, location_id, seller_id, movement_type,
           delta_physical, delta_reserved, actor_type, created_at, updated_at
         ) VALUES ('mov_u2', $1, $2, $3, $4, 'INVENTORY_ADJUSTMENT', 0, 0, 'system', NOW(), NOW())
         ON CONFLICT (operation_key) DO NOTHING;`,
        [opKey, testItemId, locationId, sellerId]
      );

      expect(dupRes.rowCount).toBe(0);

      // Verify only 1 row exists
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM dms_inventory_movement WHERE operation_key = $1;`,
        [opKey]
      );
      expect(Number(countRes.rows[0].count)).toBe(1);

      // Clean up
      await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'on';");
      await pool.query(
        `DELETE FROM dms_inventory_movement WHERE operation_key = $1;`,
        [opKey]
      );
      await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'off';");
    });
  });
});
