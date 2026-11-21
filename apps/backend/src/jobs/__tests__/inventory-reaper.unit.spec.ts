import inventoryReaperJob, { config } from "../inventory-reaper";
import { reapExpiredReservations } from "../../lib/inventory-reaper";

jest.mock("../../lib/inventory-reaper", () => ({
  reapExpiredReservations: jest.fn(),
}));

describe("Medusa Scheduled Job: Inventory Reaper (P4.0.B)", () => {
  const originalEnv = process.env.INVENTORY_REAPER_ENABLED;
  const mockReap = reapExpiredReservations as jest.MockedFunction<typeof reapExpiredReservations>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.INVENTORY_REAPER_ENABLED = originalEnv;
  });

  it("exports valid Medusa scheduled job configuration", () => {
    expect(config.name).toBe("sai-ajanta-inventory-reaper");
    expect(config.schedule).toBe("*/2 * * * *");
  });

  it("skips execution fail-closed when INVENTORY_REAPER_ENABLED is not 'true'", async () => {
    process.env.INVENTORY_REAPER_ENABLED = "false";

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockContainer: any = {
      resolve: jest.fn().mockReturnValue(mockLogger),
    };

    await inventoryReaperJob(mockContainer);

    expect(mockReap).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining("INVENTORY_REAPER_ENABLED is false")
    );
  });

  it("invokes reapExpiredReservations when INVENTORY_REAPER_ENABLED is 'true'", async () => {
    process.env.INVENTORY_REAPER_ENABLED = "true";
    mockReap.mockResolvedValueOnce({
      scannedCount: 5,
      reapedCount: 3,
      skippedCount: 2,
      dryRun: false,
      timestamp: new Date().toISOString(),
      details: [],
    });

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockContainer: any = {
      resolve: jest.fn().mockReturnValue(mockLogger),
    };

    await inventoryReaperJob(mockContainer);

    expect(mockReap).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: 50,
        actorId: "medusa_scheduled_job",
      })
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Scanned: 5, Reaped: 3, Skipped: 2")
    );
  });

  it("handles and logs errors cleanly without throwing unhandled exceptions", async () => {
    process.env.INVENTORY_REAPER_ENABLED = "true";
    mockReap.mockRejectedValueOnce(new Error("Database connection timeout"));

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockContainer: any = {
      resolve: jest.fn().mockReturnValue(mockLogger),
    };

    await expect(inventoryReaperJob(mockContainer)).resolves.not.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Database connection timeout"),
      expect.any(Error)
    );
  });
});
