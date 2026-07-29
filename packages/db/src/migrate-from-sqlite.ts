/**
 * One-shot: copy all rows from local SQLite → Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm --filter @lankapulse/db migrate:from-sqlite
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";
import pg from "pg";
import { resolveDatabaseUrl } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const sqlitePath = path.join(root, "data/lankapulse.db");

if (!fs.existsSync(sqlitePath)) {
  console.error(`SQLite file not found: ${sqlitePath}`);
  process.exit(1);
}

const TABLES = [
  "sources",
  "series",
  "documents",
  "observations",
  "reviews",
  "user",
  "session",
  "account",
  "verification",
] as const;

const sqlite = new Database(sqlitePath, { readonly: true });
const client = new pg.Client({ connectionString: resolveDatabaseUrl() });
await client.connect();

async function copyTable(table: string) {
  const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
  if (!rows.length) {
    console.log(`  ${table}: 0 rows`);
    return 0;
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const onConflict = "ON CONFLICT (id) DO NOTHING";

  let inserted = 0;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((row, rowIdx) => {
      const base = rowIdx * cols.length;
      tuples.push(`(${cols.map((_, ci) => `$${base + ci + 1}`).join(", ")})`);
      for (const c of cols) {
        let v = row[c];
        // SQLite stores booleans as 0/1
        if (
          (c === "morning_brief" || c === "email_verified") &&
          (v === 0 || v === 1)
        ) {
          v = Boolean(v);
        }
        values.push(v);
      }
    });
    const sql = `INSERT INTO "${table}" (${colList}) VALUES ${tuples.join(", ")} ${onConflict}`;
    const res = await client.query(sql, values);
    inserted += res.rowCount ?? 0;
  }
  console.log(`  ${table}: ${rows.length} read, ${inserted} inserted`);
  return inserted;
}

console.log(`SQLite → Postgres`);
console.log(`  from: ${sqlitePath}`);
console.log(`  to:   ${resolveDatabaseUrl().replace(/:[^:@/]+@/, ":****@")}`);

// Truncate in reverse FK order for clean reload when --force
const force = process.argv.includes("--force");
if (force) {
  console.log("  --force: truncating Postgres tables…");
  await client.query(`
    TRUNCATE TABLE
      verification, account, session, "user",
      reviews, observations, documents, series, sources
    RESTART IDENTITY CASCADE
  `);
}

let total = 0;
for (const table of TABLES) {
  try {
    total += await copyTable(table);
  } catch (err) {
    console.error(`  FAIL ${table}:`, (err as Error).message);
    throw err;
  }
}

sqlite.close();
await client.end();
console.log(`Done. ${total} rows inserted.`);
