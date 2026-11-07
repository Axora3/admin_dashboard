// Server configuration. Never import this from a client component that would
// bundle secrets — only NEXT_PUBLIC_* values are safe for the browser.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export const ADMIN_HOST = (
  process.env.ADMIN_HOST?.trim() || "admin.axora.mn"
).toLowerCase();
export const PLATFORM_BASE_DOMAIN = (
  process.env.PLATFORM_BASE_DOMAIN?.trim() || "axora.mn"
).toLowerCase();

// Google Sheets service account. Server-only.
export const GOOGLE_SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
export const GOOGLE_PRIVATE_KEY =
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";
export const GOOGLE_SERVICE_ACCOUNT_JSON =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ?? "";

export const LOCAL_ADMIN_EMAIL =
  process.env.LOCAL_ADMIN_EMAIL?.trim() ||
  process.env.DEMO_ADMIN_EMAIL?.trim() ||
  "admin@axora.mn";
export const LOCAL_ADMIN_PASSWORD =
  process.env.LOCAL_ADMIN_PASSWORD ||
  process.env.DEMO_ADMIN_PASSWORD ||
  "AxoraDemo!2026";

// Legacy aliases kept so existing imports keep working during the migration.
export const DEMO_ADMIN_EMAIL = LOCAL_ADMIN_EMAIL;
export const DEMO_ADMIN_PASSWORD = LOCAL_ADMIN_PASSWORD;

export const LOCAL_ADMIN_COOKIE = "axora_admin_session";
export const DEMO_COOKIE = LOCAL_ADMIN_COOKIE;
export const LOCAL_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
export const DEMO_SESSION_TTL_SECONDS = LOCAL_SESSION_TTL_SECONDS;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** True when Google service-account credentials are present. */
export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    GOOGLE_SERVICE_ACCOUNT_JSON ||
      (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY),
  );
}

/**
 * Google Sheets is the primary store data source. `local` is a file-backed
 * emulator for development only; it is always labelled in the UI.
 */
export function sheetsMode(): "google" | "local" {
  const flag = (process.env.AXORA_SHEETS_MODE ?? "auto").toLowerCase();
  if (flag === "local") return "local";
  if (flag === "google") return "google";
  return isGoogleSheetsConfigured() ? "google" : "local";
}

/** Local admin auth is used only when Supabase Auth is not configured. */
export function isLocalAuthMode(): boolean {
  const flag = (process.env.AXORA_AUTH_MODE ?? "auto").toLowerCase();
  if (flag === "local") return true;
  if (flag === "supabase") return false;
  return !isSupabaseConfigured();
}

/** @deprecated Use isLocalAuthMode(). */
export function isDemoMode(): boolean {
  return isLocalAuthMode();
}

export function authSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    "axora-local-development-secret-do-not-use-in-production-32chars"
  );
}

export function isLocalHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}
