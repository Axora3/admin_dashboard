import "server-only";
import { storeScope } from "@/lib/auth/store-scope";
import { assertOperationLock } from "@/lib/platform/locks";

import type {
  AuditFilters,
  AuditLog,
  Category,
  CategoryInput,
  CheckoutInput,
  CreateStoreInput,
  Customer,
  CustomerFilters,
  Domain,
  DomainFilters,
  DomainInput,
  InventoryFilters,
  InventoryLog,
  Order,
  OrderFilters,
  OrderItem,
  OrderStatus,
  Paginated,
  PaymentStatus,
  PlatformStats,
  Product,
  ProductFilters,
  ProductInput,
  ProductVariant,
  Store,
  StoreAnalytics,
  StoreFilters,
  StoreSettingsData,
  StoreStatus,
  UpdateStoreInput,
} from "@/lib/types";
import type { AuditInput, Repository, StoreOption } from "./repository";
import { computePlatformStats, computeStoreAnalytics } from "./analytics";
import { defaultStoreSettings } from "./defaults";
import { sheetsMode } from "@/lib/config";
import {
  createSheetBackend,
  SheetTabMissingError,
  type SheetBackend,
} from "@/lib/google/sheet-backend";
import {
  autoMapColumns,
  readField,
  resolveHeader,
  rowToCategory,
  rowToOrder,
  rowToProduct,
  serializeImages,
  serializeItems,
  serializeVariants,
  tableFromValues,
  toIso,
  toNumber,
  type SheetTable,
} from "@/lib/google/mapping";
import {
  DEFAULT_COLUMNS,
  DEFAULT_TABS,
  REQUIRED_COLUMNS,
  cloneColumns,
  extractSpreadsheetId,
  spreadsheetUrl,
  type SheetResource,
  type StoreSheetsConfig,
  type StoreSheetsInput,
} from "@/lib/google/types";
import { GoogleSheetsError } from "@/lib/google/sheets-client";
import { getStoreRegistry, type StoreRecord } from "@/lib/registry";
import { listPlatformAuditLogs, recordPlatformAudit } from "@/lib/registry/audit-store";
import {
  normalizeDomain,
  paginate,
  randomToken,
  slugify,
} from "@/lib/utils";
import { monthLabel } from "@/lib/format";

const LOW_STOCK_THRESHOLD = 5;
const CACHE_TTL_MS = 20_000;

interface CacheEntry {
  expiresAt: number;
  table: SheetTable;
}

const globalForSheets = globalThis as unknown as {
  __axoraSheetCache?: Map<string, CacheEntry>;
};

function cache(): Map<string, CacheEntry> {
  if (!globalForSheets.__axoraSheetCache) {
    globalForSheets.__axoraSheetCache = new Map();
  }
  return globalForSheets.__axoraSheetCache;
}

function cacheKey(storeId: string, resource: SheetResource): string {
  return `${storeId}:${resource}`;
}

function invalidate(storeId: string, resource?: SheetResource) {
  if (!resource) {
    for (const key of cache().keys()) {
      if (key.startsWith(`${storeId}:`)) cache().delete(key);
    }
    return;
  }
  cache().delete(cacheKey(storeId, resource));
}
export const invalidateStoreCache = invalidate;
export async function readStoreReportData(storeId:string) {
  const store=await requireStore(storeId);
  invalidate(storeId);
  for(const resource of ["products","orders","categories"] as SheetResource[]){
    const table=await readResourceTable(store,resource);
    for(const field of REQUIRED_COLUMNS[resource])if(!resolveHeader(table.headers,store.sheets.columns[resource],field,DEFAULT_COLUMNS[resource]))throw new Error("Required columns are missing.");
  }
  const [products,orders,categories]=await Promise.all([readStoreProducts(store),readStoreOrders(store),readStoreCategories(store)]);
  return {products,orders,categories,refreshedAt:new Date().toISOString()};
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${randomToken(16)}`;
}

function tabFor(store: StoreRecord, resource: SheetResource): string {
  return store.sheets.tabs[resource] || DEFAULT_TABS[resource];
}

function mappingFor(store: StoreRecord, resource: SheetResource) {
  return store.sheets.columns[resource] ?? DEFAULT_COLUMNS[resource];
}

function defaultHeaders(store: StoreRecord, resource: SheetResource): string[] {
  const mapping = mappingFor(store, resource);
  const defaults = DEFAULT_COLUMNS[resource];
  return Array.from(
    new Set(
      Object.keys(defaults).map((field) => mapping[field] || defaults[field]),
    ),
  );
}

function backendFor(store: StoreRecord): SheetBackend {
  const mode = sheetsMode();
  if (mode === "google" && !store.sheets.spreadsheetId) {
    throw new GoogleSheetsError("Spreadsheet ID is missing", {
      code: "missing_spreadsheet_id",
      userMessage:
        "Энэ дэлгүүрт Google Spreadsheet ID тохируулаагүй байна. Дэлгүүрийн тохиргооноос холбоно уу.",
    });
  }
  return createSheetBackend({
    storeId: store.id,
    spreadsheetId: store.sheets.spreadsheetId,
    mode,
  });
}

async function readResourceTable(
  store: StoreRecord,
  resource: SheetResource,
  options: { optional?: boolean } = {},
): Promise<SheetTable> {
  const key = cacheKey(store.id, resource);
  const cached = cache().get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.table;

  const backend = backendFor(store);
  const tab = tabFor(store, resource);
  try {
    const table = await backend.readTable(tab);
    cache().set(key, { expiresAt: Date.now() + CACHE_TTL_MS, table });
    return table;
  } catch (error) {
    if (options.optional && error instanceof SheetTabMissingError) {
      return { headers: [], rows: [] };
    }
    if (error instanceof SheetTabMissingError) {
      throw new GoogleSheetsError(`Sheet tab "${tab}" not found`, {
        code: "missing_tab",
        userMessage: `"${tab}" sheet tab олдсонгүй. Дэлгүүрийн Google Sheets тохиргоог шалгана уу.`,
      });
    }
    throw error;
  }
}

async function ensureResourceTable(
  store: StoreRecord,
  resource: SheetResource,
): Promise<SheetTable> {
  const backend = backendFor(store);
  await backend.ensureTable(tabFor(store, resource), defaultHeaders(store, resource));
  invalidate(store.id, resource);
  return readResourceTable(store, resource);
}

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function valuesFor(
  store: StoreRecord,
  resource: SheetResource,
  data: Record<string, unknown>,
  headers?: string[],
): Record<string, string> {
  const mapping = mappingFor(store, resource);
  const defaults = DEFAULT_COLUMNS[resource];
  const out: Record<string, string> = {};
  for (const [field, fallback] of Object.entries(defaults)) {
    const header = headers
      ? resolveHeader(headers, mapping, field, defaults) ?? mapping[field] ?? fallback
      : mapping[field] || fallback;
    out[header] = serializeValue(data[field]);
  }
  return out;
}

function rowNumberFor(
  table: SheetTable,
  store: StoreRecord,
  resource: SheetResource,
  idField: string,
  id: string,
): { rowNumber: number; values: Record<string, string> } | null {
  const mapping = mappingFor(store, resource);
  const defaults = DEFAULT_COLUMNS[resource];
  const header = resolveHeader(table.headers, mapping, idField, defaults);
  if (!header) return null;
  for (const row of table.rows) {
    if (row.values[header] === id) return row;
  }
  return null;
}

async function writeResourceRow(
  store: StoreRecord,
  resource: SheetResource,
  values: Record<string, string>,
  rowNumber?: number | null,
): Promise<void> {
  assertOperationLock();
  const table = await ensureResourceTable(store, resource);
  const backend = backendFor(store);
  const merged = rowNumber
    ? {
        ...(table.rows.find((row) => row.rowNumber === rowNumber)?.values ?? {}),
        ...values,
      }
    : values;
  await backend.writeRow(tabFor(store, resource), table.headers, merged, rowNumber);
  invalidate(store.id, resource);
}

async function deleteResourceRow(
  store: StoreRecord,
  resource: SheetResource,
  rowNumber: number,
): Promise<void> {
  const backend = backendFor(store);
  await backend.deleteRow(tabFor(store, resource), rowNumber);
  invalidate(store.id, resource);
}

async function requireStore(idOrSlug: string): Promise<StoreRecord> {
  const store = await getStoreRegistry().get(idOrSlug);
  if (!store) throw new Error("Дэлгүүр олдсонгүй.");
  return store;
}

async function findStoreForResource(
  resource: SheetResource,
  id: string,
  idField: string,
): Promise<{ store: StoreRecord; row: { rowNumber: number; values: Record<string, string> } } | null> {
  const stores = await getStoreRegistry().list();
  for (const store of stores) {
    try {
      const table = await readResourceTable(store, resource, { optional: true });
      if (table.headers.length === 0) continue;
      const row = rowNumberFor(table, store, resource, idField, id);
      if (row) return { store, row };
    } catch {
      // A broken store must not hide records in other stores.
    }
  }
  return null;
}

function uniqueCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const order of orders) {
    const key = `${order.customerPhone || order.customerEmail || order.customerName}`.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += order.orderStatus === "cancelled" ? 0 : order.totalAmount;
      if (order.createdAt < existing.firstOrderAt) existing.firstOrderAt = order.createdAt;
      if (order.createdAt > existing.lastOrderAt) existing.lastOrderAt = order.createdAt;
    } else {
      map.set(key, {
        id: `cus_${key.replace(/[^a-z0-9]/g, "").slice(0, 20)}`,
        storeId: order.storeId,
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        orderCount: 1,
        totalSpent: order.orderStatus === "cancelled" ? 0 : order.totalAmount,
        firstOrderAt: order.createdAt,
        lastOrderAt: order.createdAt,
      });
    }
  }
  return Array.from(map.values());
}

function orderPrefix(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const prefix = words.map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return prefix || "AX";
}

function nextOrderNumber(store: StoreRecord, orders: Order[]): string {
  const prefix = orderPrefix(store.name);
  const max = orders.reduce((highest, order) => {
    const match = order.orderNumber.match(/(\d+)\s*$/);
    if (!match) return highest;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 999);
  return `${prefix}-${max + 1}`;
}

function primaryDomain(record: StoreRecord): string | null {
  return (
    record.domains.find((domain) => domain.isPrimary)?.domain ??
    record.domains[0]?.domain ??
    null
  );
}

function safeSheetsMeta(record: StoreRecord, error?: unknown) {
  const userMessage =
    error && typeof error === "object" && "userMessage" in error
      ? String((error as { userMessage?: unknown }).userMessage ?? "")
      : error instanceof Error
        ? error.message
        : "";
  return {
    connectionStatus:
      error
        ? ("error" as const)
        : record.sheets.connectionStatus === "unconfigured"
          ? sheetsMode() === "local"
            ? ("local" as const)
            : ("unconfigured" as const)
          : record.sheets.connectionStatus,
    lastSyncAt: record.sheets.lastSyncAt,
    lastCheckedAt: record.sheets.lastCheckedAt,
    lastError: error ? userMessage : record.sheets.lastError,
    spreadsheetName: record.sheets.spreadsheetName,
    tabs: { ...record.sheets.tabs },
    columns: cloneColumns(record.sheets.columns),
  };
}

function toStore(
  record: StoreRecord,
  counts: { products: number; orders: number; customers: number; revenue: number },
  error?: unknown,
): Store {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    businessType: record.businessType,
    description: record.description,
    logoUrl: record.logoUrl,
    status: record.status,
    currency: record.currency,
    language: record.language,
    phone: record.phone,
    email: record.email,
    address: record.address,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    ownerPhone: record.ownerPhone,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    primaryDomain: primaryDomain(record),
    productCount: counts.products,
    orderCount: counts.orders,
    customerCount: counts.customers,
    revenue: counts.revenue,
    settings: record.settings,
    sheets: safeSheetsMeta(record, error),
  };
}

async function readStoreProducts(store: StoreRecord): Promise<Product[]> {
  const table = await readResourceTable(store, "products", { optional: true });
  const categories = await readResourceTable(store, "categories", { optional: true });
  const categoryNames = new Map(
    categories.rows
      .map((row) => rowToCategory(store.id, row.values, categories.headers, store.sheets.columns))
      .filter((category): category is Category => Boolean(category))
      .map((category) => [category.id, category.name] as const),
  );
  return table.rows
    .map((row) =>
      rowToProduct(store.id, row.values, table.headers, store.sheets.columns, categoryNames),
    )
    .filter((product): product is Product => Boolean(product));
}

async function readStoreOrders(store: StoreRecord): Promise<Order[]> {
  const table = await readResourceTable(store, "orders", { optional: true });
  return table.rows
    .map((row) =>
      rowToOrder(store.id, store.name, row.values, table.headers, store.sheets.columns),
    )
    .filter((order): order is Order => Boolean(order));
}

async function readStoreCategories(store: StoreRecord): Promise<Category[]> {
  const [table, products] = await Promise.all([
    readResourceTable(store, "categories", { optional: true }),
    readStoreProducts(store),
  ]);
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.categoryId) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
  }
  return table.rows
    .map((row) => rowToCategory(store.id, row.values, table.headers, store.sheets.columns))
    .filter((category): category is Category => Boolean(category))
    .map((category) => ({
      ...category,
      productCount: counts.get(category.id) ?? 0,
    }));
}

async function hydrateStore(record: StoreRecord): Promise<Store> {
  try {
    const [products, orders, settings] = await Promise.all([
      readStoreProducts(record),
      readStoreOrders(record),
      getStoreSettingsRecord(record),
    ]);
    const revenue = orders
      .filter((order) => order.orderStatus !== "cancelled" && order.paymentStatus === "paid")
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const customers = new Set(
      orders.map((order) =>
        `${order.customerPhone || order.customerEmail || order.customerName}`.toLowerCase(),
      ),
    ).size;
    return toStore({...record,settings}, {
      products: products.length,
      orders: orders.length,
      customers,
      revenue,
    });
  } catch (error) {
    return toStore(record, { products: 0, orders: 0, customers: 0, revenue: 0 }, error);
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function getStoreSettingsRecord(store: StoreRecord): Promise<StoreSettingsData> {
  const table = await readResourceTable(store, "settings", { optional: true });
  if (table.headers.length === 0) return store.settings;
  const mapping = mappingFor(store, "settings");
  const defaults = DEFAULT_COLUMNS.settings;
  const keyHeader = resolveHeader(table.headers, mapping, "key", defaults);
  const valueHeader = resolveHeader(table.headers, mapping, "value", defaults);
  if (!keyHeader || !valueHeader) return store.settings;
  const row = table.rows.find(
    (entry) => entry.values[keyHeader]?.trim().toLowerCase() === "settings",
  );
  if (!row) return store.settings;
  try {
    const parsed = JSON.parse(row.values[valueHeader] ?? "") as StoreSettingsData;
    if (!parsed || typeof parsed !== "object") return store.settings;
    return {
      ...defaultStoreSettings(store.settings.theme.style),
      ...parsed,
      social: { ...defaultStoreSettings().social, ...(parsed.social ?? {}) },
      theme: { ...defaultStoreSettings(store.settings.theme.style).theme, ...(parsed.theme ?? {}) },
      shipping: { ...defaultStoreSettings().shipping, ...(parsed.shipping ?? {}) },
      payment: { ...defaultStoreSettings().payment, ...(parsed.payment ?? {}) },
      visibility: { ...defaultStoreSettings().visibility, ...(parsed.visibility ?? {}) },
    };
  } catch {
    return store.settings;
  }
}

async function upsertCustomerForOrder(store: StoreRecord, order: Order): Promise<void> {
  try {
    const table = await ensureResourceTable(store, "customers");
    const mapping = mappingFor(store, "customers");
    const defaults = DEFAULT_COLUMNS.customers;
    const idHeader = resolveHeader(table.headers, mapping, "id", defaults);
    const phoneHeader = resolveHeader(table.headers, mapping, "phone", defaults);
    const emailHeader = resolveHeader(table.headers, mapping, "email", defaults);
    const existing = table.rows.find((row) => {
      const phone = phoneHeader ? row.values[phoneHeader] : "";
      const email = emailHeader ? row.values[emailHeader] : "";
      return (
        (order.customerPhone && phone === order.customerPhone) ||
        (order.customerEmail && email === order.customerEmail)
      );
    });
    if (existing) {
      const values = valuesFor(store, "customers", {
        id: idHeader ? existing.values[idHeader] : newId("cus"),
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        orderCount: Number(
          readField(existing.values, table.headers, mapping, defaults, "orderCount") || "0",
        ) + 1,
        totalSpent:
          toNumber(readField(existing.values, table.headers, mapping, defaults, "totalSpent")) +
          order.totalAmount,
        firstOrderAt:
          readField(existing.values, table.headers, mapping, defaults, "firstOrderAt") ||
          order.createdAt,
        lastOrderAt: order.createdAt,
      }, table.headers);
      await writeResourceRow(store, "customers", values, existing.rowNumber);
    } else {
      const values = valuesFor(store, "customers", {
        id: newId("cus"),
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        orderCount: 1,
        totalSpent: order.totalAmount,
        firstOrderAt: order.createdAt,
        lastOrderAt: order.createdAt,
      }, table.headers);
      await writeResourceRow(store, "customers", values);
    }
  } catch {
    // Customer tab is optional; the order itself must still succeed.
  }
}

async function appendInventoryLog(
  store: StoreRecord,
  product: Product,
  changeAmount: number,
  reason: string,
  note: string,
  actorName: string,
): Promise<void> {
  try {
    const table = await ensureResourceTable(store, "inventory");
    const values = valuesFor(store, "inventory", {
      id: newId("inv"),
      productId: product.id,
      productName: product.name,
      changeAmount,
      balanceAfter: product.stock,
      reason,
      note,
      actorName,
      createdAt: nowIso(),
    }, table.headers);
    await writeResourceRow(store, "inventory", values);
  } catch {
    // Inventory log is auxiliary. The stock write is the source of truth.
  }
}

function orderData(order: Order): Record<string, unknown> {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    note: order.note,
    subtotal: order.subtotal,
    shippingAmount: order.shippingAmount,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function productData(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    stock: product.stock,
    sku: product.sku,
    categoryId: product.categoryId ?? "",
    images: product.images,
    variants: product.variants,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function restoreStockForOrder(
  store: StoreRecord,
  order: Order,
  reason: string,
): Promise<void> {
  if (!order.items.length) return;
  const table = await readResourceTable(store, "products", { optional: true });
  const mapping = mappingFor(store, "products");
  const defaults = DEFAULT_COLUMNS.products;
  for (const item of order.items) {
    if (!item.productId) continue;
    const row = rowNumberFor(table, store, "products", "id", item.productId);
    if (!row) continue;
    const current = rowToProduct(
      store.id,
      row.values,
      table.headers,
      store.sheets.columns,
      new Map(),
    );
    if (!current) continue;
    const next = { ...current, stock: current.stock + item.quantity, updatedAt: nowIso() };
    const values = valuesFor(store, "products", productData(next), table.headers);
    await writeResourceRow(store, "products", values, row.rowNumber);
    await appendInventoryLog(store, next, item.quantity, reason, order.orderNumber, "System");
  }
}

async function createStoreOrder(input: CheckoutInput): Promise<Order> {
  const store = await requireStore(input.storeSlug);
  if (store.status !== "active") throw new Error("Дэлгүүр түр хаалттай байна.");
  const settings = await getStoreSettingsRecord(store);
  if (!settings.visibility.published) {
    throw new Error("Дэлгүүрийн website нийтэд нээлттэй биш байна.");
  }
  if (!input.items.length) throw new Error("Сагс хоосон байна.");
  if (!input.customerName.trim() || !input.customerPhone.trim()) {
    throw new Error("Нэр болон утасны дугаар шаардлагатай.");
  }

  const products = await readStoreProducts(store);
  const byId = new Map(products.map((product) => [product.id, product]));
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product) throw new Error("Бүтээгдэхүүн олдсонгүй.");
    if (!product.isActive) throw new Error(`${product.name} зарагдахгүй байна.`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Тоо ширхэг буруу байна.");
    }
    quantities.set(product.id, (quantities.get(product.id) ?? 0) + item.quantity);
  }

  const lines: Array<{ product: Product; quantity: number }> = [];
  for (const [productId, quantity] of quantities) {
    const product = byId.get(productId)!;
    if (product.stock < quantity) {
      throw new Error(`${product.name} хангалттай үлдэгдэлгүй байна.`);
    }
    lines.push({ product, quantity });
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + (line.product.salePrice ?? line.product.price) * line.quantity,
    0,
  );
  const shippingAmount =
    settings.shipping.enabled &&
    (settings.shipping.freeOver <= 0 || subtotal < settings.shipping.freeOver)
      ? settings.shipping.flatRate
      : 0;
  const existingOrders = await readStoreOrders(store);
  const orderId = newId("ord");
  const createdAt = nowIso();
  const orderNumber = nextOrderNumber(store, existingOrders);
  const items: OrderItem[] = lines.map((line, index) => ({
    id: `${orderId}_item_${index}`,
    orderId,
    storeId: store.id,
    productId: line.product.id,
    productName: line.product.name,
    quantity: line.quantity,
    unitPrice: line.product.salePrice ?? line.product.price,
  }));

  const order: Order = {
    id: orderId,
    storeId: store.id,
    storeName: store.name,
    orderNumber,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail.trim(),
    customerAddress: input.customerAddress.trim(),
    note: input.note.trim(),
    subtotal,
    shippingAmount,
    totalAmount: subtotal + shippingAmount,
    paymentStatus: "unpaid",
    orderStatus: "new",
    createdAt,
    updatedAt: createdAt,
    items,
  };

  // Write order first. If a later stock write fails, the order is still visible
  // and the store owner can reconcile it manually.
  const orderTable = await ensureResourceTable(store, "orders");
  await writeResourceRow(
    store,
    "orders",
    valuesFor(store, "orders", orderData(order), orderTable.headers),
  );

  const productTable = await readResourceTable(store, "products", { optional: true });
  for (const line of lines) {
    const row = rowNumberFor(productTable, store, "products", "id", line.product.id);
    if (!row) continue;
    const next = {
      ...line.product,
      stock: line.product.stock - line.quantity,
      updatedAt: createdAt,
    };
    await writeResourceRow(
      store,
      "products",
      valuesFor(store, "products", productData(next), productTable.headers),
      row.rowNumber,
    );
    await appendInventoryLog(
      store,
      next,
      -line.quantity,
      "Захиалга",
      orderNumber,
      "Public website",
    );
  }

  await upsertCustomerForOrder(store, order);
  return order;
}

function connectionErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const message = String((error as { userMessage?: unknown }).userMessage ?? "");
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Google Sheets холболтын алдаа";
}

function mergeSheetsInput(
  record: StoreRecord,
  input: StoreSheetsInput,
): StoreSheetsConfig {
  const spreadsheetId = extractSpreadsheetId(
    input.spreadsheetId || input.spreadsheetUrl,
  );
  return {
    ...record.sheets,
    spreadsheetId,
    spreadsheetUrl: input.spreadsheetUrl || spreadsheetUrl(spreadsheetId),
    tabs: { ...record.sheets.tabs, ...input.tabs },
    columns: input.columns
      ? cloneColumns(input.columns)
      : record.sheets.columns,
    connectionStatus: "unconfigured",
    lastCheckedAt: null,
    lastError: null,
  };
}

async function prepareStoreSheets(store: StoreRecord): Promise<StoreRecord> {
  for (const resource of Object.keys(DEFAULT_COLUMNS) as SheetResource[]) {
    await ensureResourceTable(store, resource);
  }
  const settingsTable = await readResourceTable(store, "settings");
  const mapping = mappingFor(store, "settings");
  const defaults = DEFAULT_COLUMNS.settings;
  const keyHeader = resolveHeader(settingsTable.headers, mapping, "key", defaults);
  const valueHeader = resolveHeader(settingsTable.headers, mapping, "value", defaults);
  if (keyHeader && valueHeader) {
    const existing = settingsTable.rows.find(
      (row) => row.values[keyHeader]?.trim().toLowerCase() === "settings",
    );
    if (!existing) {
      await writeResourceRow(store, "settings", {
        [keyHeader]: "settings",
        [valueHeader]: JSON.stringify(store.settings),
      });
    }
  }
  return store;
}

async function applyStoreSheets(
  record: StoreRecord,
  input: StoreSheetsInput,
  options: { failOnError: boolean },
): Promise<StoreRecord> {
  const mode = sheetsMode();
  const merged = mergeSheetsInput(record, input);
  const registry = getStoreRegistry();

  if (mode === "google" && !merged.spreadsheetId) {
    throw new GoogleSheetsError("Spreadsheet ID is required", {
      code: "missing_spreadsheet_id",
      userMessage: "Google Sheets горимд Spreadsheet ID заавал шаардлагатай.",
    });
  }

  await registry.updateSheets(record.id, merged);
  invalidate(record.id);

  try {
    const store = await requireStore(record.id);
    await prepareStoreSheets(store);
    return await registry.updateSheets(record.id, {
      ...store.sheets,
      connectionStatus: mode === "google" ? "connected" : "local",
      lastCheckedAt: nowIso(),
      lastSyncAt: nowIso(),
      lastError: null,
    });
  } catch (error) {
    const failed = await registry.updateSheets(record.id, {
      ...merged,
      connectionStatus: "error",
      lastCheckedAt: nowIso(),
      lastError: connectionErrorMessage(error),
    });
    if (options.failOnError) throw error;
    return failed;
  }
}

export const googleSheetsRepository: Repository = {
  get mode() {
    return sheetsMode();
  },

  async listStores(filters: StoreFilters): Promise<Paginated<Store>> {
    const records = await getStoreRegistry().list();
    let rows = await mapLimit(records, 4, hydrateStore);
    const search = filters.search?.trim() ?? "";
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((store) =>
        [
          store.name,
          store.slug,
          store.id,
          store.ownerName,
          store.ownerEmail,
          store.email,
          store.phone,
          store.primaryDomain ?? "",
        ].some((value) => value.toLowerCase().includes(needle)),
      );
    }
    if (filters.status && filters.status !== "all") {
      rows = rows.filter((store) => store.status === filters.status);
    }
    if (filters.businessType) {
      rows = rows.filter((store) => store.businessType === filters.businessType);
    }
    const sort = filters.sort ?? "newest";
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "revenue") return b.revenue - a.revenue;
      if (sort === "orders") return b.orderCount - a.orderCount;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async getStore(idOrSlug: string): Promise<Store | null> {
    const record = await getStoreRegistry().get(idOrSlug);
    if (!record) return null;
    return hydrateStore(record);
  },

  async listStoreOptions(): Promise<StoreOption[]> {
    const records = await getStoreRegistry().list();
    return records
      .map((record) => ({
        id: record.id,
        name: record.name,
        slug: record.slug,
        status: record.status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async createStore(input: CreateStoreInput): Promise<Store> {
    const registry = getStoreRegistry();
    const mode = sheetsMode();
    if (
      mode === "google" &&
      !extractSpreadsheetId(
        input.sheets?.spreadsheetId || input.sheets?.spreadsheetUrl || "",
      )
    ) {
      throw new GoogleSheetsError("Spreadsheet ID is required", {
        code: "missing_spreadsheet_id",
        userMessage:
          "Google Sheets горимд Google Spreadsheet URL эсвэл ID заавал шаардлагатай.",
      });
    }

    const record = await registry.create(input);
    const sheetsInput: StoreSheetsInput = input.sheets ?? {
      spreadsheetId: record.sheets.spreadsheetId,
      spreadsheetUrl: record.sheets.spreadsheetUrl,
      tabs: record.sheets.tabs,
      columns: record.sheets.columns,
    };

    try {
      const next = await applyStoreSheets(record, sheetsInput, {
        failOnError: true,
      });
      return hydrateStore(next);
    } catch (error) {
      // A store must never be left half-created with a broken spreadsheet
      // connection. Roll the registry record back and surface the real error.
      await registry.delete(record.id);
      invalidate(record.id);
      throw error;
    }
  },

  async updateStore(id: string, input: UpdateStoreInput): Promise<Store> {
    const record = await getStoreRegistry().update(id, input);
    if (input.sheets) {
      const next = await applyStoreSheets(record, input.sheets, {
        failOnError: true,
      });
      return hydrateStore(next);
    }
    return hydrateStore(record);
  },

  async updateStoreSheets(
    id: string,
    sheets: StoreSheetsInput,
  ): Promise<Store> {
    const record = await requireStore(id);
    const next = await applyStoreSheets(record, sheets, { failOnError: true });
    return hydrateStore(next);
  },

  async setStoreStatus(id: string, status: StoreStatus): Promise<void> {
    await getStoreRegistry().setStatus(id, status);
    invalidate(id);
  },

  async deleteStore(id: string): Promise<void> {
    await getStoreRegistry().delete(id);
    invalidate(id);
  },

  async platformStats(): Promise<PlatformStats> {
    const records = await getStoreRegistry().list();
    const data = await mapLimit(records, 4, async (record) => {
      const store = await hydrateStore(record);
      let products: Product[] = [];
      let orders: Order[] = [];
      try {
        [products, orders] = await Promise.all([
          readStoreProducts(record),
          readStoreOrders(record),
        ]);
      } catch {
        // Connection errors are surfaced on the store row.
      }
      return { store, products, orders };
    });
    const stores = data.map((entry) => entry.store);
    const products = data.flatMap((entry) => entry.products);
    const orders = data.flatMap((entry) => entry.orders);
    const domains: Domain[] = records.flatMap((record) =>
      record.domains.map((domain) => ({
        ...domain,
        storeName: record.name,
      })),
    );
    const base = computePlatformStats(stores, products, orders, domains);
    const lastSheetSyncAt =
      records
        .map((record) => record.sheets.lastSyncAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    return {
      ...base,
      unavailableStores: stores.filter(s=>s.sheets.connectionStatus==="error").map(s=>s.id),
      refreshedAt: new Date().toISOString(),
      currencies: [...new Set(stores.map(s=>s.currency))],
      connectedSheets: stores.filter((store) => store.sheets.connectionStatus === "connected").length,
      sheetErrors: stores.filter((store) => store.sheets.connectionStatus === "error").length,
      localSheets: stores.filter((store) => store.sheets.connectionStatus === "local").length,
      lastSheetSyncAt,
    };
  },

  async storeAnalytics(storeId: string, from?: string, to?: string): Promise<StoreAnalytics> {
    const record = await requireStore(storeId);
    const [orders, products, categories] = await Promise.all([
      readStoreOrders(record),
      readStoreProducts(record),
      readStoreCategories(record),
    ]);
    return computeStoreAnalytics(orders, products, categories, from, to);
  },

  async listCategories(storeId?: string): Promise<Category[]> {
    const records = storeId
      ? [await requireStore(storeId)]
      : await getStoreRegistry().list();
    const groups = await mapLimit(records, 4, async (record) => {
      try {
        return await readStoreCategories(record);
      } catch {
        return [];
      }
    });
    return groups.flat();
  },

  async getCategory(id: string): Promise<Category | null> {
    const categories = await this.listCategories();
    return categories.find((category) => category.id === id) ?? null;
  },

  async createCategory(input: CategoryInput): Promise<Category> {
    const store = await requireStore(input.storeId);
    const table = await ensureResourceTable(store, "categories");
    const category: Category = {
      id: newId("cat"),
      storeId: store.id,
      name: input.name,
      slug: slugify(input.slug || input.name) || newId("cat"),
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
      productCount: 0,
      createdAt: nowIso(),
    };
    await writeResourceRow(
      store,
      "categories",
      valuesFor(
        store,
        "categories",
        {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          imageUrl: category.imageUrl,
          sortOrder: category.sortOrder,
          createdAt: category.createdAt,
        },
        table.headers,
      ),
    );
    return category;
  },

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    const store = await requireStore(input.storeId);
    const table = await ensureResourceTable(store, "categories");
    const row = rowNumberFor(table, store, "categories", "id", id);
    if (!row) throw new Error("Ангилал олдсонгүй.");
    const existing = rowToCategory(store.id, row.values, table.headers, store.sheets.columns);
    if (!existing) throw new Error("Ангилал олдсонгүй.");
    const next: Category = {
      ...existing,
      name: input.name,
      slug: slugify(input.slug || input.name) || existing.slug,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    };
    await writeResourceRow(
      store,
      "categories",
      valuesFor(
        store,
        "categories",
        {
          id: next.id,
          name: next.name,
          slug: next.slug,
          description: next.description,
          imageUrl: next.imageUrl,
          sortOrder: next.sortOrder,
          createdAt: next.createdAt,
        },
        table.headers,
      ),
      row.rowNumber,
    );
    return next;
  },

  async deleteCategory(id: string): Promise<void> {
    const found = await findStoreForResource("categories", id, "id");
    if (!found) throw new Error("Ангилал олдсонгүй.");
    await deleteResourceRow(found.store, "categories", found.row.rowNumber);
    // Products keep their data but lose the deleted category reference.
    try {
      const table = await readResourceTable(found.store, "products", { optional: true });
      const mapping = mappingFor(found.store, "products");
      const defaults = DEFAULT_COLUMNS.products;
      for (const row of table.rows) {
        if (readField(row.values, table.headers, mapping, defaults, "categoryId") === id) {
          const values = valuesFor(
            found.store,
            "products",
            {
              ...Object.fromEntries(
                Object.entries(row.values).map(([key, value]) => [key, value]),
              ),
              [resolveHeader(table.headers, mapping, "categoryId", defaults) ?? "CategoryID"]: "",
            },
            table.headers,
          );
          await writeResourceRow(found.store, "products", values, row.rowNumber);
        }
      }
    } catch {
      // Category deletion still succeeds even if the products tab is broken.
    }
  },

  async listProducts(filters: ProductFilters): Promise<Paginated<Product>> {
    const records = filters.storeId
      ? [await requireStore(filters.storeId)]
      : await getStoreRegistry().list();
    const groups = await mapLimit(records, 4, async (record) => {
      try {
        return await readStoreProducts(record);
      } catch (error) {
        if (filters.storeId) throw error;
        return [];
      }
    });
    let rows = groups.flat();
    const search = filters.search?.trim() ?? "";
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter(
        (product) =>
          product.name.toLowerCase().includes(needle) ||
          product.sku.toLowerCase().includes(needle) ||
          product.slug.toLowerCase().includes(needle),
      );
    }
    if (filters.categoryId) {
      rows = rows.filter((product) => product.categoryId === filters.categoryId);
    }
    if (filters.status === "active") rows = rows.filter((product) => product.isActive);
    if (filters.status === "inactive") rows = rows.filter((product) => !product.isActive);
    if (filters.stock === "in") rows = rows.filter((product) => product.stock > 0);
    if (filters.stock === "low") {
      rows = rows.filter(
        (product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD,
      );
    }
    if (filters.stock === "out") rows = rows.filter((product) => product.stock <= 0);
    const sort = filters.sort ?? "newest";
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "stock_asc") return a.stock - b.stock;
      if (sort === "stock_desc") return b.stock - a.stock;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async getProduct(id: string): Promise<Product | null> {
    const records = await getStoreRegistry().list();
    for (const record of records) {
      try {
        const products = await readStoreProducts(record);
        const product = products.find((entry) => entry.id === id);
        if (product) return product;
      } catch {
        // Continue searching other stores.
      }
    }
    return null;
  },

  async getProductBySlug(storeId: string, slug: string): Promise<Product | null> {
    const store = await requireStore(storeId);
    const products = await readStoreProducts(store);
    const decoded = slug.toLowerCase();
    return (
      products.find((product) => product.slug.toLowerCase() === decoded) ??
      products.find((product) => product.id === slug) ??
      null
    );
  },

  async createProduct(input: ProductInput): Promise<Product> {
    const store = await requireStore(input.storeId);
    const table = await ensureResourceTable(store, "products");
    const createdAt = nowIso();
    const product: Product = {
      id: newId("prd"),
      storeId: store.id,
      name: input.name,
      slug: slugify(input.slug || input.name) || newId("prd"),
      description: input.description,
      price: input.price,
      salePrice: input.salePrice,
      stock: input.stock,
      sku: input.sku,
      categoryId: input.categoryId || null,
      categoryName: null,
      images: input.images,
      variants: input.variants,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      isNew: input.isNew,
      createdAt,
      updatedAt: createdAt,
    };
    await writeResourceRow(
      store,
      "products",
      valuesFor(store, "products", productData(product), table.headers),
    );
    if (product.stock !== 0) {
      await appendInventoryLog(
        store,
        product,
        product.stock,
        "Шинэ бараа нэмэгдэл",
        "Анхны үлдэгдэл",
        "AXORA Super Admin",
      );
    }
    return product;
  },

  async updateProduct(id: string, input: ProductInput): Promise<Product> {
    const store = await requireStore(input.storeId);
    const table = await ensureResourceTable(store, "products");
    const row = rowNumberFor(table, store, "products", "id", id);
    if (!row) throw new Error("Бүтээгдэхүүн олдсонгүй.");
    const existing = rowToProduct(
      store.id,
      row.values,
      table.headers,
      store.sheets.columns,
      new Map(),
    );
    if (!existing) throw new Error("Бүтээгдэхүүн олдсонгүй.");
    const next: Product = {
      ...existing,
      name: input.name,
      slug: slugify(input.slug || input.name) || existing.slug,
      description: input.description,
      price: input.price,
      salePrice: input.salePrice,
      stock: input.stock,
      sku: input.sku,
      categoryId: input.categoryId || null,
      images: input.images,
      variants: input.variants,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      isNew: input.isNew,
      updatedAt: nowIso(),
    };
    await writeResourceRow(
      store,
      "products",
      valuesFor(store, "products", productData(next), table.headers),
      row.rowNumber,
    );
    if (next.stock !== existing.stock) {
      await appendInventoryLog(
        store,
        next,
        next.stock - existing.stock,
        "Гар аргаар засвар",
        "Бүтээгдэхүүн засах",
        "AXORA Super Admin",
      );
    }
    return next;
  },

  async deleteProduct(id: string): Promise<void> {
    const found = await findStoreForResource("products", id, "id");
    if (!found) throw new Error("Бүтээгдэхүүн олдсонгүй.");
    await deleteResourceRow(found.store, "products", found.row.rowNumber);
  },

  async bulkUpdateProducts(
    ids: string[],
    patch: { isActive?: boolean; delete?: boolean },
  ): Promise<void> {
    for (const id of ids) {
      const product = await this.getProduct(id);
      if (!product) continue;
      if (patch.delete) {
        await this.deleteProduct(id);
      } else if (patch.isActive !== undefined) {
        await this.updateProduct(id, {
          storeId: product.storeId,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          salePrice: product.salePrice,
          stock: product.stock,
          sku: product.sku,
          categoryId: product.categoryId,
          images: product.images,
          variants: product.variants,
          isActive: patch.isActive,
          isFeatured: product.isFeatured,
          isNew: product.isNew,
        });
      }
    }
  },

  async listOrders(filters: OrderFilters): Promise<Paginated<Order>> {
    const records = filters.storeId
      ? [await requireStore(filters.storeId)]
      : await getStoreRegistry().list();
    const groups = await mapLimit(records, 4, async (record) => {
      try {
        return await readStoreOrders(record);
      } catch (error) {
        if (filters.storeId) throw error;
        return [];
      }
    });
    let rows = groups.flat();
    const search = filters.search?.trim() ?? "";
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((order) =>
        [order.orderNumber, order.customerName, order.customerPhone, order.customerEmail]
          .some((value) => value.toLowerCase().includes(needle)),
      );
    }
    if (filters.orderStatus && filters.orderStatus !== "all") {
      rows = rows.filter((order) => order.orderStatus === filters.orderStatus);
    }
    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      rows = rows.filter((order) => order.paymentStatus === filters.paymentStatus);
    }
    if (filters.from) {
      const start = new Date(`${filters.from}T00:00:00`).getTime();
      rows = rows.filter((order) => new Date(order.createdAt).getTime() >= start);
    }
    if (filters.to) {
      const end = new Date(`${filters.to}T23:59:59`).getTime();
      rows = rows.filter((order) => new Date(order.createdAt).getTime() <= end);
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async getOrder(id: string): Promise<Order | null> {
    const found = await findStoreForResource("orders", id, "id");
    if (!found) return null;
    return rowToOrder(
      found.store.id,
      found.store.name,
      found.row.values,
      (await readResourceTable(found.store, "orders")).headers,
      found.store.sheets.columns,
    );
  },

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const found = await findStoreForResource("orders", id, "id");
    if (!found) throw new Error("Захиалга олдсонгүй.");
    const table = await readResourceTable(found.store, "orders");
    const existing = rowToOrder(
      found.store.id,
      found.store.name,
      found.row.values,
      table.headers,
      found.store.sheets.columns,
    );
    if (!existing) throw new Error("Захиалга олдсонгүй.");
    const next: Order = { ...existing, orderStatus: status, updatedAt: nowIso() };
    await writeResourceRow(
      found.store,
      "orders",
      valuesFor(found.store, "orders", orderData(next), table.headers),
      found.row.rowNumber,
    );
    if (status === "cancelled" && existing.orderStatus !== "cancelled") {
      await restoreStockForOrder(found.store, existing, "Захиалга цуцлагдсан");
    }
  },

  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<void> {
    const found = await findStoreForResource("orders", id, "id");
    if (!found) throw new Error("Захиалга олдсонгүй.");
    const table = await readResourceTable(found.store, "orders");
    const existing = rowToOrder(
      found.store.id,
      found.store.name,
      found.row.values,
      table.headers,
      found.store.sheets.columns,
    );
    if (!existing) throw new Error("Захиалга олдсонгүй.");
    await writeResourceRow(
      found.store,
      "orders",
      valuesFor(
        found.store,
        "orders",
        orderData({ ...existing, paymentStatus: status, updatedAt: nowIso() }),
        table.headers,
      ),
      found.row.rowNumber,
    );
  },

  async createOrder(input: CheckoutInput): Promise<Order> {
    return createStoreOrder(input);
  },

  async listCustomers(filters: CustomerFilters): Promise<Paginated<Customer>> {
    const records = filters.storeId
      ? [await requireStore(filters.storeId)]
      : await getStoreRegistry().list();
    const groups = await mapLimit(records, 4, async (record) => {
      try {
        const table = await readResourceTable(record, "customers", { optional: true });
        if (table.headers.length > 0 && table.rows.length > 0) {
          const mapping = mappingFor(record, "customers");
          const defaults = DEFAULT_COLUMNS.customers;
          return table.rows
            .map((row) => {
              const id = readField(row.values, table.headers, mapping, defaults, "id");
              const name = readField(row.values, table.headers, mapping, defaults, "name");
              if (!id || !name) return null;
              return {
                id,
                storeId: record.id,
                name,
                phone: readField(row.values, table.headers, mapping, defaults, "phone"),
                email: readField(row.values, table.headers, mapping, defaults, "email"),
                orderCount: toNumber(
                  readField(row.values, table.headers, mapping, defaults, "orderCount"),
                ),
                totalSpent: toNumber(
                  readField(row.values, table.headers, mapping, defaults, "totalSpent"),
                ),
                firstOrderAt: toIso(
                  readField(row.values, table.headers, mapping, defaults, "firstOrderAt"),
                ),
                lastOrderAt: toIso(
                  readField(row.values, table.headers, mapping, defaults, "lastOrderAt"),
                ),
              } satisfies Customer;
            })
            .filter((customer): customer is Customer => Boolean(customer));
        }
        return uniqueCustomers(await readStoreOrders(record));
      } catch {
        return [];
      }
    });
    let rows = groups.flat();
    const search = filters.search?.trim() ?? "";
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((customer) =>
        [customer.name, customer.phone, customer.email].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      );
    }
    rows.sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async listInventory(filters: InventoryFilters): Promise<Paginated<Product>> {
    const products = await this.listProducts({
      storeId: filters.storeId,
      search: filters.search,
      pageSize: 1000,
    });
    let rows = products.rows;
    if (filters.level === "low") {
      rows = rows.filter(
        (product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD,
      );
    }
    if (filters.level === "out") rows = rows.filter((product) => product.stock <= 0);
    rows = rows.slice().sort((a, b) => a.stock - b.stock);
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async listInventoryLogs(
    storeId: string | undefined,
    productId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<InventoryLog>> {
    const records = storeId
      ? [await requireStore(storeId)]
      : await getStoreRegistry().list();
    const groups = await mapLimit(records, 4, async (record) => {
      try {
        const table = await readResourceTable(record, "inventory", { optional: true });
        const mapping = mappingFor(record, "inventory");
        const defaults = DEFAULT_COLUMNS.inventory;
        return table.rows
          .map((row) => {
            const id = readField(row.values, table.headers, mapping, defaults, "id");
            if (!id) return null;
            return {
              id,
              storeId: record.id,
              productId: readField(row.values, table.headers, mapping, defaults, "productId"),
              productName: readField(
                row.values,
                table.headers,
                mapping,
                defaults,
                "productName",
              ),
              changeAmount: toNumber(
                readField(row.values, table.headers, mapping, defaults, "changeAmount"),
              ),
              balanceAfter: toNumber(
                readField(row.values, table.headers, mapping, defaults, "balanceAfter"),
              ),
              reason: readField(row.values, table.headers, mapping, defaults, "reason"),
              note: readField(row.values, table.headers, mapping, defaults, "note"),
              actorName: readField(
                row.values,
                table.headers,
                mapping,
                defaults,
                "actorName",
              ),
              createdAt: toIso(
                readField(row.values, table.headers, mapping, defaults, "createdAt"),
              ),
            } satisfies InventoryLog;
          })
          .filter((log): log is InventoryLog => Boolean(log));
      } catch {
        return [];
      }
    });
    let rows = groups.flat();
    if (productId) rows = rows.filter((log) => log.productId === productId);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, page, pageSize);
  },

  async adjustStock(
    productId: string,
    changeAmount: number,
    reason: string,
    note: string,
    actorName: string,
  ): Promise<void> {
    const product = await this.getProduct(productId);
    if (!product) throw new Error("Бүтээгдэхүүн олдсонгүй.");
    const nextStock = product.stock + changeAmount;
    if (nextStock < 0) throw new Error("Үлдэгдэл 0-ээс бага байж болохгүй.");
    await this.updateProduct(productId, {
      storeId: product.storeId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      salePrice: product.salePrice,
      stock: nextStock,
      sku: product.sku,
      categoryId: product.categoryId,
      images: product.images,
      variants: product.variants,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      isNew: product.isNew,
    });
    const store = await requireStore(product.storeId);
    await appendInventoryLog(
      store,
      { ...product, stock: nextStock },
      changeAmount,
      reason,
      note,
      actorName,
    );
  },

  async listDomains(filters: DomainFilters): Promise<Paginated<Domain>> {
    const records = await getStoreRegistry().list();
    let rows: Domain[] = records.flatMap((record) =>
      record.domains.map((domain) => ({ ...domain, storeName: record.name })),
    );
    if (filters.storeId) rows = rows.filter((domain) => domain.storeId === filters.storeId);
    const search = filters.search?.trim() ?? "";
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter(
        (domain) =>
          domain.domain.toLowerCase().includes(needle) ||
          domain.storeName.toLowerCase().includes(needle),
      );
    }
    if (filters.status && filters.status !== "all") {
      rows = rows.filter((domain) => domain.status === filters.status);
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, filters.page ?? 1, filters.pageSize ?? 20);
  },

  async getDomain(id: string): Promise<Domain | null> {
    const domains = await this.listDomains({ pageSize: 1000 });
    return domains.rows.find((domain) => domain.id === id) ?? null;
  },

  async createDomain(input: DomainInput): Promise<Domain> {
    const store = await requireStore(input.storeId);
    const domain = await getStoreRegistry().createDomain(
      store.id,
      input.domain,
      input.isPrimary,
    );
    return { ...domain, storeName: store.name };
  },

  async updateDomain(
    id: string,
    patch: Partial<
      Pick<
        Domain,
        | "domain"
        | "isPrimary"
        | "verificationStatus"
        | "sslStatus"
        | "status"
        | "lastCheckedAt"
        | "verifiedAt"
      >
    >,
  ): Promise<Domain> {
    const current = await this.getDomain(id);
    if (!current) throw new Error("Домэйн олдсонгүй.");
    const updated = await getStoreRegistry().updateDomain(current.storeId, id, patch);
    return { ...updated, storeName: current.storeName };
  },

  async deleteDomain(id: string): Promise<void> {
    const current = await this.getDomain(id);
    if (!current) throw new Error("Домэйн олдсонгүй.");
    await getStoreRegistry().deleteDomain(current.storeId, id);
  },

  async findStoreByDomain(domain: string): Promise<Store | null> {
    const record = await getStoreRegistry().findByDomain(normalizeDomain(domain));
    if (!record) return null;
    return hydrateStore(record);
  },

  async getStoreSettings(storeId: string): Promise<StoreSettingsData> {
    const record = await requireStore(storeId);
    return getStoreSettingsRecord(record);
  },

  async updateStoreSettings(
    storeId: string,
    settings: StoreSettingsData,
  ): Promise<void> {
    const record = await requireStore(storeId);
    await getStoreRegistry().updateSettings(storeId, settings);
    const table = await ensureResourceTable(record, "settings");
    const mapping = mappingFor(record, "settings");
    const defaults = DEFAULT_COLUMNS.settings;
    const keyHeader = resolveHeader(table.headers, mapping, "key", defaults);
    const valueHeader = resolveHeader(table.headers, mapping, "value", defaults);
    if (!keyHeader || !valueHeader) {
      throw new Error("Settings sheet-д Key/Value багана олдсонгүй.");
    }
    const existing = table.rows.find(
      (row) => row.values[keyHeader]?.trim().toLowerCase() === "settings",
    );
    await writeResourceRow(
      record,
      "settings",
      { [keyHeader]: "settings", [valueHeader]: JSON.stringify(settings) },
      existing?.rowNumber,
    );
  },

  async listAuditLogs(filters: AuditFilters): Promise<Paginated<AuditLog>> {
    const records = await getStoreRegistry().list();
    const names = new Map(records.map((record) => [record.id, record.name]));
    return listPlatformAuditLogs({ ...filters, storeId: storeScope.getStore() ?? filters.storeId }, names);
  },

  async recordAudit(input: AuditInput): Promise<void> {
    await recordPlatformAudit(input);
  },

  async getStorefront(storeSlug: string) {
    const record = await getStoreRegistry().get(storeSlug);
    if (!record || record.status !== "active") return null;
    const settings = await getStoreSettingsRecord(record);
    if (!settings.visibility.published) return null;
    const [products, categories] = await Promise.all([
      readStoreProducts(record),
      readStoreCategories(record),
    ]);
    const store = toStore(record, {
      products: products.length,
      orders: 0,
      customers: 0,
      revenue: 0,
    });
    return {
      store: { ...store, settings },
      products: products.filter((product) => product.isActive),
      categories,
    };
  },
};
