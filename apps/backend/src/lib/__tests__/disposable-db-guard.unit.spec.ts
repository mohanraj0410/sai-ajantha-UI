import { assertDisposableDbTarget, assertDisposableDbConnection } from "../disposable-db-guard";

describe("Phase 06 Safety Gate: assertDisposableDbTarget", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should throw if ALLOW_DISPOSABLE_DB_WRITES is not 'true'", () => {
    delete process.env.ALLOW_DISPOSABLE_DB_WRITES;
    expect(() =>
      assertDisposableDbTarget("postgres://medusa:pass@localhost:5432/medusa_restore_rehearsal_disposable")
    ).toThrow("[DATA_SAFETY_GUARD] Write operations rejected: ALLOW_DISPOSABLE_DB_WRITES=true is required.");
  });

  it("should FATALLY reject writes targeting 'medusa'", () => {
    process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
    expect(() =>
      assertDisposableDbTarget("postgres://medusa:pass@localhost:5432/medusa")
    ).toThrow("Automated write/import operation attempted against primary database 'medusa'!");
  });

  it("should reject arbitrary non-disposable database names", () => {
    process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
    expect(() =>
      assertDisposableDbTarget("postgres://medusa:pass@localhost:5432/sai_production")
    ).toThrow("Target database 'sai_production' is not recognized as an isolated disposable test database");
  });

  it("should permit verified isolated disposable database", () => {
    process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
    expect(() =>
      assertDisposableDbTarget("postgres://medusa:pass@localhost:5432/medusa_restore_rehearsal_disposable")
    ).not.toThrow();
  });

  it("should permit verified test database ending in _test", () => {
    process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
    expect(() =>
      assertDisposableDbTarget("postgres://medusa:pass@localhost:5432/medusa_p6_import_test")
    ).not.toThrow();
  });

  describe("assertDisposableDbConnection (Runtime Query)", () => {
    it("should throw if ALLOW_DISPOSABLE_DB_WRITES is false", async () => {
      delete process.env.ALLOW_DISPOSABLE_DB_WRITES;
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [{ current_db: "medusa_restore_rehearsal_disposable" }] }) };
      await expect(assertDisposableDbConnection(mockClient)).rejects.toThrow("ALLOW_DISPOSABLE_DB_WRITES=true is required.");
    });

    it("should reject active connection to 'medusa'", async () => {
      process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [{ current_db: "medusa" }] }) };
      await expect(assertDisposableDbConnection(mockClient)).rejects.toThrow("connected to primary database 'medusa'!");
    });

    it("should reject connection without disposable marker", async () => {
      process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [{ current_db: "production_db" }] }) };
      await expect(assertDisposableDbConnection(mockClient)).rejects.toThrow("does not carry an isolated disposable marker");
    });

    it("should accept verified isolated disposable database session", async () => {
      process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
      const mockClient = { query: jest.fn().mockResolvedValue({ rows: [{ current_db: "medusa_restore_rehearsal_disposable" }] }) };
      const res = await assertDisposableDbConnection(mockClient);
      expect(res.currentDb).toBe("medusa_restore_rehearsal_disposable");
    });
  });
});
