import { Pool } from "pg";
import {
  reserveStockAtomic,
  confirmStockReservationsForOrder,
  releaseStockReservationsForOrder,
  InsufficientStockError,
  AggregatedStockRequirement,
} from "../../src/lib/inventory";
import { getPgPool, closePgPool } from "../../src/lib/db";

describe("P3.4.1 Critical Correctness Audit & Multi-Worker Concurrency Integration Tests", () => {
  let pool: Pool;
  const locationId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z";
  const sharedItemId = "iitem_p341_shared";
  const raceOrderId = "ord_p341_race_order";
  const cancelOrderId = "ord_p341_cancel_race";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgres://medusa:7hippocampus@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
    pool = getPgPool();

    // Clean up test items
    await pool.query(
      `DELETE FROM reservation_item WHERE line_item_id IN ($1, $2) OR inventory_item_id = $3;`,
      [raceOrderId, cancelOrderId, sharedItemId]
    );
    await pool.query(
      `DELETE FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    await pool.query(
      `DELETE FROM inventory_item WHERE id = $1;`,
      [sharedItemId]
    );

    // Seed shared physical inventory item: stocked = 10, reserved = 0
    await pool.query(
      `INSERT INTO inventory_item (id, sku, title, requires_shipping)
       VALUES ($1, 'SKU-SHARED-BASE', 'Shared Extrusion Base', false);`,
      [sharedItemId]
    );
    await pool.query(
      `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity)
       VALUES ('ilev_p341_shared', $1, $2, 10, 0);`,
      [sharedItemId, locationId]
    );
  });

  afterAll(async () => {
    try {
      await pool.query(
        `DELETE FROM reservation_item WHERE line_item_id IN ($1, $2) OR inventory_item_id = $3;`,
        [raceOrderId, cancelOrderId, sharedItemId]
      );
      await pool.query(
        `DELETE FROM inventory_level WHERE inventory_item_id = $1;`,
        [sharedItemId]
      );
      await pool.query(
        `DELETE FROM inventory_item WHERE id = $1;`,
        [sharedItemId]
      );
      await closePgPool();
    } catch {
      // ignore
    }
  });

  it("A.1: Rejects combined demand exceeding physical availability when variants share the same inventory item", async () => {
    // 2 variants share sharedItemId (stock = 10).
    // Variant 1 needs 6 units, Variant 2 needs 5 units -> aggregated demand = 11 units.
    const aggregatedDemand: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${sharedItemId}::${locationId}::sai-ajantha-central`,
        productId: "prod_shared_profiles",
        variantId: "var_finish_silver",
        inventoryItemId: sharedItemId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "EXT-SLV, EXT-BRZ",
        name: "Shared Extrusion Profile",
        totalUnits: 11, // 6 + 5 = 11 > 10 in stock
        lineItemsCount: 2,
      },
    ];

    await expect(
      reserveStockAtomic(pool, aggregatedDemand, { orderId: "ord_shared_test" })
    ).rejects.toThrow(InsufficientStockError);

    // Verify reserved_quantity is still 0
    const levelRes = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    expect(Number(levelRes.rows[0].stocked_quantity)).toBe(10);
    expect(Number(levelRes.rows[0].reserved_quantity)).toBe(0);
  });

  it("B.5: Simultaneous Payment Capture + Webhook Delivery Race decrements physical stock EXACTLY ONCE", async () => {
    // 1. Reserve 3 units for raceOrderId (stock was 10, will be stocked: 10, reserved: 3)
    const demand: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${sharedItemId}::${locationId}::sai-ajantha-central`,
        productId: "prod_shared_profiles",
        variantId: "var_1",
        inventoryItemId: sharedItemId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "EXT-SLV",
        name: "Shared Extrusion Profile",
        totalUnits: 3,
        lineItemsCount: 1,
      },
    ];

    const reservations = await reserveStockAtomic(pool, demand, { orderId: raceOrderId });
    expect(reservations).toHaveLength(1);

    // Verify pre-capture state: stocked = 10, reserved = 3
    let check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(10);
    expect(Number(check.rows[0].reserved_quantity)).toBe(3);

    // 2. Launch concurrent confirmation from both payment redirect and webhook simultaneously
    const [captureResult, webhookResult] = await Promise.all([
      confirmStockReservationsForOrder(pool, raceOrderId),
      confirmStockReservationsForOrder(pool, raceOrderId),
    ]);

    // Exactly one should confirm active rows; the other must detect alreadyConfirmed: true
    const confirmedOne = (captureResult.count === 1 && webhookResult.alreadyConfirmed) ||
                         (webhookResult.count === 1 && captureResult.alreadyConfirmed);
    expect(confirmedOne).toBe(true);

    // 3. Physical stock MUST be decremented by EXACTLY 3 (10 - 3 = 7), NEVER by 6!
    check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(7);
    expect(Number(check.rows[0].reserved_quantity)).toBe(0);

    // 4. Subsequent retry is idempotent: stock remains 7
    const retryResult = await confirmStockReservationsForOrder(pool, raceOrderId);
    expect(retryResult.alreadyConfirmed).toBe(true);
    expect(retryResult.count).toBe(0);

    check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(7);
  });

  it("B.5: Simultaneous Cancellation vs Payment Confirmation Race results in exactly one terminal outcome", async () => {
    // 1. Reserve 2 units for cancelOrderId (stocked was 7, reserved was 0 -> becomes stocked: 7, reserved: 2)
    const demand: AggregatedStockRequirement[] = [
      {
        aggregationKey: `${sharedItemId}::${locationId}::sai-ajantha-central`,
        productId: "prod_shared_profiles",
        variantId: "var_1",
        inventoryItemId: sharedItemId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "EXT-SLV",
        name: "Shared Extrusion Profile",
        totalUnits: 2,
        lineItemsCount: 1,
      },
    ];

    await reserveStockAtomic(pool, demand, { orderId: cancelOrderId });

    // 2. Race cancellation (release) vs payment capture (confirm) simultaneously
    const [cancelRes, confirmRes] = await Promise.all([
      releaseStockReservationsForOrder(pool, cancelOrderId),
      confirmStockReservationsForOrder(pool, cancelOrderId),
    ]);

    // Exactly one operation must claim the active reservation; the loser receives the explicit terminal rejection (P3.5 Preflight / Addendum Sec 2)
    const oneWon =
      (cancelRes.count === 1 && confirmRes.terminalState === "RELEASED" && !confirmRes.alreadyConfirmed) ||
      (confirmRes.count === 1 && (cancelRes.terminalState === "CONFIRMED" || cancelRes.alreadyReleased));
    expect(oneWon).toBe(true);

    // Verify stock is never negative and reserved_quantity returns to 0
    const check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [sharedItemId]
    );
    expect(Number(check.rows[0].reserved_quantity)).toBe(0);
    // If confirm won: stocked = 5; if cancel won: stocked = 7. Neither should create negative stock.
    const stocked = Number(check.rows[0].stocked_quantity);
    expect(stocked === 5 || stocked === 7).toBe(true);
  });
});
