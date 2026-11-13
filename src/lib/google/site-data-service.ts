import "server-only";
import { createHash } from "node:crypto";
import { schemaForSite } from "@/lib/customer/schema";
import { createSheetBackend } from "./sheet-backend";
import { canonicalBusinessType, modulesForBusiness, schemaFor } from "./schema-registry";
import { createTypedSheetAdapter } from "./typed-adapter";
import { sheetsMode } from "@/lib/config";
import { getStoreRegistry, type StoreRecord } from "@/lib/registry";
import { normalizeDomain } from "@/lib/utils";
import { withPlatformLock } from "@/lib/platform/locks";
import type { SiteAdapter, RecordBase, SheetModule } from "./data-contracts";

const publicReadable = new Set<SheetModule>(["products", "categories", "menu", "openingHours", "services", "pages", "gallery", "articles", "projects", "projectCategories"]);
const publicCreateOnly = new Set<SheetModule>(["orders", "reservations", "appointments", "contactInquiries"]);
const globalForPublicCache = globalThis as unknown as { __axoraPublicSiteData?: Map<string, { expiresAt: number; rows: unknown[] }> };
const publicCache = () => globalForPublicCache.__axoraPublicSiteData ??= new Map();

export function clearSiteDataCache(siteId: string, module?: string) {
  for (const key of publicCache().keys()) if (key.startsWith(`${siteId}:`) && (!module || key.endsWith(`:${module}`))) publicCache().delete(key);
}

export async function resolveSiteFromOrigin(origin: string | null): Promise<StoreRecord | null> {
  if (!origin) return null;
  let hostname: string;
  try { hostname = normalizeDomain(new URL(origin).hostname); } catch { return null; }
  const store = await getStoreRegistry().findByDomain(hostname);
  if (!store || store.status !== "active" || !store.settings.visibility.published) return null;
  const domain = store.domains.find(item => normalizeDomain(item.domain) === hostname);
  if (!domain || domain.status !== "active" || domain.verificationStatus !== "verified" || domain.sslStatus !== "active") return null;
  return store;
}

export function siteAdapter<T extends RecordBase>(store: StoreRecord, module: string): SiteAdapter<T> {
  const businessType = canonicalBusinessType(store.businessType);
  const configModules = store.sheets.enabledModules ?? modulesForBusiness(businessType);
  if (!configModules.includes(module)) throw new Error("This site integration module is not enabled.");
  const schema = schemaForSite(store, module);
  if (!store.sheets.spreadsheetId) throw new Error("This site has no spreadsheet configured.");
  const backend = createSheetBackend({ storeId: store.id, spreadsheetId: store.sheets.spreadsheetId, mode: sheetsMode() });
  const adapter = createTypedSheetAdapter<T>(backend, schema);
  const lockKey = `site-sheet:${store.id}:${schema.module}`;
  const noteSync = async () => {
    try {
      const registry = getStoreRegistry();
      const current = await registry.get(store.id);
      if (!current || current.sheets.spreadsheetId !== store.sheets.spreadsheetId) return;
      const syncedAt = new Date().toISOString();
      await registry.updateSheets(store.id, { ...current.sheets, lastSyncAt: syncedAt, lastSuccessfulSync: syncedAt, lastError: null });
    } catch { console.error("[axora] Sheets sync metadata update failed"); }
  };
  return {
    list: () => adapter.list(),
    get: id => adapter.get(id),
    create: (input, idempotencyKey) => withPlatformLock(lockKey, async () => { const result = await adapter.create(input, idempotencyKey); await noteSync(); return result; }),
    update: (id, expectedUpdatedAt, input) => withPlatformLock(lockKey, async () => { const result = await adapter.update(id, expectedUpdatedAt, input); await noteSync(); return result; }),
    delete: (id, expectedUpdatedAt, confirmed) => withPlatformLock(lockKey, async () => { await adapter.delete(id, expectedUpdatedAt, confirmed); await noteSync(); }),
  };
}

export async function publicRead(store: StoreRecord, module: string) {
  if (!publicReadable.has(module as SheetModule)) throw new Error("This resource is not available for public reads.");
  const key = `${store.id}:${store.sheets.configurationVersion ?? 1}:${module}`;
  const cached = publicCache().get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;
  const schema = schemaFor(canonicalBusinessType(store.businessType), module);
  const rows = await siteAdapter(store, module).list();
  const filtered = rows
    .filter(row => {
      const record = row as unknown as Record<string, unknown>;
      if (record.status !== undefined && record.status !== "published" && record.status !== "active") return false;
      if (record.isActive === false || record.isAvailable === false) return false;
      return true;
    })
    .map(row => Object.fromEntries(schema.publicFields.filter(field => field in row).map(field => [field, (row as unknown as Record<string, unknown>)[field]])));
  publicCache().set(key, { rows: filtered, expiresAt: Date.now() + 15_000 });
  return filtered;
}

export async function createPublicSubmission(store: StoreRecord, module: string, payload: unknown, idempotencyKey: string) {
  if (!publicCreateOnly.has(module as SheetModule)) throw new Error("This resource does not accept public submissions.");
  const businessType = canonicalBusinessType(store.businessType);
  const schema = schemaFor(businessType, module);
  let input = payload;
  if (module === "orders") input = await preparePublicOrder(store, businessType, payload, idempotencyKey);
  else {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Submission payload must be an object.");
    const body = payload as Record<string, unknown>;
    const allowed = module === "reservations"
      ? ["customerName", "phone", "partySize", "reservedAt", "email", "note"]
      : module === "appointments"
        ? ["serviceId", "staffId", "customerName", "startsAt", "phone", "email", "note"]
        : ["name", "email", "phone", "subject", "message"];
    input = Object.fromEntries(allowed.filter(key => key in body).map(key => [key, body[key]]));
    (input as Record<string, unknown>).status = module === "contactInquiries" ? "new" : "requested";
  }
  const record = await siteAdapter(store, module).create(input, idempotencyKey);
  clearSiteDataCache(store.id);
  return { id: record.id, createdAt: record.createdAt };
}

async function preparePublicOrder(store: StoreRecord, businessType: ReturnType<typeof canonicalBusinessType>, payload: unknown, idempotencyKey: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Order payload must be an object.");
  const body = payload as Record<string, unknown>;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) throw new Error("Order items are invalid.");
  const catalogModule: SheetModule = businessType === "restaurant" ? "menu" : "products";
  const catalog = await siteAdapter(store, catalogModule).list();
  const items: Array<Record<string, unknown>> = [];
  let totalAmount = 0;
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") throw new Error("Order item is invalid.");
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 100) throw new Error("Order item is invalid.");
    const product = catalog.find(entry => entry.id === item.id) as unknown as Record<string, unknown> | undefined;
    if (!product || product.deletedAt) throw new Error("An order item is unavailable.");
    if (businessType === "restaurant" && product.isAvailable === false) throw new Error("An order item is unavailable.");
    if (businessType !== "restaurant" && (product.isActive === false || (typeof product.stock === "number" && product.stock < Number(item.quantity)))) throw new Error("An order item is unavailable.");
    const unitPrice = typeof product.salePrice === "number" ? product.salePrice : Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("An order item is unavailable.");
    const lineTotal = unitPrice * Number(item.quantity);
    totalAmount += lineTotal;
    items.push({ id: product.id, name: String(product.name ?? ""), unitPrice, quantity: Number(item.quantity), lineTotal });
  }
  const cleaned: Record<string, unknown> = {
    orderNumber: `WEB-${createHash("sha256").update(store.id + ":" + idempotencyKey).digest("hex").slice(0, 12).toUpperCase()}`,
    status: "new", paymentStatus: "pending", items, totalAmount,
  };
  if (businessType === "online_store") {
    const shipping = store.settings.shipping;
    const deliveryFee = shipping.enabled && totalAmount < shipping.freeOver ? shipping.flatRate : 0;
    cleaned.deliveryFee = deliveryFee;
    cleaned.totalAmount = totalAmount + deliveryFee;
    if (body.address && typeof body.address === "object" && !Array.isArray(body.address)) {
      const address = body.address as Record<string, unknown>;
      cleaned.shipping = Object.fromEntries(["city", "district", "khoroo", "detail"].filter(key => typeof address[key] === "string").map(key => [key, address[key]]));
    }
    if (typeof body.paymentMethod === "string") cleaned.paymentMethod = body.paymentMethod;
  }
  for (const key of ["customerName", "customerPhone", "customerEmail", "fulfillmentType", "requestedAt", "note"]) {
    if (typeof body[key] === "string") cleaned[key] = body[key];
  }
  return cleaned;
}
