import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

const DEFAULT_URL = "postgresql://lankapulse:lankapulse@localhost:5432/lankapulse";

export function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || raw.startsWith("file:")) return DEFAULT_URL;
  return raw;
}

export function createPool(connectionString = resolveDatabaseUrl()) {
  return new Pool({ connectionString });
}

export function createDb(connectionString = resolveDatabaseUrl()) {
  const pool = createPool(connectionString);
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
