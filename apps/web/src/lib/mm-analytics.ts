/** Money-market analytics: alignment, spreads, pass-through, event studies. */

export type Point = { period: string; value: number };
export type AlignedRow = { period: string; values: Record<string, number | null> };

export function sortPoints(points: Point[]): Point[] {
  return [...points].sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Fix one-day “blip” prints that jump away from both neighbours then snap back
 * (common SDF/SLF scrape glitches). Real policy steps stay put for days.
 */
export function despikeIsolated(
  points: Point[],
  opts?: { minJump?: number; neighborTol?: number },
): Point[] {
  const minJump = opts?.minJump ?? 0.2;
  const neighborTol = opts?.neighborTol ?? 0.05;
  const sorted = sortPoints(points);
  if (sorted.length < 3) return sorted;

  return sorted.map((p, i) => {
    if (i === 0 || i === sorted.length - 1) return p;
    const prev = sorted[i - 1].value;
    const next = sorted[i + 1].value;
    const v = p.value;
    const neighborsClose = Math.abs(prev - next) <= neighborTol;
    const isolated =
      neighborsClose && Math.abs(v - prev) >= minJump && Math.abs(v - next) >= minJump;
    if (!isolated) return p;
    return { ...p, value: (prev + next) / 2 };
  });
}

export function toMap(points: Point[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.period, p.value);
  return m;
}

/** Step-carry an event series onto a daily calendar of periods. */
export function carryOnto(calendar: string[], eventPoints: Point[]): Point[] {
  if (!calendar.length || !eventPoints.length) return [];
  const sorted = sortPoints(eventPoints);
  let i = 0;
  let last: number | null = null;
  const out: Point[] = [];
  for (const period of calendar) {
    while (i < sorted.length && sorted[i].period <= period) {
      last = sorted[i].value;
      i += 1;
    }
    if (last != null) out.push({ period, value: last });
  }
  return out;
}

/** Inner-join multiple series on shared periods (exact date match). */
export function alignExact(
  series: Record<string, Point[]>,
  keys = Object.keys(series),
): AlignedRow[] {
  if (!keys.length) return [];
  const maps = keys.map((k) => toMap(series[k] ?? []));
  const periods = [...maps[0].keys()].sort();
  const rows: AlignedRow[] = [];
  for (const period of periods) {
    const values: Record<string, number | null> = {};
    let ok = true;
    for (let i = 0; i < keys.length; i++) {
      const v = maps[i].get(period);
      if (v == null) {
        ok = false;
        break;
      }
      values[keys[i]] = v;
    }
    if (ok) rows.push({ period, values });
  }
  return rows;
}

/**
 * Align onto a primary calendar. Missing values from secondary series are
 * forward-filled when `carryKeys` includes that key (policy/event rates).
 */
export function alignToCalendar(
  calendar: Point[],
  series: Record<string, Point[]>,
  carryKeys: string[] = [],
): AlignedRow[] {
  const carry = new Set(carryKeys);
  const maps = new Map<string, Map<string, number>>();
  const last = new Map<string, number | null>();
  for (const [k, pts] of Object.entries(series)) {
    maps.set(k, toMap(pts));
    last.set(k, null);
  }
  // Pre-seed carry from values before calendar start
  if (calendar.length) {
    const start = calendar[0].period;
    for (const k of carry) {
      const pts = sortPoints(series[k] ?? []);
      let v: number | null = null;
      for (const p of pts) {
        if (p.period <= start) v = p.value;
        else break;
      }
      last.set(k, v);
    }
  }

  return calendar.map((c) => {
    const values: Record<string, number | null> = {};
    for (const [k, m] of maps) {
      const hit = m.get(c.period);
      if (hit != null) {
        last.set(k, hit);
        values[k] = hit;
      } else if (carry.has(k)) {
        values[k] = last.get(k) ?? null;
      } else {
        values[k] = null;
      }
    }
    return { period: c.period, values };
  });
}

export function spread(
  a: Point[],
  b: Point[],
  opts?: { carryB?: boolean; calendar?: Point[] },
): Point[] {
  const cal = opts?.calendar ?? (a.length >= b.length ? a : b);
  const rows = alignToCalendar(
    cal,
    { a, b },
    opts?.carryB ? ["b"] : [],
  );
  return rows
    .filter((r) => r.values.a != null && r.values.b != null)
    .map((r) => ({
      period: r.period,
      value: (r.values.a as number) - (r.values.b as number),
    }));
}

export function ratio(num: Point[], den: Point[]): Point[] {
  const rows = alignExact({ num, den });
  return rows
    .filter((r) => r.values.den != null && (r.values.den as number) !== 0)
    .map((r) => ({
      period: r.period,
      value: (r.values.num as number) / (r.values.den as number),
    }));
}

export function diffs(points: Point[]): Point[] {
  const sorted = sortPoints(points);
  const out: Point[] = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push({
      period: sorted[i].period,
      value: sorted[i].value - sorted[i - 1].value,
    });
  }
  return out;
}

export function monthOnMonth(points: Point[]): Point[] {
  const sorted = sortPoints(points);
  const byMonth = new Map<string, Point>();
  for (const p of sorted) {
    byMonth.set(p.period.slice(0, 7), p);
  }
  const months = [...byMonth.keys()].sort();
  const out: Point[] = [];
  for (let i = 1; i < months.length; i++) {
    const cur = byMonth.get(months[i])!;
    const prev = byMonth.get(months[i - 1])!;
    out.push({ period: cur.period, value: cur.value - prev.value });
  }
  return out;
}

/** Index series to 100 at the first period on/after `basePeriod`. */
export function indexToBase(points: Point[], basePeriod: string): Point[] {
  const sorted = sortPoints(points).filter((p) => p.period >= basePeriod);
  if (!sorted.length) return [];
  const base = sorted[0].value;
  if (base === 0) return sorted.map((p) => ({ period: p.period, value: 100 }));
  return sorted.map((p) => ({
    period: p.period,
    value: (p.value / base) * 100,
  }));
}

/** Ordinary least-squares slope of y on x (no intercept demeaning — demeaned). */
export function olsBeta(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

/** Rolling OLS beta of Δy on Δx. */
export function rollingBeta(
  x: Point[],
  y: Point[],
  window: number,
): Point[] {
  const rows = alignExact({ x: diffs(x), y: diffs(y) });
  if (rows.length < window) return [];
  const out: Point[] = [];
  for (let i = window - 1; i < rows.length; i++) {
    const slice = rows.slice(i - window + 1, i + 1);
    const beta = olsBeta(
      slice.map((r) => r.values.x as number),
      slice.map((r) => r.values.y as number),
    );
    if (beta != null) out.push({ period: rows[i].period, value: beta });
  }
  return out;
}

/** Cross-correlation of Δy vs Δx at lags 0..maxLag (y leads if lag>0 means x_{t-lag}). */
export function crossCorrelation(
  x: Point[],
  y: Point[],
  maxLag: number,
): { lag: number; corr: number }[] {
  const rows = alignExact({ x: diffs(x), y: diffs(y) });
  if (rows.length < maxLag + 5) return [];
  const xs = rows.map((r) => r.values.x as number);
  const ys = rows.map((r) => r.values.y as number);
  const out: { lag: number; corr: number }[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    const a: number[] = [];
    const b: number[] = [];
    for (let i = lag; i < xs.length; i++) {
      a.push(xs[i - lag]);
      b.push(ys[i]);
    }
    const c = pearson(a, b);
    if (c != null) out.push({ lag, corr: c });
  }
  return out;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

export function correlationMatrix(
  series: Record<string, Point[]>,
): { keys: string[]; matrix: (number | null)[][] } {
  const keys = Object.keys(series);
  const diffed: Record<string, Point[]> = {};
  for (const k of keys) diffed[k] = diffs(series[k]);
  const matrix: (number | null)[][] = keys.map(() => keys.map(() => null));
  for (let i = 0; i < keys.length; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < keys.length; j++) {
      const rows = alignExact({
        a: diffed[keys[i]],
        b: diffed[keys[j]],
      });
      const c = pearson(
        rows.map((r) => r.values.a as number),
        rows.map((r) => r.values.b as number),
      );
      matrix[i][j] = c;
      matrix[j][i] = c;
    }
  }
  return { keys, matrix };
}

export type PolicyEvent = { period: string; from: number; to: number; delta: number };

export function policyChangeDates(opr: Point[], minAbsDelta = 0.01): PolicyEvent[] {
  const sorted = sortPoints(opr);
  const events: PolicyEvent[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].value - sorted[i - 1].value;
    if (Math.abs(delta) >= minAbsDelta) {
      events.push({
        period: sorted[i].period,
        from: sorted[i - 1].value,
        to: sorted[i].value,
        delta,
      });
    }
  }
  return events;
}

/**
 * Average path of a series around policy events, relative to t=0 level.
 * Returns offsets from -window to +window with mean relative change (pp).
 */
export function eventStudy(
  series: Point[],
  events: PolicyEvent[],
  window = 60,
): { offset: number; mean: number; n: number }[] {
  const map = toMap(series);
  const periods = [...map.keys()].sort();
  const idx = new Map(periods.map((p, i) => [p, i]));
  const buckets = new Map<number, number[]>();

  for (const ev of events) {
    const i0 = idx.get(ev.period);
    if (i0 == null) continue;
    const base = map.get(ev.period);
    if (base == null) continue;
    for (let off = -window; off <= window; off++) {
      const i = i0 + off;
      if (i < 0 || i >= periods.length) continue;
      const v = map.get(periods[i]);
      if (v == null) continue;
      const arr = buckets.get(off) ?? [];
      arr.push(v - base);
      buckets.set(off, arr);
    }
  }

  const out: { offset: number; mean: number; n: number }[] = [];
  for (let off = -window; off <= window; off++) {
    const arr = buckets.get(off);
    if (!arr?.length) continue;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    out.push({ offset: off, mean, n: arr.length });
  }
  return out;
}

/** Detect corridor collapse (SDF ≈ SLF ≈ OPR) — Nov-2024 single-OPR regime. */
export function detectCorridorCollapse(
  sdf: Point[],
  slf: Point[],
  opr: Point[],
  tol = 0.05,
): string | null {
  const rows = alignToCalendar(sdf, { sdf, slf, opr }, ["opr"]);
  for (const r of rows) {
    const a = r.values.sdf;
    const b = r.values.slf;
    const c = r.values.opr;
    if (a == null || b == null || c == null) continue;
    if (Math.abs(a - b) <= tol && Math.abs(a - c) <= tol) return r.period;
  }
  return null;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function filterRange(
  points: Point[],
  range: "1Y" | "5Y" | "MAX",
): Point[] {
  if (!points.length || range === "MAX") return sortPoints(points);
  const sorted = sortPoints(points);
  const to = sorted[sorted.length - 1].period;
  const years = range === "5Y" ? 5 : 1;
  const from = addDaysIso(to, -Math.round(years * 365.25));
  return sorted.filter((p) => p.period >= from);
}

export function latestValue(points: Point[]): number | null {
  if (!points.length) return null;
  return sortPoints(points)[points.length - 1]?.value ?? null;
}

export function changeOver(
  points: Point[],
  daysApprox: number,
): number | null {
  const sorted = sortPoints(points);
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  const target = addDaysIso(last.period, -daysApprox);
  let prev = sorted[0];
  for (const p of sorted) {
    if (p.period <= target) prev = p;
    else break;
  }
  return last.value - prev.value;
}

/** Box-plot stats for values grouped by regime label. */
export function boxStats(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
} | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    if (lo === hi) return s[lo];
    return s[lo] * (hi - i) + s[hi] * (i - lo);
  };
  return {
    min: s[0],
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
    max: s[s.length - 1],
    n: s.length,
  };
}

export function yyyymmddToIso(n: number): string | null {
  const s = String(Math.round(n));
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
