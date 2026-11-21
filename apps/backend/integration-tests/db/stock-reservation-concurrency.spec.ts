import { Pool } from "pg";
import {
  reserveStockAtomic,
  confirmStockReservations,
  releaseStockReservations,
  InsufficientStockError,
  AggregatedStockRequirement,
} from "../../src/lib/inventory";
import { getPgPool, closePgPool } from "../../src/lib/db";

describe("PostgreSQL Row-Locked Atomic Inventory Reservation Concurrency (BE-05, RB-04)", () => {
  let pool: Pool;
  const locationId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z"; // Sai Ajantha Warehouse - Trichy
  const raceItemId = "iitem_concurrency_race";
  const itemAId = "iitem_atomic_a";
  const itemBId = "iitem_atomic_b";

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgres://medusa:7hippocampus@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
    pool = getPgPool();

    // Clean up test items if existed from prior aborted runs
    await pool.query(
      `DELETE FROM reservation_item WHERE inventory_item_id IN ($1, $2, $3);`,
      [raceItemId, itemAId, itemBId]
    );
    await pool.query(
      `DELETE FROM inventory_level WHERE inventory_item_id IN ($1, $2, $3);`,
      [raceItemId, itemAId, itemBId]
    );
    await pool.query(
      `DELETE FROM inventory_item WHERE id IN ($1, $2, $3);`,
      [raceItemId, itemAId, itemBId]
    );

    // Seed test inventory items
    await pool.query(
      `INSERT INTO inventory_item (id, sku, title, requires_shipping)
       VALUES 
         ($1, 'SKU-RACE-TEST', 'Race Condition Test SKU', false),
         ($2, 'SKU-ATOMIC-A', 'Atomic Item A', false),
         ($3, 'SKU-ATOMIC-B', 'Atomic Item B (Empty)', false);`,
      [raceItemId, itemAId, itemBId]
    );

    // Seed inventory levels
    // raceItemId: 1 in stock, 0 reserved
    // itemAId: 5 in stock, 0 reserved
    // itemBId: 0 in stock, 0 reserved
    await pool.query(
      `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity)
       VALUES 
         ('ilev_race_test', $1, $4, 1, 0),
         ('ilev_atom_a', $2, $4, 5, 0),
         ('ilev_atom_b', $3, $4, 0, 0);`,
      [raceItemId, itemAId, itemBId, locationId]
    );
  });

  afterAll(async () => {
    try {
      await pool.query(
        `DELETE FROM reservation_item WHERE inventory_item_id IN ($1, $2, $3);`,
        [raceItemId, itemAId, itemBId]
      );
      await pool.query(
        `DELETE FROM inventory_level WHERE inventory_item_id IN ($1, $2, $3);`,
        [raceItemId, itemAId, itemBId]
      );
      await pool.query(
        `DELETE FROM inventory_item WHERE id IN ($1, $2, $3);`,
        [raceItemId, itemAId, itemBId]
      );
      await closePgPool();
    } catch {
      // ignore teardown error
    }
  });

  it("proves exactly 1 winner and 1 409-conflict under concurrent race for the last available unit (quantity = 1)", async () => {
    const buyer1Requirement: AggregatedStockRequirement[] = [
      {
        aggregationKey: "buyer1_key",
        productId: "prod_race",
        variantId: "var_race",
        inventoryItemId: raceItemId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-RACE-TEST",
        name: "Race Condition Test SKU",
        totalUnits: 1,
        lineItemsCount: 1,
      },
    ];

    const buyer2Requirement: AggregatedStockRequirement[] = [
      {
        aggregationKey: "buyer2_key",
        productId: "prod_race",
        variantId: "var_race",
        inventoryItemId: raceItemId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-RACE-TEST",
        name: "Race Condition Test SKU",
        totalUnits: 1,
        lineItemsCount: 1,
      },
    ];

    // Launch both reservation requests simultaneously into PostgreSQL
    const results = await Promise.allSettled([
      reserveStockAtomic(pool, buyer1Requirement, { orderId: "ord_buyer_1" }),
      reserveStockAtomic(pool, buyer2Requirement, { orderId: "ord_buyer_2" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    // 1. Exactly one request must succeed with 200/201 equivalent
    expect(fulfilled).toHaveLength(1);
    const winnerReservation = fulfilled[0].value;
    expect(winnerReservation).toHaveLength(1);
    expect(winnerReservation[0].quantity).toBe(1);
    expect(winnerReservation[0].inventory_item_id).toBe(raceItemId);

    // 2. Exactly one request must fail with 409 InsufficientStockError
    expect(rejected).toHaveLength(1);
    const rejectionError = rejected[0].reason;
    expect(rejectionError).toBeInstanceOf(InsufficientStockError);
    expect(rejectionError.status).toBe(409);
    expect(rejectionError.code).toBe("INSUFFICIENT_STOCK");
    expect(rejectionError.details.availableQuantity).toBe(0);
    expect(rejectionError.details.requestedQuantity).toBe(1);

    // 3. In PostgreSQL, reserved_quantity must be EXACTLY 1, never 2, and stocked_quantity must be 1
    const levelRes = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1 AND location_id = $2;`,
      [raceItemId, locationId]
    );
    expect(levelRes.rows).toHaveLength(1);
    const level = levelRes.rows[0];
    expect(Number(level.stocked_quantity)).toBe(1);
    expect(Number(level.reserved_quantity)).toBe(1);

    // Clean up winner reservation for next tests
    await releaseStockReservations(pool, [winnerReservation[0].id]);
  });

  it("verifies multi-item all-or-nothing atomic rollback when any item in cart is out of stock", async () => {
    // Cart contains Item A (has 5 units) and Item B (has 0 units)
    const multiItemRequirements: AggregatedStockRequirement[] = [
      {
        aggregationKey: "multi_a",
        productId: "prod_a",
        variantId: "var_a",
        inventoryItemId: itemAId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-ATOMIC-A",
        name: "Atomic Item A",
        totalUnits: 2,
        lineItemsCount: 1,
      },
      {
        aggregationKey: "multi_b",
        productId: "prod_b",
        variantId: "var_b",
        inventoryItemId: itemBId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-ATOMIC-B",
        name: "Atomic Item B (Empty)",
        totalUnits: 1,
        lineItemsCount: 1,
      },
    ];

    await expect(
      reserveStockAtomic(pool, multiItemRequirements, { orderId: "ord_multi_test" })
    ).rejects.toThrow(InsufficientStockError);

    // Verify Item A was NOT partially reserved (rollback verified)
    const levelARes = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1 AND location_id = $2;`,
      [itemAId, locationId]
    );
    expect(Number(levelARes.rows[0].reserved_quantity)).toBe(0);

    // Verify no orphaned reservation_item was inserted
    const resCount = await pool.query(
      `SELECT count(*) FROM reservation_item WHERE inventory_item_id IN ($1, $2) AND deleted_at IS NULL;`,
      [itemAId, itemBId]
    );
    expect(Number(resCount.rows[0].count)).toBe(0);
  });

  it("confirms reservation on payment capture (stocked_quantity and reserved_quantity both decremented)", async () => {
    // 1. Reserve 1 unit of Item A (was stocked: 5, reserved: 0)
    const req: AggregatedStockRequirement[] = [
      {
        aggregationKey: "req_confirm",
        productId: "prod_a",
        variantId: "var_a",
        inventoryItemId: itemAId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-ATOMIC-A",
        name: "Atomic Item A",
        totalUnits: 1,
        lineItemsCount: 1,
      },
    ];

    const reservations = await reserveStockAtomic(pool, req, { orderId: "ord_capture_test" });
    expect(reservations).toHaveLength(1);
    const resId = reservations[0].id;

    // After reservation: stocked: 5, reserved: 1
    let check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [itemAId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(5);
    expect(Number(check.rows[0].reserved_quantity)).toBe(1);

    // 2. Simulate payment capture: confirm reservation
    await confirmStockReservations(pool, [resId]);

    // After capture: stocked: 4, reserved: 0
    check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [itemAId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(4);
    expect(Number(check.rows[0].reserved_quantity)).toBe(0);

    // Reservation item record marked deleted
    const resItem = await pool.query(`SELECT deleted_at FROM reservation_item WHERE id = $1;`, [resId]);
    expect(resItem.rows[0].deleted_at).not.toBeNull();
  });

  it("releases reservation on cancellation/expiry (reserved_quantity restored to 0, stocked_quantity untouched)", async () => {
    // 1. Reserve 2 units of Item A (currently stocked: 4, reserved: 0)
    const req: AggregatedStockRequirement[] = [
      {
        aggregationKey: "req_release",
        productId: "prod_a",
        variantId: "var_a",
        inventoryItemId: itemAId,
        locationId,
        sellerId: "sai-ajantha-central",
        sku: "SKU-ATOMIC-A",
        name: "Atomic Item A",
        totalUnits: 2,
        lineItemsCount: 1,
      },
    ];

    const reservations = await reserveStockAtomic(pool, req, { orderId: "ord_cancel_test" });
    expect(reservations).toHaveLength(1);
    const resId = reservations[0].id;

    // Reserved quantity should be 2
    let check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [itemAId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(4);
    expect(Number(check.rows[0].reserved_quantity)).toBe(2);

    // 2. Release reservation (e.g. order cancelled or abandoned)
    await releaseStockReservations(pool, [resId]);

    // Reserved quantity should be 0, stocked quantity should remain 4
    check = await pool.query(
      `SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1;`,
      [itemAId]
    );
    expect(Number(check.rows[0].stocked_quantity)).toBe(4);
    expect(Number(check.rows[0].reserved_quantity)).toBe(0);

    // Reservation item record marked deleted
    const resItem = await pool.query(`SELECT deleted_at FROM reservation_item WHERE id = $1;`, [resId]);
    expect(resItem.rows[0].deleted_at).not.toBeNull();
  });
});
