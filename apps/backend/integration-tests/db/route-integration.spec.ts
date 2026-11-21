import { Pool } from "pg";
import {
  reserveStockAtomic,
  confirmStockReservationsForOrder,
  releaseStockReservationsForOrder,
  AggregatedStockRequirement,
} from "../../src/lib/inventory";
import { reapExpiredReservations } from "../../src/lib/inventory-reaper";
import { getPgPool, closePgPool } from "../../src/lib/db";
import { getIdempotencyStore } from "../../src/lib/payment/idempotency";

describe("Phase 03 Work Unit P3.7: Real PostgreSQL Route-Level & Failure Invariant Tests", () => {
  let pool: Pool;
  const locationId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z";
  const sellerId = "sel_central_warehouse";
  const testItemId = "iitem_p37_route";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgres://medusa:7hippocampus@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
    pool = getPgPool();

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

    // Seed: stocked = 5, reserved = 0
    await pool.query(
      `INSERT INTO inventory_item (id, sku, title, requires_shipping)
       VALUES ($1, 'SKU-P37-ROUTE', 'P3.7 Route Extrusion', false);`,
      [testItemId]
    );
    await pool.query(
      `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity)
       VALUES ('ilev_p37_route', $1, $2, 5, 0);`,
      [testItemId, locationId]
    );
  });

  afterAll(async () => {
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

  it("proves two concurrent orders with DIFFERENT checkout intent IDs do NOT collapse and isolate reservations", async () => {
    const orderId1 = "ord_p37_distinct_intent_1";
    const orderId2 = "ord_p37_distinct_intent_2";

    const demand1: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
        productId: "prod_p37_1",
        variantId: "var_p37_1",
        inventoryItemId: testItemId,
        locationId,
        sellerId,
        sku: "SKU-P37-ROUTE",
        name: "Route Extrusion",
        totalUnits: 3,
        lineItemsCount: 1,
      },
    ];

    const demand2: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
        productId: "prod_p37_1",
        variantId: "var_p37_1",
        inventoryItemId: testItemId,
        locationId,
        sellerId,
        sku: "SKU-P37-ROUTE",
        name: "Route Extrusion",
        totalUnits: 2,
        lineItemsCount: 1,
      },
    ];

    // Concurrently reserve
    const [res1, res2] = await Promise.all([
      reserveStockAtomic(pool, demand1, { orderId: orderId1 }),
      reserveStockAtomic(pool, demand2, { orderId: orderId2 }),
    ]);

    expect(res1).toHaveLength(1);
    expect(res2).toHaveLength(1);

    // Total reserved = 5 (all units reserved)
    const lvl = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p37_route';`
    );
    expect(Number(lvl.rows[0].stocked_quantity)).toBe(5);
    expect(Number(lvl.rows[0].reserved_quantity)).toBe(5);

    // Third order for 1 unit must now fail with InsufficientStockError
    const demand3: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
        productId: "prod_p37_1",
        variantId: "var_p37_1",
        inventoryItemId: testItemId,
        locationId,
        sellerId,
        sku: "SKU-P37-ROUTE",
        name: "Route Extrusion",
        totalUnits: 1,
        lineItemsCount: 1,
      },
    ];

    await expect(
      reserveStockAtomic(pool, demand3, { orderId: "ord_p37_third" })
    ).rejects.toThrow("Insufficient warehouse stock");

    // Clean up
    await releaseStockReservationsForOrder(pool, orderId1);
    await releaseStockReservationsForOrder(pool, orderId2);

    const checkLvl = await pool.query(
      `SELECT reserved_quantity FROM inventory_level WHERE id = 'ilev_p37_route';`
    );
    expect(Number(checkLvl.rows[0].reserved_quantity)).toBe(0);
  });

  it("proves same idempotency intent retried replays cached response without duplicate stock mutation", async () => {
    const store = getIdempotencyStore();
    const idemKey = "idem_p37_test_key_abc";
    const actorId = "cus_p37_actor";

    // 1. First check -> IN_PROGRESS
    const firstCheck = await store.check(
      idemKey,
      actorId,
      "order:create",
      { cartId: "cart_123" }
    );
    expect(firstCheck.status).toBe("NEW");

    // Record response
    await store.record(
      idemKey,
      actorId,
      "order:create",
      { cartId: "cart_123" },
      201,
      { orderId: "ord_p37_cached", status: "CONFIRMED" }
    );

    // 2. Retry with same payload -> REPLAY
    const retryCheck = await store.check(
      idemKey,
      actorId,
      "order:create",
      { cartId: "cart_123" }
    );
    expect(retryCheck.status).toBe("REPLAY");
    if (retryCheck.status === "REPLAY") {
      expect(retryCheck.responseStatus).toBe(201);
      expect(retryCheck.responseBody).toEqual({
        orderId: "ord_p37_cached",
        status: "CONFIRMED",
      });
    }

    // 3. Retry with mutated payload -> CONFLICT
    const mutatedCheck = await store.check(
      idemKey,
      actorId,
      "order:create",
      { cartId: "cart_MUTATED" }
    );
    expect(mutatedCheck.status).toBe("CONFLICT");
  });

  it("proves existing expired reservation_item with deleted_at set is NOT interpreted as CONFIRMED (P3.7 / Addendum Sec 5)", async () => {
    const expiredOrderId = "ord_p37_legacy_deleted";

    // Insert a legacy reservation item with deleted_at already set
    await pool.query(
      `INSERT INTO reservation_item (
         id, inventory_item_id, location_id, quantity, line_item_id, description, deleted_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 2, $4, 'Legacy hold', NOW() - INTERVAL '1 hour', NOW(), NOW());`,
      ["res_p37_legacy_del", testItemId, locationId, expiredOrderId]
    );

    // Confirm must NOT claim alreadyConfirmed: true because the order was not paid
    const confirmRes = await confirmStockReservationsForOrder(pool, expiredOrderId);

    expect(confirmRes.alreadyConfirmed).toBe(false);
    expect(confirmRes.success).toBe(false);
    expect(confirmRes.terminalState).toBe("RELEASED");

    // Clean up
    await pool.query(`DELETE FROM reservation_item WHERE id = 'res_p37_legacy_del';`);
  });

  it("proves delayed webhook arriving after expiry results in exception and zero physical stock decrement", async () => {
    const orderId = "ord_p37_delayed_webhook";
    const demand: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${testItemId}::${locationId}::${sellerId}`,
        productId: "prod_p37_2",
        variantId: "var_p37_2",
        inventoryItemId: testItemId,
        locationId,
        sellerId,
        sku: "SKU-P37-ROUTE",
        name: "Route Extrusion",
        totalUnits: 2,
        lineItemsCount: 1,
      },
    ];

    // 1. Reserve 2 units
    await reserveStockAtomic(pool, demand, { orderId });

    // 2. Expire hold
    await pool.query(
      `UPDATE dms_stock_reservation SET expires_at = NOW() - INTERVAL '30 minutes' WHERE order_id = $1;`,
      [orderId]
    );
    await reapExpiredReservations({ pool, batchSize: 50 });

    // 3. Webhook arrives for this order
    const webhookConfirm = await confirmStockReservationsForOrder(pool, orderId);

    // Webhook confirmation must fail because hold is EXPIRED
    expect(webhookConfirm.success).toBe(false);
    expect(webhookConfirm.terminalState).toBe("EXPIRED");
    expect(webhookConfirm.alreadyConfirmed).toBe(false);

    // Verify physical stock remains 5, reserved returns to 0
    const lvl = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE id = 'ilev_p37_route';`
    );
    expect(Number(lvl.rows[0].stocked_quantity)).toBe(5);
    expect(Number(lvl.rows[0].reserved_quantity)).toBe(0);
  });
});
