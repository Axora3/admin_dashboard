import type {
  Category,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductVariant,
} from "@/lib/types";
import {
  DEFAULT_COLUMNS,
  REQUIRED_COLUMNS,
  type SheetColumnMap,
  type SheetResource,
  type StoreSheetColumns,
} from "./types";

export interface SheetTable {
  headers: string[];
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
}

export function tableFromValues(values: unknown[][]): SheetTable {
  const [headerRow = [], ...dataRows] = values;
  const headers = headerRow.map((value) => String(value ?? "").trim());
  const rows = dataRows
    .map((row, index) => {
      const record: Record<string, string> = {};
      let hasValue = false;
      headers.forEach((header, columnIndex) => {
        if (!header) return;
        const raw = row[columnIndex];
        const value =
          raw === null || raw === undefined ? "" : String(raw).trim();
        record[header] = value;
        if (value) hasValue = true;
      });
      return { rowNumber: index + 2, values: record, hasValue };
    })
    .filter((row) => row.hasValue)
    .map(({ rowNumber, values: record }) => ({ rowNumber, values: record }));
  return { headers, rows };
}

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

export function findHeader(headers: string[], name: string): string | null {
  if (!name) return null;
  const exact = headers.find((header) => header === name);
  if (exact) return exact;
  const normalized = normalizeHeader(name);
  return headers.find((header) => normalizeHeader(header) === normalized) ?? null;
}

export function resolveHeader(
  headers: string[],
  mapping: SheetColumnMap,
  field: string,
  defaults: SheetColumnMap,
): string | null {
  return (
    findHeader(headers, mapping[field] ?? "") ??
    findHeader(headers, defaults[field] ?? "") ??
    null
  );
}

export function readField(
  row: Record<string, string>,
  headers: string[],
  mapping: SheetColumnMap,
  defaults: SheetColumnMap,
  field: string,
): string {
  const header = resolveHeader(headers, mapping, field, defaults);
  if (!header) return "";
  return row[header] ?? "";
}

export function requiredMissing(
  headers: string[],
  mapping: SheetColumnMap,
  resource: SheetResource,
): string[] {
  const defaults = DEFAULT_COLUMNS[resource];
  return REQUIRED_COLUMNS[resource].filter(
    (field) => !resolveHeader(headers, mapping, field, defaults),
  );
}

export function autoMapColumns(
  headers: string[],
  resource: SheetResource,
  current?: SheetColumnMap,
): SheetColumnMap {
  const defaults = DEFAULT_COLUMNS[resource];
  const result: SheetColumnMap = { ...(current ?? {}) };
  for (const [field, defaultHeader] of Object.entries(defaults)) {
    if (findHeader(headers, result[field] ?? "")) continue;
    const match =
      findHeader(headers, defaultHeader) ??
      findHeader(headers, field) ??
      findHeader(headers, field.replace(/([A-Z])/g, " $1"));
    if (match) result[field] = match;
  }
  return result;
}

export function toNumber(value: string, fallback = 0): number {
  if (!value) return fallback;
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toInteger(value: string, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

export function toBool(value: string, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "тийм", "идэвхтэй"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "үгүй", "идэвхгүй"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function toIso(value: string, fallback?: string): string {
  const defaultValue = fallback ?? new Date().toISOString();
  if (!value) return defaultValue;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    // Google Sheets serial date: days since 1899-12-30.
    if (serial > 20000 && serial < 90000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return defaultValue;
}

export function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseImages(value: string): string[] {
  if (!value) return [];
  const parsed = parseJson<unknown>(value, null);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => String(item)).filter(Boolean);
  }
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseVariants(value: string): ProductVariant[] {
  const parsed = parseJson<unknown>(value, null);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is { name?: unknown; values?: unknown } =>
        Boolean(item && typeof item === "object"),
      )
      .map((item) => ({
        name: String(item.name ?? ""),
        values: Array.isArray(item.values)
          ? item.values.map((entry) => String(entry))
          : [],
      }))
      .filter((variant) => variant.name);
  }
  return [];
}

export function parseItems(value: string): OrderItem[] {
  const parsed = parseJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: String(item.id ?? ""),
      orderId: String(item.orderId ?? ""),
      storeId: String(item.storeId ?? ""),
      productId: item.productId ? String(item.productId) : null,
      productName: String(item.productName ?? ""),
      quantity: toInteger(String(item.quantity ?? "0")),
      unitPrice: toNumber(String(item.unitPrice ?? "0")),
    }));
}

export function serializeImages(images: string[]): string {
  return images.length ? JSON.stringify(images) : "";
}

export function serializeVariants(variants: ProductVariant[]): string {
  return variants.length ? JSON.stringify(variants) : "";
}

export function serializeItems(items: OrderItem[]): string {
  return items.length ? JSON.stringify(items) : "";
}

export function rowToProduct(
  storeId: string,
  row: Record<string, string>,
  headers: string[],
  columns: StoreSheetColumns,
  categoryNames: Map<string, string>,
): Product | null {
  const mapping = columns.products;
  const defaults = DEFAULT_COLUMNS.products;
  const id = readField(row, headers, mapping, defaults, "id");
  const name = readField(row, headers, mapping, defaults, "name");
  if (!id || !name) return null;
  const categoryId =
    readField(row, headers, mapping, defaults, "categoryId") || null;
  return {
    id,
    storeId,
    name,
    slug:
      readField(row, headers, mapping, defaults, "slug") ||
      id.toLowerCase(),
    description: readField(row, headers, mapping, defaults, "description"),
    price: toNumber(readField(row, headers, mapping, defaults, "price")),
    salePrice: (() => {
      const value = readField(row, headers, mapping, defaults, "salePrice");
      return value ? toNumber(value) : null;
    })(),
    stock: toInteger(readField(row, headers, mapping, defaults, "stock")),
    sku: readField(row, headers, mapping, defaults, "sku"),
    categoryId,
    categoryName: categoryId ? categoryNames.get(categoryId) ?? null : null,
    images: parseImages(readField(row, headers, mapping, defaults, "images")),
    variants: parseVariants(readField(row, headers, mapping, defaults, "variants")),
    isActive: toBool(readField(row, headers, mapping, defaults, "isActive"), true),
    isFeatured: toBool(
      readField(row, headers, mapping, defaults, "isFeatured"),
      false,
    ),
    isNew: toBool(readField(row, headers, mapping, defaults, "isNew"), false),
    createdAt: toIso(readField(row, headers, mapping, defaults, "createdAt")),
    updatedAt: toIso(readField(row, headers, mapping, defaults, "updatedAt")),
  };
}

export function rowToCategory(
  storeId: string,
  row: Record<string, string>,
  headers: string[],
  columns: StoreSheetColumns,
): Category | null {
  const mapping = columns.categories;
  const defaults = DEFAULT_COLUMNS.categories;
  const id = readField(row, headers, mapping, defaults, "id");
  const name = readField(row, headers, mapping, defaults, "name");
  if (!id || !name) return null;
  return {
    id,
    storeId,
    name,
    slug:
      readField(row, headers, mapping, defaults, "slug") || id.toLowerCase(),
    description: readField(row, headers, mapping, defaults, "description"),
    imageUrl:
      readField(row, headers, mapping, defaults, "imageUrl") || null,
    sortOrder: toInteger(
      readField(row, headers, mapping, defaults, "sortOrder"),
    ),
    productCount: 0,
    createdAt: toIso(readField(row, headers, mapping, defaults, "createdAt")),
  };
}

export function rowToOrder(
  storeId: string,
  storeName: string,
  row: Record<string, string>,
  headers: string[],
  columns: StoreSheetColumns,
): Order | null {
  const mapping = columns.orders;
  const defaults = DEFAULT_COLUMNS.orders;
  const id = readField(row, headers, mapping, defaults, "id");
  if (!id) return null;
  const orderNumber =
    readField(row, headers, mapping, defaults, "orderNumber") || id;
  const items = parseItems(readField(row, headers, mapping, defaults, "items")).map(
    (item) => ({
      ...item,
      id: item.id || `${id}_item`,
      orderId: id,
      storeId,
    }),
  );
  return {
    id,
    storeId,
    storeName,
    orderNumber,
    customerName: readField(row, headers, mapping, defaults, "customerName"),
    customerPhone: readField(row, headers, mapping, defaults, "customerPhone"),
    customerEmail: readField(row, headers, mapping, defaults, "customerEmail"),
    customerAddress: readField(
      row,
      headers,
      mapping,
      defaults,
      "customerAddress",
    ),
    note: readField(row, headers, mapping, defaults, "note"),
    subtotal: toNumber(readField(row, headers, mapping, defaults, "subtotal")),
    shippingAmount: toNumber(
      readField(row, headers, mapping, defaults, "shippingAmount"),
    ),
    totalAmount: toNumber(
      readField(row, headers, mapping, defaults, "totalAmount"),
    ),
    paymentStatus: normalizePaymentStatus(
      readField(row, headers, mapping, defaults, "paymentStatus"),
    ),
    orderStatus: normalizeOrderStatus(
      readField(row, headers, mapping, defaults, "orderStatus"),
    ),
    createdAt: toIso(readField(row, headers, mapping, defaults, "createdAt")),
    updatedAt: toIso(
      readField(row, headers, mapping, defaults, "updatedAt"),
      readField(row, headers, mapping, defaults, "createdAt"),
    ),
    items,
  };
}

export function normalizeOrderStatus(value: string): OrderStatus {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, OrderStatus> = {
    new: "new",
    шинэ: "new",
    confirmed: "confirmed",
    баталгаажсан: "confirmed",
    processing: "processing",
    бэлтгэж: "processing",
    shipped: "shipped",
    хүргэлтэд: "shipped",
    delivered: "delivered",
    хүргэгдсэн: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
    цуцлагдсан: "cancelled",
  };
  return map[normalized] ?? "new";
}

export function normalizePaymentStatus(value: string): PaymentStatus {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, PaymentStatus> = {
    unpaid: "unpaid",
    төлөгдөөгүй: "unpaid",
    pending: "pending",
    хүлээгдэж: "pending",
    paid: "paid",
    төлөгдсөн: "paid",
    refunded: "refunded",
    буцаагдсан: "refunded",
  };
  return map[normalized] ?? "unpaid";
}
