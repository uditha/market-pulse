import { createDb, schema, resolveDatabaseUrl } from "./client.js";
import {
  CBSL_SOURCES,
  LOCKED_REPORT_IDS,
  NEWS_SOURCES,
  SERIES_CATALOG,
} from "@lankapulse/shared";
import { sql } from "drizzle-orm";

function iso(d: Date) {
  return d.toISOString();
}

async function main() {
  process.env.DATABASE_URL = resolveDatabaseUrl();
  const db = createDb();
  const now = iso(new Date());

  for (const [key, src] of Object.entries(CBSL_SOURCES)) {
    await db
      .insert(schema.sources)
      .values({
        id: key,
        title: src.title,
        reportId: src.reportId,
        url: src.url,
        page: src.page,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  for (const s of SERIES_CATALOG) {
    await db
      .insert(schema.series)
      .values({
        id: s.id,
        title: s.title,
        shortTitle: s.shortTitle,
        market: s.market,
        unit: s.unit,
        frequency: s.frequency,
        aliasesJson: JSON.stringify(s.aliases),
        sourceUrl: s.sourceUrl,
        sourceReportId: s.sourceReportId,
        description: s.description,
        morningBrief: Boolean(s.morningBrief),
      })
      .onConflictDoUpdate({
        target: schema.series.id,
        set: {
          title: s.title,
          shortTitle: s.shortTitle,
          aliasesJson: JSON.stringify(s.aliases),
          description: s.description,
          morningBrief: Boolean(s.morningBrief),
          sourceUrl: s.sourceUrl,
          sourceReportId: s.sourceReportId,
          unit: s.unit,
          frequency: s.frequency,
          market: s.market,
        },
      });
  }

  for (const n of NEWS_SOURCES) {
    await db
      .insert(schema.newsSources)
      .values({
        id: n.id,
        name: n.name,
        homepageUrl: n.homepageUrl,
        faviconUrl: n.faviconUrl,
        kind: n.kind,
        feedUrl: n.feedUrl,
        enabled: n.enabled,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: schema.newsSources.id,
        set: {
          name: n.name,
          homepageUrl: n.homepageUrl,
          faviconUrl: n.faviconUrl,
          kind: n.kind,
          feedUrl: n.feedUrl,
          enabled: n.enabled,
        },
      });
  }

  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.observations);
  const existingCount = Number(existing[0]?.count ?? 0);

  console.log(`Seeded Postgres catalog (${SERIES_CATALOG.length} series).`);
  console.log(`Seeded news sources (${NEWS_SOURCES.length}).`);
  console.log(`Observations untouched (${existingCount} rows).`);
  console.log(`Locked reports: ${LOCKED_REPORT_IDS.join(", ")}`);
  console.log(`DATABASE_URL=${resolveDatabaseUrl().replace(/:[^:@/]+@/, ":****@")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
