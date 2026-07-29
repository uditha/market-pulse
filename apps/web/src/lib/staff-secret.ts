export const STAFF_SECRET_KEY = "marketpulse_admin_secret";

/** Prefill only in local/dev — never ship a default in production builds. */
export function defaultStaffSecret(): string {
  return process.env.NODE_ENV === "production" ? "" : "dev-admin";
}

export function readStaffSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STAFF_SECRET_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStaffSecret(secret: string) {
  if (typeof window === "undefined") return;
  try {
    if (secret) window.sessionStorage.setItem(STAFF_SECRET_KEY, secret);
    else window.sessionStorage.removeItem(STAFF_SECRET_KEY);
  } catch {
    /* ignore */
  }
}
