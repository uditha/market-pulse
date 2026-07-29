import { OpsQueue } from "./OpsQueue";

export const dynamic = "force-dynamic";

export default function OpsPage() {
  return (
    <main>
      <h1 className="section-title" style={{ fontSize: "2rem" }}>
        Verification queue
      </h1>
      <p style={{ color: "var(--muted)" }}>
        Check each CBSL report for the day (8/8 Money Market Summary, etc.), then approve the day
        — or use the detail list for corrections.
      </p>
      <OpsQueue />
    </main>
  );
}
