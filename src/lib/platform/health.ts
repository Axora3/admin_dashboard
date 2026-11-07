import "server-only";
import { checked, platformDb } from "./db";
import { getStoreRegistry } from "@/lib/registry";
import { createSheetBackend } from "@/lib/google/sheet-backend";
import { sheetsMode } from "@/lib/config";
import type { SheetResource } from "@/lib/google/types";
import { requiredMissing } from "@/lib/google/mapping";
import { publishNotification } from "./notifications";
import type { HealthEvent, HealthStatus } from "./health-rules";
import type { StoreRecord } from "@/lib/registry/types";

const CHECKED_RESOURCES: SheetResource[] = ["products", "categories", "orders", "customers", "settings"];

/** A store integration is configured when it has an assigned spreadsheet (or uses the local emulator). */
export function isSheetsConfigured(store: Pick<StoreRecord, "sheets">): boolean {
  return sheetsMode() === "local" || Boolean(store.sheets.spreadsheetId);
}

/**
 * Real connection test: lists tabs and reads every mapped tab of the spreadsheet
 * ASSIGNED in the registry (never a client-supplied ID). A successful status
 * requires actual read access — configuration values alone are never enough.
 */
async function probe(store: StoreRecord): Promise<void> {
  const backend = createSheetBackend({ storeId: store.id, spreadsheetId: store.sheets.spreadsheetId, mode: sheetsMode() });
  const tabs = await backend.listTabs();
  for (const resource of CHECKED_RESOURCES) {
    const tab = store.sheets.tabs[resource];
    if (!tabs.includes(tab)) throw new Error("missing_tab");
    const table = await backend.readTable(tab);
    if (requiredMissing(table.headers, store.sheets.columns[resource], resource).length) throw new Error("missing_columns");
  }
}

const STRUCTURAL = new Set(["missing_tab", "missing_columns"]);

export async function checkStoreHealth(storeId: string) {
  const registry = getStoreRegistry();
  const store = await registry.get(storeId);
  if (!store) throw new Error("Store not found");
  const db = platformDb();
  const start = Date.now();
  let status: HealthStatus = "healthy";
  let code = "connection_verified";

  if (!isSheetsConfigured(store)) {
    status = "disconnected";
    code = "not_configured";
  } else {
    // One bounded retry for transient network/API failures; structural problems are not retried.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await probe(store);
        status = sheetsMode() === "local" ? "warning" : "healthy";
        code = sheetsMode() === "local" ? "local_emulator" : attempt > 1 ? "connection_verified_after_retry" : "connection_verified";
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        status = "error";
        code = STRUCTURAL.has(message) ? message : "connection_failed";
        if (STRUCTURAL.has(message) || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 750));
      }
    }
  }

  const previous = checked(
    await db.from("platform_health").select("status").eq("store_id", storeId).eq("component", "sheets")
      .order("checked_at", { ascending: false }).limit(1),
  ).data?.[0] as { status: HealthStatus } | undefined;
  const checkedAt = new Date().toISOString();
  checked(await db.from("platform_health").insert({ store_id: storeId, component: "sheets", status, code, latency_ms: Date.now() - start, checked_at: checkedAt }));
  await registry.updateSheets(storeId, {
    ...store.sheets,
    connectionStatus: status === "disconnected" ? "unconfigured" : status === "error" ? "error" : sheetsMode() === "local" ? "local" : "connected",
    lastCheckedAt: checkedAt,
    lastSyncAt: status === "healthy" || status === "warning" ? checkedAt : store.sheets.lastSyncAt,
    lastError: status === "error" ? code : null,
  });

  if (previous?.status !== status) {
    const recovered = previous?.status === "error" && (status === "healthy" || status === "warning");
    const title = status === "error"
      ? "Google Sheets холболт алдаатай байна"
      : recovered
        ? "Google Sheets холболт сэргэлээ"
        : status === "disconnected"
          ? "Google Sheets холбогдоогүй байна"
          : "Google Sheets холболтын төлөв шинэчлэгдлээ";
    await publishNotification({ key: `health:${storeId}:${checkedAt}`, storeId, category: "connection", title, audience: "store" });
  }
  return { storeId, status, code, checkedAt };
}

export interface PlatformHealthInfo {
  supabase: { status: HealthStatus; checkedAt: string; latencyMs: number };
  health: HealthEvent[];
  jobs: Array<{ id: string; status: string; started_at: string; completed_at: string | null; failures: number }>;
  backups: Array<{ id: string; store_id: string; status: string; kind: string; created_at: string; failure_code: string | null }>;
  restores: Array<{ id: string; store_id: string; status: string; created_at: string; failure_code: string | null }>;
}

/** Never throws for a Supabase outage: it reports Error instead so the Health Center still renders. */
export async function platformHealth(): Promise<PlatformHealthInfo> {
  const start = Date.now();
  const checkedAt = new Date().toISOString();
  let db: ReturnType<typeof platformDb>;
  try {
    db = platformDb();
  } catch {
    return { supabase: { status: "disconnected", checkedAt, latencyMs: 0 }, health: [], jobs: [], backups: [], restores: [] };
  }
  const probeResult = await db.from("profiles").select("id").limit(1);
  const supabase = { status: (probeResult.error ? "error" : "healthy") as HealthStatus, checkedAt, latencyMs: Date.now() - start };
  if (probeResult.error) return { supabase, health: [], jobs: [], backups: [], restores: [] };
  const [health, jobs, backups, restores] = await Promise.all([
    db.from("platform_health").select("*").order("checked_at", { ascending: false }).limit(500),
    db.from("platform_jobs").select("*").order("started_at", { ascending: false }).limit(10),
    db.from("platform_backups").select("*").order("created_at", { ascending: false }).limit(30),
    db.from("platform_restores").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    supabase,
    health: checked(health).data ?? [],
    jobs: checked(jobs).data ?? [],
    backups: checked(backups).data ?? [],
    restores: checked(restores).data ?? [],
  };
}
