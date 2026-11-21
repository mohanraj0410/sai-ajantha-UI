import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { reapExpiredReservations } from "../lib/inventory-reaper";

/**
 * Medusa 2 Scheduled Job: Inventory Hold Expiration Reaper (P4.0.B)
 *
 * Runs on a recurring schedule to safely claim and release expired 15-minute stock holds.
 *
 * Fail-Closed Safeguards:
 * 1. Opt-in gate via `INVENTORY_REAPER_ENABLED === "true"` (disabled by default in dev/prod unless approved).
 * 2. Uses `SELECT ... FOR UPDATE SKIP LOCKED` inside `reapExpiredReservations` to prevent multi-instance overlap.
 * 3. Authoritative order/payment check protects paid orders from accidental release.
 */
export default async function inventoryReaperJob(container: MedusaContainer) {
  const isEnabled = process.env.INVENTORY_REAPER_ENABLED === "true";
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  if (!isEnabled) {
    if (logger && typeof logger.debug === "function") {
      logger.debug(
        "[InventoryReaperJob] Job triggered but INVENTORY_REAPER_ENABLED is false; skipping execution."
      );
    }
    return;
  }

  try {
    if (logger && typeof logger.info === "function") {
      logger.info("[InventoryReaperJob] Executing scheduled hold expiration reaper...");
    }

    const summary = await reapExpiredReservations({
      batchSize: 50,
      actorId: "medusa_scheduled_job",
    });

    if (logger && typeof logger.info === "function") {
      logger.info(
        `[InventoryReaperJob] Completed run. Scanned: ${summary.scannedCount}, Reaped: ${summary.reapedCount}, Skipped: ${summary.skippedCount}`
      );
    }
  } catch (err: any) {
    if (logger && typeof logger.error === "function") {
      logger.error(
        `[InventoryReaperJob] Failed to execute inventory reaper: ${err.message}`,
        err
      );
    }
  }
}

export const config = {
  name: "sai-ajanta-inventory-reaper",
  // Runs every 2 minutes
  schedule: "*/2 * * * *",
};
