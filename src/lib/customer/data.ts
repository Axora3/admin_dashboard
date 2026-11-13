import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { AdminUser } from "@/lib/types";
import { getStoreRegistry, type StoreRecord } from "@/lib/registry";
import { recordPlatformAudit } from "@/lib/registry/audit-store";
import { siteIntegrationConfig } from "@/lib/google/site-config";
import { siteAdapter, clearSiteDataCache } from "@/lib/google/site-data-service";
import { createSheetBackend } from "@/lib/google/sheet-backend";
import { withPlatformLock } from "@/lib/platform/locks";
import { sheetsMode } from "@/lib/config";
import { assertPermission } from "@/lib/platform/permissions";
import { invalidateStoreCache } from "@/lib/data/google-repository";
import type { RecordBase } from "@/lib/google/data-contracts";
import { schemaForSite } from "./schema";
import { modulePermission } from "./modules";
import { CustomerError } from "./access";

export type CustomerRecord = RecordBase & Record<string, unknown>;
export function assertCustomerAccess(actor: AdminUser, store: StoreRecord, resourceName: string | null, write = false) {
  if (!actor.isSuperAdmin && (actor.storeId !== store.id || store.status !== "active")) throw new CustomerError("site_forbidden", 403);
  if (resourceName && !siteIntegrationConfig(store).enabled_modules.includes(resourceName as never)) throw new CustomerError("module_disabled", 403);
  try { assertPermission(actor, resourceName ? modulePermission(resourceName, write) : write ? "settings.manage" : "products.read", store.id); }
  catch { throw new CustomerError("permission_denied", 403); }
}
export async function readCustomerModule(actor: AdminUser, store: StoreRecord, resourceName: string) {
  assertCustomerAccess(actor, store, resourceName);
  return siteAdapter<CustomerRecord>(store, resourceName).list();
}
async function validateRelations(store: StoreRecord, resourceName: string, record: Record<string, unknown>, id?: string) {
  const requireRef = async (resource: string, value: unknown) => {
    if (!value) return;
    if (typeof value !== "string" || !await siteAdapter(store, resource).get(value)) throw new CustomerError("invalid_input", 422);
  };
  if (["products", "menu"].includes(resourceName)) await requireRef("categories", record.categoryId);
  if (resourceName === "projects") await requireRef("projectCategories", record.categoryId);
  if (resourceName === "inventory") await requireRef("products", record.productId);
  if (resourceName === "appointments") { await requireRef("services", record.serviceId); await requireRef("staff", record.staffId); }
  if (resourceName === "availability") await requireRef("staff", record.staffId);
  if (resourceName === "staff" && Array.isArray(record.serviceIds)) for (const value of record.serviceIds) await requireRef("services", value);
  const urls = [...(Array.isArray(record.images) ? record.images : []), ...[record.mediaUrl, record.linkUrl].filter(Boolean)];
  for (const value of urls) {
    try { const url = new URL(String(value)); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); }
    catch { throw new CustomerError("invalid_input", 422); }
  }
  if (resourceName === "discounts") {
    if (record.type === "percent" && Number(record.value) > 100) throw new CustomerError("invalid_input", 422);
    if (record.startsAt && record.endsAt && String(record.startsAt) >= String(record.endsAt)) throw new CustomerError("invalid_input", 422);
    if ((await siteAdapter<CustomerRecord>(store, resourceName).list()).some(row => row.id !== id && row.code === record.code)) throw new CustomerError("record_conflict", 409);
  }
  if (["openingHours", "availability"].includes(resourceName)) {
    const start = resourceName === "openingHours" ? record.opensAt : record.startsAt, end = resourceName === "openingHours" ? record.closesAt : record.endsAt;
    if (!record.isClosed && record.isAvailable !== false && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(start)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(end)) || String(start) >= String(end))) throw new CustomerError("invalid_input", 422);
    try { new Intl.DateTimeFormat("mn-MN", { timeZone: String(record.timezone || "Asia/Ulaanbaatar") }); } catch { throw new CustomerError("invalid_input", 422); }
  }
}

export function refreshCustomerSite(store: StoreRecord) {
  clearSiteDataCache(store.id); invalidateStoreCache(store.id);
  revalidatePath(`/store/${store.slug}`, "layout"); revalidatePath("/store-admin", "layout");
}

export async function mutateCustomerRecord(actor: AdminUser, store: StoreRecord, resourceName: string, operation: "create" | "update" | "delete", input: { id?: string; expectedUpdatedAt?: string; payload?: Record<string, unknown>; idempotencyKey?: string; confirmed?: boolean }) {
  assertCustomerAccess(actor, store, resourceName, true);
  const schema = schemaForSite(store, resourceName);
  if (Object.keys(input.payload ?? {}).some(key => ["site_id", "siteId", "spreadsheetId", "spreadsheet_id", "id", "createdAt", "updatedAt", "deletedAt", "idempotencyKey", "_rowNumber"].includes(key))) throw new CustomerError("invalid_input", 422);
  if (resourceName === "orders" && Object.hasOwn(input.payload ?? {}, "paymentStatus")) throw new CustomerError("permission_denied", 403);
  return withPlatformLock(`customer-site:${store.id}`, async () => {
    const adapter = siteAdapter<CustomerRecord>(store, resourceName);
    const previous = input.id ? await adapter.get(input.id) : null;
    if (operation !== "create" && !previous) throw new CustomerError("record_not_found", 404);
    const payload = input.payload ?? {};
    if (operation !== "delete") {
      const candidate: Record<string, unknown> = { ...(previous ?? {}), ...payload };
      for (const [key, raw] of Object.entries(schema.input.shape)) {
        if ((candidate[key] === "" || candidate[key] === undefined) && (raw as import("zod").z.ZodType).safeParse(undefined).success) delete candidate[key];
      }
      const parsed = schema.input.parse(candidate) as Record<string, unknown>;
      await validateRelations(store, resourceName, parsed, input.id);
    }
    await recordPlatformAudit({ actorUserId: actor.id, actorName: actor.fullName, storeId: store.id, action: "site_data.attempt", resourceType: resourceName, resourceId: input.id ?? null, metadata: { operation } });
    let record: CustomerRecord | null = null;
    if (operation === "create") record = await adapter.create(payload, input.idempotencyKey ?? "");
    else if (operation === "update") record = await adapter.update(input.id!, input.expectedUpdatedAt ?? "", payload);
    else await adapter.delete(input.id!, input.expectedUpdatedAt ?? "", input.confirmed === true);
    refreshCustomerSite(store);
    let auditWarning = false;
    try { await recordPlatformAudit({ actorUserId: actor.id, actorName: actor.fullName, storeId: store.id, action: `site_data.${operation}`, resourceType: resourceName, resourceId: record?.id ?? input.id ?? null, metadata: { operation, mode: sheetsMode() } }); }
    catch { auditWarning = true; console.error("[axora] customer operation audit confirmation failed"); }
    return { record, mode: sheetsMode(), auditWarning };
  });
}

/** Explicit additive preparation. Existing business cells and stable IDs are preserved. */
export async function prepareCustomerSchema(actor: AdminUser, store: StoreRecord) {
  assertCustomerAccess(actor, store, null, true);
  return withPlatformLock(`customer-site:${store.id}`, async () => {
    const backend = createSheetBackend({ storeId: store.id, spreadsheetId: store.sheets.spreadsheetId, mode: sheetsMode() });
    let initialized = 0;
    for (const resourceName of siteIntegrationConfig(store).enabled_modules) {
      const schema = schemaForSite(store, resourceName);
      await backend.ensureTable(schema.tab, schema.fields.map(f => f.header));
      await backend.ensureColumns(schema.tab, schema.fields.map(f => f.header));
      const table = await backend.readTable(schema.tab);
      if (table.rows.length > 1000) throw new CustomerError("schema_not_ready", 503);
      const idHeader = schema.fields.find(f => f.field === "id")!.header, updatedHeader = schema.fields.find(f => f.field === "updatedAt")!.header;
      for (const row of table.rows) {
        if (!Object.values(row.values).some(Boolean)) continue;
        const patch: Record<string, string> = {};
        if (!row.values[idHeader]) patch[idHeader] = randomUUID();
        if (!row.values[updatedHeader]) patch[updatedHeader] = new Date().toISOString();
        if (Object.keys(patch).length) { await backend.patchRow(schema.tab, table.headers, patch, row.rowNumber); initialized++; }
      }
    }
    const current = await getStoreRegistry().get(store.id);
    if (!current) throw new CustomerError("site_forbidden", 403);
    await getStoreRegistry().updateSheets(store.id, { ...current.sheets, connectionStatus: sheetsMode() === "google" ? "connected" : "local", lastCheckedAt: new Date().toISOString(), lastError: null });
    await recordPlatformAudit({ actorUserId: actor.id, actorName: actor.fullName, storeId: store.id, action: "site_schema.prepared", resourceType: "site_integration", resourceId: store.id, metadata: { initialized, mode: sheetsMode() } });
    refreshCustomerSite(store);
    return { mode: sheetsMode(), initialized };
  });
}
