/**
 * Isolated Disposable Database Write Guard (DEC-004 & Phase 06 Safety Gate)
 *
 * Enforces that test writes, data seeding, and test imports are strictly prohibited
 * against the primary/production database ("medusa") and can ONLY execute against
 * positively identified, isolated test databases (e.g. ending in "_disposable" or "_test").
 */

export function assertDisposableDbTarget(dbUrlOrName?: string): void {
  const allowWrites = process.env.ALLOW_DISPOSABLE_DB_WRITES;
  if (allowWrites !== "true") {
    throw new Error(
      "[DATA_SAFETY_GUARD] Write operations rejected: ALLOW_DISPOSABLE_DB_WRITES=true is required."
    );
  }

  const target = dbUrlOrName || process.env.DATABASE_URL || "";
  let dbName = target;

  if (target.includes("/")) {
    try {
      const parsed = new URL(target.startsWith("postgres") ? target : `postgres://${target}`);
      dbName = parsed.pathname.replace(/^\//, "").split("?")[0];
    } catch {
      const parts = target.split("/");
      dbName = parts[parts.length - 1].split("?")[0];
    }
  }

  if (!dbName) {
    throw new Error("[DATA_SAFETY_GUARD] Database target name could not be resolved.");
  }

  // Strictly forbid writing to the active "medusa" database in automated tests/seeds
  if (dbName.toLowerCase() === "medusa") {
    throw new Error(
      `[DATA_SAFETY_GUARD] FATAL: Automated write/import operation attempted against primary database '${dbName}'! ` +
        `Writes must target an isolated disposable database (e.g. 'medusa_restore_rehearsal_disposable' or ending in '_test'/'_disposable').`
    );
  }

  const isDisposable =
    dbName.endsWith("_disposable") ||
    dbName.endsWith("_test") ||
    dbName.includes("test") ||
    dbName.includes("disposable");

  if (!isDisposable) {
    throw new Error(
      `[DATA_SAFETY_GUARD] FATAL: Target database '${dbName}' is not recognized as an isolated disposable test database. ` +
        `Target name must include 'disposable' or 'test'.`
    );
  }
}

/**
 * Validates the runtime connection by actively querying the connected database.
 * Protects against proxy redirection, pooled connection misrouting, or URL rewriting.
 */
export async function assertDisposableDbConnection(client: {
  query: (sql: string) => Promise<{ rows: any[] }>;
}): Promise<{ currentDb: string }> {
  const allowWrites = process.env.ALLOW_DISPOSABLE_DB_WRITES;
  if (allowWrites !== "true") {
    throw new Error(
      "[DATA_SAFETY_GUARD] Active connection query rejected: ALLOW_DISPOSABLE_DB_WRITES=true is required."
    );
  }

  const res = await client.query("SELECT current_database() as current_db;");
  if (!res.rows || res.rows.length === 0 || !res.rows[0].current_db) {
    throw new Error("[DATA_SAFETY_GUARD] Could not determine active database from session query.");
  }

  const currentDb = String(res.rows[0].current_db).trim();

  if (currentDb.toLowerCase() === "medusa") {
    throw new Error(
      `[DATA_SAFETY_GUARD] FATAL: Active database session is connected to primary database '${currentDb}'! Aborting immediately.`
    );
  }

  const isDisposable =
    currentDb.endsWith("_disposable") ||
    currentDb.endsWith("_test") ||
    currentDb.includes("test") ||
    currentDb.includes("disposable");

  if (!isDisposable) {
    throw new Error(
      `[DATA_SAFETY_GUARD] FATAL: Active database session '${currentDb}' does not carry an isolated disposable marker ('_disposable' or '_test').`
    );
  }

  return { currentDb };
}

