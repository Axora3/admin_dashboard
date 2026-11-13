// ---------------------------------------------------------------------------
// Google Sheets data architecture types.
//
// These types are server-side only. Spreadsheet IDs, sheet mappings and
// service-account credentials must never be sent to the browser.
// ---------------------------------------------------------------------------

export type SheetResource =
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "settings"
  | "inventory";

export type SheetsConnectionStatus =
  | "unconfigured"
  | "provisioning"
  | "connected"
  | "error"
  | "local";

export type SheetColumnMap = Record<string, string>;

export interface StoreSheetTabs {
  products: string;
  categories: string;
  orders: string;
  customers: string;
  settings: string;
  inventory: string;
}

export interface StoreSheetColumns {
  products: SheetColumnMap;
  categories: SheetColumnMap;
  orders: SheetColumnMap;
  customers: SheetColumnMap;
  settings: SheetColumnMap;
  inventory: SheetColumnMap;
}

/** Full server-side sheet configuration. Never expose this object to clients. */
export interface StoreSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetName: string | null;
  tabs: StoreSheetTabs;
  columns: StoreSheetColumns;
  connectionStatus: SheetsConnectionStatus;
  lastSyncAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  /** Additive JSON registry fields; optional for existing v1 records. */
  schemaVersion?: number;
  enabledModules?: string[];
  lastSuccessfulSync?: string | null;
  configurationVersion?: number;
}

/** Safe subset attached to the public Store object. */
export interface StoreSheetsMeta {
  connectionStatus: SheetsConnectionStatus;
  lastSyncAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  spreadsheetName: string | null;
  /** Tab names are not secret and are needed to edit the mapping. */
  tabs: StoreSheetTabs;
  /** Column mapping is not secret and is needed to edit the mapping. */
  columns: StoreSheetColumns;
  schemaVersion: number;
  enabledModules: string[];
  lastSuccessfulSync: string | null;
  configurationVersion: number;
}

export interface StoreSheetsInput {
  spreadsheetId: string;
  spreadsheetUrl: string;
  tabs: StoreSheetTabs;
  columns: StoreSheetColumns;
}

export interface SheetInspectionTab {
  tab: string;
  exists: boolean;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
  missingRequired: string[];
  error: string | null;
}

export interface SheetInspectionResult {
  ok: boolean;
  message?: string;
  spreadsheetId?: string;
  spreadsheetName?: string | null;
  tabs?: string[];
  inspected?: Record<SheetResource, SheetInspectionTab>;
  suggestedColumns?: StoreSheetColumns;
}

export const DEFAULT_TABS: StoreSheetTabs = {
  products: "Products",
  categories: "Categories",
  orders: "Orders",
  customers: "Customers",
  settings: "Settings",
  inventory: "InventoryLogs",
};

/**
 * Default header names. These are also used as a fallback when a sheet does
 * not have an explicit column mapping, which makes existing sheets usable
 * without a migration step.
 */
export const DEFAULT_COLUMNS: StoreSheetColumns = {
  products: {
    id: "ID",
    name: "Name",
    slug: "Slug",
    description: "Description",
    price: "Price",
    salePrice: "SalePrice",
    stock: "Stock",
    sku: "SKU",
    categoryId: "CategoryID",
    images: "Images",
    variants: "Variants",
    isActive: "IsActive",
    isFeatured: "IsFeatured",
    isNew: "IsNew",
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
  },
  categories: {
    id: "ID",
    name: "Name",
    slug: "Slug",
    description: "Description",
    imageUrl: "ImageURL",
    sortOrder: "SortOrder",
    createdAt: "CreatedAt",
  },
  orders: {
    id: "ID",
    orderNumber: "OrderNumber",
    customerName: "CustomerName",
    customerPhone: "CustomerPhone",
    customerEmail: "CustomerEmail",
    customerAddress: "CustomerAddress",
    note: "Note",
    subtotal: "Subtotal",
    shippingAmount: "ShippingAmount",
    totalAmount: "TotalAmount",
    paymentStatus: "PaymentStatus",
    orderStatus: "OrderStatus",
    delivery: "Delivery",
    items: "Items",
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
  },
  customers: {
    id: "ID",
    name: "Name",
    phone: "Phone",
    email: "Email",
    orderCount: "OrderCount",
    totalSpent: "TotalSpent",
    firstOrderAt: "FirstOrderAt",
    lastOrderAt: "LastOrderAt",
  },
  settings: {
    key: "Key",
    value: "Value",
  },
  inventory: {
    id: "ID",
    productId: "ProductID",
    productName: "ProductName",
    changeAmount: "ChangeAmount",
    balanceAfter: "BalanceAfter",
    reason: "Reason",
    note: "Note",
    actorName: "ActorName",
    createdAt: "CreatedAt",
  },
};

export const REQUIRED_COLUMNS: Record<SheetResource, string[]> = {
  products: ["id", "name", "price", "stock"],
  categories: ["id", "name"],
  orders: ["id", "orderNumber", "customerName", "totalAmount", "orderStatus", "createdAt"],
  customers: ["id", "name"],
  settings: ["key", "value"],
  inventory: ["id", "productId", "changeAmount", "createdAt"],
};

export const RESOURCE_LABELS: Record<SheetResource, string> = {
  products: "Бүтээгдэхүүн",
  categories: "Ангилал",
  orders: "Захиалга",
  customers: "Харилцагч",
  settings: "Тохиргоо",
  inventory: "Үлдэгдлийн лог",
};

export function defaultSheetsConfig(): StoreSheetsConfig {
  return {
    spreadsheetId: "",
    spreadsheetUrl: "",
    spreadsheetName: null,
    tabs: { ...DEFAULT_TABS },
    columns: cloneColumns(DEFAULT_COLUMNS),
    connectionStatus: "unconfigured",
    lastSyncAt: null,
    lastCheckedAt: null,
    lastError: null,
    schemaVersion: 1,
    enabledModules: ["products", "categories", "orders", "customers", "inventory", "settings"],
    lastSuccessfulSync: null,
    configurationVersion: 1,
  };
}

export function cloneColumns(columns: StoreSheetColumns): StoreSheetColumns {
  return {
    products: { ...columns.products },
    categories: { ...columns.categories },
    orders: { ...columns.orders },
    customers: { ...columns.customers },
    settings: { ...columns.settings },
    inventory: { ...columns.inventory },
  };
}

export function safeSheetsMeta(config: StoreSheetsConfig): StoreSheetsMeta {
  return {
    connectionStatus: config.connectionStatus,
    lastSyncAt: config.lastSyncAt,
    lastCheckedAt: config.lastCheckedAt,
    lastError: config.lastError,
    spreadsheetName: config.spreadsheetName,
    tabs: { ...config.tabs },
    columns: cloneColumns(config.columns),
    schemaVersion: config.schemaVersion ?? 1,
    enabledModules: [...(config.enabledModules ?? ["products", "categories", "orders", "customers", "inventory", "settings"])],
    lastSuccessfulSync: config.lastSuccessfulSync ?? config.lastSyncAt,
    configurationVersion: config.configurationVersion ?? 1,
  };
}

export function extractSpreadsheetId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return value;
}

export function spreadsheetUrl(id: string): string {
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "";
}
