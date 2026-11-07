import { effectiveStatus, type Subscription } from "./subscription-rules";

export const HEALTH_STATUSES = ["healthy", "warning", "error", "disconnected", "unknown"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** A health result older than this is treated as stale (warning), never healthy. */
export const HEALTH_STALE_MS = 30 * 60_000;

export interface HealthEvent {
  id?: string;
  store_id: string | null;
  component: string;
  status: HealthStatus;
  code: string;
  checked_at: string;
  latency_ms?: number | null;
}

export const HEALTH_CODE_LABELS: Record<string, string> = {
  connection_verified: "Spreadsheet-д бодит хандалт баталгаажсан",
  connection_verified_after_retry: "Дахин оролдлогоор баталгаажсан (түр алдаа гарсан)",
  local_emulator: "Local emulator — Google Sheets биш",
  not_configured: "Spreadsheet холбогдоогүй",
  missing_tab: "Шаардлагатай tab олдсонгүй",
  missing_columns: "Шаардлагатай багана дутуу",
  connection_failed: "Spreadsheet-д хандаж чадсангүй",
  store_not_found: "Дэлгүүр registry-д олдсонгүй",
};

export function healthCodeLabel(code: string | null | undefined): string {
  if (!code) return "Шалгаагүй";
  return HEALTH_CODE_LABELS[code] ?? code;
}

/** Current status of one store's Sheets integration from its newest event. */
export function currentStoreHealth(
  events: HealthEvent[],
  configured: boolean,
  now = Date.now(),
): { status: HealthStatus; stale: boolean; last: HealthEvent | null } {
  const last = [...events].sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0] ?? null;
  if (!configured) return { status: "disconnected", stale: false, last };
  if (!last) return { status: "unknown", stale: false, last };
  const stale = now - Date.parse(last.checked_at) > HEALTH_STALE_MS;
  if (stale && last.status === "healthy") return { status: "warning", stale, last };
  return { status: last.status, stale, last };
}

export function summarizeStatuses(statuses: HealthStatus[]): Record<HealthStatus, number> {
  const summary = Object.fromEntries(HEALTH_STATUSES.map(s => [s, 0])) as Record<HealthStatus, number>;
  for (const status of statuses) summary[status] += 1;
  return summary;
}

/** Worst status wins: error > disconnected > warning > unknown > healthy. */
export function overallStatus(statuses: HealthStatus[]): HealthStatus {
  for (const s of ["error", "disconnected", "warning", "unknown"] as HealthStatus[]) if (statuses.includes(s)) return s;
  return statuses.length ? "healthy" : "unknown";
}

export interface ConsistencyIssue {
  storeId: string;
  severity: "warning" | "error";
  code: "orphan_subscription" | "unassigned_plan" | "active_store_blocked" | "plan_missing" | "plan_unconfigured";
  message: string;
}

/**
 * Cross-checks the store registry against subscription records. Pure so it can
 * be tested; it reports facts only and never modifies data.
 */
export function subscriptionConsistency(
  stores: Array<{ id: string; status: string }>,
  subscriptions: Subscription[],
  plans: Array<{ id: string; max_products: number | null; max_orders: number | null; storage_bytes: number | null }>,
  now = Date.now(),
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const storeIds = new Set(stores.map(s => s.id));
  for (const sub of subscriptions) {
    if (!storeIds.has(sub.store_id)) {
      issues.push({ storeId: sub.store_id, severity: "warning", code: "orphan_subscription", message: "Subscription байгаа ч дэлгүүр registry-д алга." });
      continue;
    }
    const plan = plans.find(p => p.id === sub.plan_id);
    if (!plan) issues.push({ storeId: sub.store_id, severity: "error", code: "plan_missing", message: `"${sub.plan_id}" багц тохиргоонд алга. Бичих үйлдэл хаагдана.` });
    else if (plan.max_products === null && plan.max_orders === null && plan.storage_bytes === null)
      issues.push({ storeId: sub.store_id, severity: "warning", code: "plan_unconfigured", message: `"${plan.id}" багцын хязгаар тохируулагдаагүй (хязгааргүй).` });
    const store = stores.find(s => s.id === sub.store_id)!;
    const state = effectiveStatus(sub, now);
    if (store.status === "active" && ["expired", "suspended", "cancelled"].includes(state))
      issues.push({ storeId: sub.store_id, severity: "error", code: "active_store_blocked", message: `Дэлгүүр идэвхтэй боловч subscription "${state}" — бичих үйлдэл хаагдсан.` });
  }
  for (const store of stores) {
    if (!subscriptions.some(s => s.store_id === store.id))
      issues.push({ storeId: store.id, severity: "warning", code: "unassigned_plan", message: "Багц оноогоогүй — хязгаар хэрэгжихгүй." });
  }
  return issues;
}
