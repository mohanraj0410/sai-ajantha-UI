import { Pool } from "pg";
import { getPgPool, closePgPool } from "../../src/lib/db";
import { reserveStockAtomic } from "../../src/lib/inventory";

describe("Work Unit P4.0.C: Database Ledger Immutability & Transaction Boundaries", () => {
  let pool: Pool;
  const testMovementId = "mov_immutability_test_" + Date.now();
  const testOpKey = "op_immutability_key_" + Date.now();

  beforeAll(async () => {
    // Direct test connection strictly to disposable rehearsal database
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      "postgres://medusa:7hippocampus@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
    process.env.DATABASE_URL = testDbUrl;
    pool = getPgPool(testDbUrl);

    // Ensure the trigger exists on disposable DB
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_dms_inventory_movement_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('sai_ajantha.bypass_ledger_trigger', true) = 'on' THEN
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'dms_inventory_movement is strictly an append-only audit ledger: % operations are prohibited.', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trg_dms_inventory_movement_immutable ON dms_inventory_movement;
    `);

    await pool.query(`
      CREATE TRIGGER trg_dms_inventory_movement_immutable
      BEFORE UPDATE OR DELETE ON dms_inventory_movement
      FOR EACH ROW
      EXECUTE FUNCTION prevent_dms_inventory_movement_mutation();
    `);
  });

  afterAll(async () => {
    // Session-scoped bypass strictly for test fixture teardown
    try {
      await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'on';");
      await pool.query(`DELETE FROM dms_inventory_movement WHERE id = $1;`, [testMovementId]);
      await pool.query("SET sai_ajantha.bypass_ledger_trigger = 'off';");
    } catch {
      // Best-effort cleanup
    }
    await closePgPool();
  });

  it("permits append-only INSERT operations on dms_inventory_movement", async () => {
    const insertRes = await pool.query(
      `INSERT INTO dms_inventory_movement (
        id, operation_key, inventory_item_id, location_id, seller_id, movement_type,
        delta_physical, delta_reserved, actor_type, created_at, updated_at
      ) VALUES ($1, $2, 'item_imm_test', 'loc_imm_test', 'seller_central', 'AUDIT_TEST', 0, 0, 'system', NOW(), NOW())
      RETURNING id, operation_key;`,
      [testMovementId, testOpKey]
    );

    expect(insertRes.rows.length).toBe(1);
    expect(insertRes.rows[0].id).toBe(testMovementId);
  });

  it("strictly rejects direct UPDATE attempts with a PostgreSQL trigger exception", async () => {
    let error: any = null;
    try {
      await pool.query(
        `UPDATE dms_inventory_movement SET reason = 'tampered' WHERE id = $1;`,
        [testMovementId]
      );
    } catch (err: any) {
      error = err;
    }

    expect(error).not.toBeNull();
    expect(error.message).toContain("append-only audit ledger: UPDATE operations are prohibited");
  });

  it("strictly rejects direct DELETE attempts with a PostgreSQL trigger exception", async () => {
    let error: any = null;
    try {
      await pool.query(
        `DELETE FROM dms_inventory_movement WHERE id = $1;`,
        [testMovementId]
      );
    } catch (err: any) {
      error = err;
    }

    expect(error).not.toBeNull();
    expect(error.message).toContain("append-only audit ledger: DELETE operations are prohibited");
  });

  it("guarantees atomic rollback when a failure is injected within reservation transaction", async () => {
    const testItemId = "iitem_rollback_test_" + Date.now();
    const testLocId = "sloc_01M7HKTTVP6J72Y042MEEFPT6Z";
    const testOrderId = "ord_rollback_test_" + Date.now();
    const testLevelId = "ilev_rollback_" + Date.now();

    const testSku = "SKU-ROLLBACK-" + Date.now();

    // Clean up if existing
    await pool.query(`DELETE FROM inventory_level WHERE inventory_item_id = $1;`, [testItemId]);
    await pool.query(`DELETE FROM inventory_item WHERE id = $1;`, [testItemId]);

    // Ensure inventory item and level exist
    await pool.query(
      `INSERT INTO inventory_item (id, sku, requires_shipping, created_at, updated_at)
       VALUES ($1, $2, true, NOW(), NOW());`,
      [testItemId, testSku]
    );
    await pool.query(
      `INSERT INTO inventory_level (id, inventory_item_id, location_id, stocked_quantity, reserved_quantity, created_at, updated_at)
       VALUES ($1, $2, $3, 100, 0, NOW(), NOW());`,
      [testLevelId, testItemId, testLocId]
    );

    // Run transaction where reservation succeeds but subsequent operation throws
    const client = await pool.connect();
    let txnRolledBack = false;
    try {
      await client.query("BEGIN;");
      // 1. Create reservation inside transaction
      await reserveStockAtomic(
        client,
        [
          {
            aggregationKey: `${testItemId}::${testLocId}::seller_test`,
            productId: "prod_rollback_test",
            variantId: "var_rollback_test",
            inventoryItemId: testItemId,
            locationId: testLocId,
            sellerId: "seller_test",
            sku: testSku,
            name: "Rollback Test Item",
            totalUnits: 5,
            lineItemsCount: 1,
          },
        ],
        { orderId: testOrderId }
      );

      // 2. Simulate downstream failure (e.g. payment gateway or order persistence failure)
      throw new Error("Simulated downstream payment gateway initialization error");
    } catch (err: any) {
      txnRolledBack = true;
      await client.query("ROLLBACK;");
    } finally {
      client.release();
    }

    expect(txnRolledBack).toBe(true);

    // Verify ZERO orphan reservations exist for this orderId
    const checkRes = await pool.query(
      `SELECT * FROM dms_stock_reservation WHERE order_id = $1;`,
      [testOrderId]
    );
    expect(checkRes.rows.length).toBe(0);

    // Verify inventory level reserved_quantity was NOT mutated (still 0)
    const levelRes = await pool.query(
      `SELECT reserved_quantity FROM inventory_level WHERE id = $1;`,
      [testLevelId]
    );
    expect(Number(levelRes.rows[0].reserved_quantity)).toBe(0);

    // Cleanup
    await pool.query(`DELETE FROM inventory_level WHERE id = $1;`, [testLevelId]);
    await pool.query(`DELETE FROM inventory_item WHERE id = $1;`, [testItemId]);
  });
});
