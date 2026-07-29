import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NEWS_SOURCES } from "@lankapulse/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const extractorDir = path.join(repoRoot, "services/extractors");

export type NewsScrapeStatus = {
  running: boolean;
  sources: { id: string; name: string; kind: string; enabled: boolean }[];
  lastRun: {
    ok: boolean;
    dryRun: boolean;
    slot: string;
    startedAt: string;
    finishedAt: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    summary: unknown;
  } | null;
  extractorReady: boolean;
  live: {
    message: string;
    startedAt: string;
    slot: string;
    dryRun: boolean;
    log: string;
  } | null;
};

let lastRun: NewsScrapeStatus["lastRun"] = null;
let running = false;
let liveState: NewsScrapeStatus["live"] = null;

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

function parseSummary(stdout: string): unknown {
  const start = stdout.indexOf("---SUMMARY_JSON---");
  const end = stdout.indexOf("---END_SUMMARY---");
  if (start < 0 || end < 0 || end <= start) return null;
  const raw = stdout.slice(start + "---SUMMARY_JSON---".length, end).trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolvePython(): string {
  const venvPy = path.join(extractorDir, ".venv/bin/python");
  if (fs.existsSync(venvPy)) return venvPy;
  return "python3";
}

export function getNewsScrapeStatus(): NewsScrapeStatus {
  return {
    running,
    sources: NEWS_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      enabled: s.enabled,
    })),
    lastRun,
    extractorReady: fs.existsSync(path.join(extractorDir, ".venv/bin/python")),
    live: liveState,
  };
}

export async function startNewsScrape(opts: {
  dryRun?: boolean;
  sources?: string[];
}): Promise<NewsScrapeStatus> {
  if (running) {
    throw new Error("A news scrape is already running");
  }
  const newsPkg = path.join(extractorDir, "news", "pipeline.py");
  if (!fs.existsSync(newsPkg)) {
    throw new Error(`News extractor not found at ${newsPkg}`);
  }

  void runNewsScrape(opts).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (liveState) {
      liveState.message = `News scrape failed: ${msg}`;
      appendLiveLog(`\nERROR: ${msg}\n`);
    }
    running = false;
  });

  await new Promise((r) => setTimeout(r, 20));
  return getNewsScrapeStatus();
}

async function runNewsScrape(opts: {
  dryRun?: boolean;
  sources?: string[];
}) {
  if (running) {
    throw new Error("A news scrape is already running");
  }

  const python = resolvePython();
  running = true;
  const startedAt = new Date().toISOString();
  const slot = "latest";
  liveState = {
    message: `Starting news scrape${opts.dryRun ? " [dry-run]" : ""}`,
    startedAt,
    slot,
    dryRun: !!opts.dryRun,
    log: "",
  };
  appendLiveLog(`${liveState.message}\n`);

  const args = ["-m", "news"];
  if (opts.dryRun) args.push("--dry-run");
  if (opts.sources?.length) {
    args.push("--sources", opts.sources.join(","));
  }

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
          API_URL:
            process.env.API_URL ||
            `http://127.0.0.1:${process.env.PORT ?? 4000}`,
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
    lastRun = {
      ok: exitCode === 0,
      dryRun: !!opts.dryRun,
      slot,
      startedAt,
      finishedAt,
      exitCode,
      stdout: stdout.slice(-12000),
      stderr: stderr.slice(-4000),
      summary,
    };
    if (liveState) {
      liveState.message = lastRun.ok
        ? "News scrape finished OK"
        : `News scrape finished with errors (exit ${exitCode ?? "?"})`;
      appendLiveLog(`\n${liveState.message}\n`);
    }
    return lastRun;
  } finally {
    running = false;
  }
}
