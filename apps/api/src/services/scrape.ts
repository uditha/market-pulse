import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLockedReport } from "@lankapulse/shared";
import { getPendingReviews } from "./series.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const extractorDir = path.join(repoRoot, "services/extractors");
const rawDir = path.join(extractorDir, "data/raw");

export const SCRAPE_SOURCES = [
  {
    id: "5206",
    title: "Money Market Summary (Call / Repo)",
    production: true,
    locked: true,
  },
  {
    id: "1059",
    title: "Daily Operations (SDF / SLF / Liquidity)",
    production: true,
    locked: true,
  },
  {
    id: "6169",
    title: "Government Securities (T-bills)",
    production: false,
    locked: false,
  },
  {
    id: "1064",
    title: "OMO Term Repo / Reverse Repo",
    production: true,
    locked: true,
  },
  {
    id: "6277",
    title: "Bank Lending & Deposit Rates (AWPR / AWLR / AWDR)",
    production: true,
    locked: false,
  },
  {
    id: "policy-rates",
    title: "Policy Rates (OPR / SRR)",
    production: true,
    locked: false,
  },
  {
    id: "consumer-price-inflation",
    title: "Consumer Price Inflation (CCPI / NCPI)",
    production: false,
    locked: false,
  },
  {
    id: "daily-economic-indicators",
    title: "Daily Economic Indicators (FX / Equities / Energy)",
    production: true,
    locked: false,
  },
  {
    id: "weekly-economic-indicators",
    title: "Weekly Economic Indicators (PDF)",
    production: true,
    locked: false,
  },
  {
    id: "monthly-economic-indicators",
    title: "Monthly Economic Indicators (PDF)",
    production: true,
    locked: false,
  },
] as const;


export type ReportRunResult = {
  reportId: string;
  title?: string;
  ok: boolean;
  error?: string;
  observations?: number;
  seriesIds?: string[];
  rawPath?: string;
  contentHash?: string;
  ingest?: unknown;
};

export type ScrapeRunResult = {
  ok: boolean;
  dryRun: boolean;
  force: boolean;
  reports: string[];
  days: number;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  pendingAfter: number;
  summary: {
    ok: boolean;
    totalObservations: number;
    reports: ReportRunResult[];
  } | null;
};

let lastRun: ScrapeRunResult | null = null;
let running = false;
/** Live scrape progress (visible via /admin/scrape/status while a job runs). */
let liveState: {
  message: string;
  startedAt: string;
  reports: string[];
  days: number;
  dryRun: boolean;
  force: boolean;
  log: string;
} | null = null;

const LIVE_LOG_MAX = 24_000;

function appendLiveLog(chunk: string) {
  if (!liveState) return;
  liveState.log = (liveState.log + chunk).slice(-LIVE_LOG_MAX);
  const lines = chunk
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1];
  if (last && !last.startsWith("---")) {
    liveState.message = last.slice(0, 240);
  }
}

function parseSummary(stdout: string): ScrapeRunResult["summary"] {
  const start = stdout.indexOf("---SUMMARY_JSON---");
  const end = stdout.indexOf("---END_SUMMARY---");
  if (start < 0 || end < 0 || end <= start) return null;
  const raw = stdout.slice(start + "---SUMMARY_JSON---".length, end).trim();
  try {
    const parsed = JSON.parse(raw) as {
      ok: boolean;
      totalObservations: number;
      reports: ReportRunResult[];
    };
    return {
      ok: parsed.ok,
      totalObservations: parsed.totalObservations,
      reports: parsed.reports ?? [],
    };
  } catch {
    return null;
  }
}

export async function getScrapeStatus() {
  const rawFiles = fs.existsSync(rawDir)
    ? fs
        .readdirSync(rawDir)
        .filter((f) => f.endsWith(".html") || f.endsWith(".pdf"))
        .map((name) => {
          const full = path.join(rawDir, name);
          const st = fs.statSync(full);
          return {
            name,
            bytes: st.size,
            modifiedAt: st.mtime.toISOString(),
          };
        })
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 12)
    : [];

  const pending = await getPendingReviews();
  return {
    running,
    sources: SCRAPE_SOURCES,
    pendingCount: pending.length,
    lastRun,
    rawFiles,
    extractorReady: fs.existsSync(path.join(extractorDir, ".venv/bin/python")),
    extractorDir,
    live: liveState
      ? {
          message: liveState.message,
          startedAt: liveState.startedAt,
          reports: liveState.reports,
          days: liveState.days,
          dryRun: liveState.dryRun,
          force: liveState.force,
          log: liveState.log,
        }
      : null,
  };
}

function resolvePython(): string {
  const venvPy = path.join(extractorDir, ".venv/bin/python");
  if (fs.existsSync(venvPy)) return venvPy;
  return "python3";
}

/** Kick off a scrape in the background; poll getScrapeStatus() for live logs. */
export async function startScrape(opts: {
  reports: string[];
  days: number;
  dryRun: boolean;
  force?: boolean;
  unlock?: boolean;
}): Promise<Awaited<ReturnType<typeof getScrapeStatus>>> {
  if (running) {
    throw new Error("A scrape is already running");
  }
  // Validate paths / unlock before returning so the client gets immediate errors.
  const python = resolvePython();
  const mainPy = path.join(extractorDir, "main.py");
  if (!fs.existsSync(mainPy)) {
    throw new Error(`Extractor not found at ${mainPy}`);
  }
  const needsUnlock =
    !!opts.force && opts.reports.some((r) => isLockedReport(r));
  if (needsUnlock && !opts.unlock) {
    throw new Error(
      "Force re-ingest of locked reports (5206, 1059, 1064) requires unlock=true",
    );
  }

  void runScrape(opts).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (liveState) {
      liveState.message = `Scrape failed: ${msg}`;
      appendLiveLog(`\nERROR: ${msg}\n`);
    }
    running = false;
  });

  // Tiny yield so runScrape can flip `running` / seed liveState before we reply.
  await new Promise((r) => setTimeout(r, 20));
  return getScrapeStatus();
}

export async function runScrape(opts: {
  reports: string[];
  days: number;
  dryRun: boolean;
  force?: boolean;
  unlock?: boolean;
}): Promise<ScrapeRunResult> {
  if (running) {
    throw new Error("A scrape is already running");
  }

  const python = resolvePython();
  const mainPy = path.join(extractorDir, "main.py");
  if (!fs.existsSync(mainPy)) {
    throw new Error(`Extractor not found at ${mainPy}`);
  }

  const needsUnlock =
    !!opts.force && opts.reports.some((r) => isLockedReport(r));
  if (needsUnlock && !opts.unlock) {
    throw new Error(
      "Force re-ingest of locked reports (5206, 1059, 1064) requires unlock=true",
    );
  }

  running = true;
  const startedAt = new Date().toISOString();
  liveState = {
    message: `Starting scrape: ${opts.reports.join(", ")} (${opts.days}d)${
      opts.dryRun ? " [dry-run]" : ""
    }${opts.force ? " [force]" : ""}`,
    startedAt,
    reports: opts.reports,
    days: opts.days,
    dryRun: opts.dryRun,
    force: !!opts.force,
    log: "",
  };
  appendLiveLog(`${liveState.message}\n`);

  const args = [
    mainPy,
    "--reports",
    opts.reports.join(","),
    "--days",
    String(opts.days),
  ];
  if (opts.dryRun) args.push("--dry-run");
  if (opts.force) args.push("--force");
  if (opts.unlock) args.push("--unlock");

  try {
    const { stdout, stderr, exitCode } = await new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
    }>((resolve, reject) => {
      const child = spawn(python, args, {
        cwd: extractorDir,
        env: {
          ...process.env,
          API_URL: process.env.API_URL ?? "http://127.0.0.1:4000",
          // Line-buffer scraper prints so Admin can stream progress.
          PYTHONUNBUFFERED: "1",
        },
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (buf) => {
        const text = String(buf);
        stdout += text;
        appendLiveLog(text);
      });
      child.stderr.on("data", (buf) => {
        const text = String(buf);
        stderr += text;
        appendLiveLog(text.startsWith("\n") ? text : `\n${text}`);
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ stdout, stderr, exitCode: code }));
    });

    const finishedAt = new Date().toISOString();
    const summary = parseSummary(stdout);
    const pending = await getPendingReviews();
    lastRun = {
      ok: exitCode === 0 && (summary?.ok ?? true),
      dryRun: opts.dryRun,
      force: !!opts.force,
      reports: opts.reports,
      days: opts.days,
      startedAt,
      finishedAt,
      exitCode,
      stdout: stdout.slice(-12000),
      stderr: stderr.slice(-4000),
      pendingAfter: pending.length,
      summary,
    };
    if (liveState) {
      liveState.message = lastRun.ok
        ? `Finished OK — ${summary?.totalObservations ?? 0} observations, ${pending.length} pending`
        : `Finished with errors (exit ${exitCode ?? "?"})`;
      appendLiveLog(`\n${liveState.message}\n`);
    }
    return lastRun;
  } finally {
    running = false;
    // Keep last live snapshot briefly readable until next run overwrites it.
    if (liveState) {
      liveState = { ...liveState, message: liveState.message };
    }
  }
}
