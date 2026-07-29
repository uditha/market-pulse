export type StaffRole = "user" | "ops" | "scraper" | "admin";

export type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
} | null;

const STAFF_ROLES = new Set<string>(["ops", "scraper", "admin"]);

export function getStaffRole(session: SessionLike): StaffRole {
  const raw = String(session?.user?.role ?? "user").toLowerCase();
  if (raw === "ops" || raw === "scraper" || raw === "admin") return raw;
  return "user";
}

export function isStaff(role: StaffRole): boolean {
  return STAFF_ROLES.has(role);
}

/** Verification queue — ops + admin */
export function canAccessOps(role: StaffRole): boolean {
  return role === "ops" || role === "admin";
}

/** Scraper controls — scraper + admin */
export function canAccessAdmin(role: StaffRole): boolean {
  return role === "scraper" || role === "admin";
}
