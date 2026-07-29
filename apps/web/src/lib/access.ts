export type AccessTier = "anonymous" | "free" | "pro";

/** Minimal session shape — keep client-safe (no server auth import). */
export type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    subscriptionStatus?: string | null;
  } | null;
} | null;

export function getAccessTier(
  session: SessionLike,
  opts?: { demoPro?: boolean },
): AccessTier {
  if (opts?.demoPro) return "pro";
  if (!session?.user) return "anonymous";
  const status = String(session.user.subscriptionStatus ?? "free").toLowerCase();
  if (status === "pro" || status === "active" || status === "trialing") return "pro";
  return "free";
}

/** Mid / Drivers — unlocked for any registered account (phase 1). */
export function canViewDrivers(tier: AccessTier): boolean {
  return tier !== "anonymous";
}

/**
 * Rare / Analysis — unlocked for registered users while the site is free.
 * Flip to `return tier === "pro"` when subscriptions go live.
 */
export function canViewAnalysis(tier: AccessTier): boolean {
  return tier !== "anonymous";
}

/** Longer history (5Y / MAX) for registered users during the free period. */
export function canUseFullHistory(tier: AccessTier): boolean {
  return tier !== "anonymous";
}
