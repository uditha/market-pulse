/**
 * Remove MEI-sourced Official Reserve observations.
 * ORA is WEI §4.3 only.
 *
 *   pnpm --filter @lankapulse/db exec tsx scripts/purge-mei-reserves.ts
 */
import { createDb, resolveDatabaseUrl } from "../src/client.js";
import { sql } from "drizzle-orm";

async function main() {
  process.env.DATABASE_URL = resolveDatabaseUrl();
  const db = createDb();

  const before = await db.execute(sql`
    SELECT period, value, status, source_url
    FROM observations
    WHERE series_id = 'sl.ei.total_reserves'
      AND (
        source_url ILIKE '%mei%'
        OR source_url ILIKE '%monthly-economic%'
        OR source_url ILIKE '%/MEI_%'
      )
    ORDER BY period
  `);
  console.log("MEI-sourced ORA rows:", before.rows ?? before);

  await db.execute(sql`
    DELETE FROM reviews
    WHERE observation_id IN (
      SELECT id FROM observations
      WHERE series_id = 'sl.ei.total_reserves'
        AND (
          source_url ILIKE '%mei%'
          OR source_url ILIKE '%monthly-economic%'
          OR source_url ILIKE '%/MEI_%'
          OR value > 10000
        )
    )
  `);

  const deleted = await db.execute(sql`
    DELETE FROM observations
    WHERE series_id = 'sl.ei.total_reserves'
      AND (
        source_url ILIKE '%mei%'
        OR source_url ILIKE '%monthly-economic%'
        OR source_url ILIKE '%/MEI_%'
      )
    RETURNING period, value, source_url
  `);
  console.log("DELETED MEI-sourced:", deleted.rows ?? deleted);

  const high = await db.execute(sql`
    DELETE FROM observations
    WHERE series_id = 'sl.ei.total_reserves'
      AND value > 10000
    RETURNING period, value, source_url
  `);
  console.log("DELETED high (>10bn):", high.rows ?? high);

  const left = await db.execute(sql`
    SELECT period, value, status, source_url
    FROM observations
    WHERE series_id = 'sl.ei.total_reserves'
      AND status = 'approved'
    ORDER BY period DESC
    LIMIT 8
  `);
  console.log("Latest approved ORA:", left.rows ?? left);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
