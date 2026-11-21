import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";

let globalPool: Pool | null = null;

function ensureEnvLoaded() {
  if (!process.env.DATABASE_URL) {
    const candidates = [
      path.resolve(__dirname, "../../.env"),
      path.resolve(process.cwd(), "apps/backend/.env"),
      path.resolve(process.cwd(), ".env"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        dotenv.config({ path: c });
        break;
      }
    }
  }
}

export function getDatabaseUrl(): string {
  ensureEnvLoaded();
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USERNAME || "medusa";
  const pass = process.env.DB_PASSWORD || "";
  const dbName =
    process.env.DB_NAME ||
    process.env.DB_TEMP_NAME ||
    "medusa_restore_rehearsal_disposable";

  return `postgres://${user}:${pass}@${host}:${port}/${dbName}`;
}

export function getPgPool(connectionString?: string): Pool {
  if (!globalPool) {
    const url = connectionString || getDatabaseUrl();
    globalPool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return globalPool;
}

export async function closePgPool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}

export async function withTransaction<T>(
  poolOrClient: Pool | PoolClient,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
  const client: PoolClient = isPool
    ? await (poolOrClient as Pool).connect()
    : (poolOrClient as PoolClient);

  try {
    await client.query("BEGIN;");
    const result = await fn(client);
    await client.query("COMMIT;");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK;");
    } catch {
      // rollback error suppressed
    }
    throw error;
  } finally {
    if (isPool) {
      client.release();
    }
  }
}
