import Link from "next/link";
import type { SeriesLatest } from "@/lib/api";
import { formatUtcStamp } from "@/lib/format";

function Sparkline({ values, id }: { values: number[]; id: string }) {
  const pts = values.slice(-20);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const rising = pts[pts.length - 1] >= pts[0];
  const gradId = `spark-${id.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="spark" aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={rising ? "var(--up)" : "var(--down)"}
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor={rising ? "var(--up)" : "var(--down)"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={path}
          fill="none"
          stroke={rising ? "var(--up)" : "var(--down)"}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function MeetingCard({
  item,
  index = 0,
}: {
  item: SeriesLatest;
  index?: number;
}) {
  const change = item.change;
  const up = change != null && change > 0;
  const down = change != null && change < 0;

  return (
    <Link
      href={`/series/${encodeURIComponent(item.seriesId)}`}
      className="meeting-card"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="label">{item.shortTitle}</div>
      <div className="value">
        {item.value != null ? item.value.toFixed(2) : "—"}
        <span className="unit">{item.unit}</span>
      </div>
      <div className="meta">
        <span className={up ? "delta up" : down ? "delta down" : "delta"}>
          {change == null ? "flat" : `${change > 0 ? "+" : ""}${change.toFixed(2)}`}
        </span>
        <span>{item.asOf ?? "—"}</span>
      </div>
      {item.lastUpdated ? (
        <div className="meta" style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--muted)" }}>
          Updated {formatUtcStamp(item.lastUpdated)}
        </div>
      ) : null}
      <Sparkline values={item.sparkline} id={item.seriesId} />
    </Link>
  );
}
