// ---------------------------------------------------------------------------
// AXORA — domain types shared by the data layer, server actions and UI.
// ---------------------------------------------------------------------------

import type {
  StoreSheetsInput,
  StoreSheetsMeta,
} from "@/lib/google/types";

export type { StoreSheetsMeta } from "@/lib/google/types";

export type StoreStatus = "active" | "suspended" | "archived";
export type UserRole = "super_admin" | "store_admin" | "store_owner" | "store_staff";
export type MemberRole = "owner" | "manager" | "staff";
export type MemberStatus = "invited" | "active" | "disabled";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export type VerificationStatus = "unconnected" | "pending" | "verified" | "failed";
export type SslStatus = "none" | "provisioning" | "active" | "error";
export type DomainStatus =
  | "unconnected"
  | "pending"
  | "verified"
  | "ssl_pending"
  | "active"
  | "error";

export type ThemeStyle = "minimal" | "editorial" | "bold";

export interface StoreTheme {
  primary: string;
  accent: string;
  style: ThemeStyle;
}

export interface StoreSettingsData {
  social: {
    facebook: string;
    instagram: string;
  };
  theme: StoreTheme;
  shipping: {
    enabled: boolean;
    flatRate: number;
    freeOver: number;
    note: string;
  };
  payment: {
    codEnabled: boolean;
    bankTransferEnabled: boolean;
    bankAccount: string;
    note: string;
  };
  visibility: {
    published: boolean;
    showOutOfStock: boolean;
  };
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  logoUrl: string | null;
  status: StoreStatus;
  currency: string;
  language: string;
  phone: string;
  email: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  createdAt: string;
  updatedAt: string;
  primaryDomain: string | null;
  productCount: number;
  orderCount: number;
  customerCount: number;
  revenue: number;
  settings: StoreSettingsData;
  /** Safe Google Sheets connection metadata (no spreadsheet ID). */
  sheets: StoreSheetsMeta;
}

export interface StoreMember {
  id: string;
  storeId: string;
  userId: string | null;
  email: string;
  fullName: string;
  role: MemberRole;
  permissions: string[];
  status: MemberStatus;
  createdAt: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
  createdAt: string;
}

export interface ProductVariant {
  name: string;
  values: string[];
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  stock: number;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  images: string[];
  variants: ProductVariant[];
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  storeId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
}

/** Store business data; saved only in the owning store's Orders sheet. */
export interface DeliveryDetails {
  method: "store_delivery" | "pickup" | "courier";
  latitude: number | null;
  longitude: number | null;
  driverName: string;
  driverPhone: string;
  note: string;
}

export interface Order {
  id: string;
  storeId: string;
  storeName: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  note: string;
  subtotal: number;
  shippingAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  /** Older orders have no delivery details until an admin adds them. */
  delivery?: DeliveryDetails | null;
}

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  email: string;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface InventoryLog {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  changeAmount: number;
  balanceAfter: number;
  reason: string;
  note: string;
  actorName: string;
  createdAt: string;
}

export interface Domain {
  id: string;
  storeId: string;
  storeName: string;
  domain: string;
  isPrimary: boolean;
  verificationStatus: VerificationStatus;
  sslStatus: SslStatus;
  status: DomainStatus;
  verificationToken: string;
  expectedTarget: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorName: string;
  storeId: string | null;
  storeName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUser {
  siteRole?: "owner" | "editor" | "viewer";
  siteIds?: string[];
  storeId?: string | null;
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

export interface PlatformStats {
  unavailableStores?: string[];
  refreshedAt?: string;
  currencies?: string[];
  totalStores: number;
  activeStores: number;
  suspendedStores: number;
  archivedStores: number;
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  connectedDomains: number;
  totalDomains: number;
  connectedSheets: number;
  sheetErrors: number;
  localSheets: number;
  lastSheetSyncAt: string | null;
  monthlySales: SeriesPoint[];
  dailyOrders: SeriesPoint[];
  storeGrowth: SeriesPoint[];
  topStores: Array<{ id: string; name: string; revenue: number; orders: number }>;
  topProducts: Array<{
    id: string;
    name: string;
    storeName: string;
    quantity: number;
    revenue: number;
  }>;
  newStores: Store[];
}

export interface StoreAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  salesSeries: SeriesPoint[];
  ordersSeries: SeriesPoint[];
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  topCategories: Array<{ id: string; name: string; revenue: number }>;
  growth: number;
  statusBreakdown: Array<{ status: OrderStatus; count: number }>;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ProductFilters {
  storeId?: string;
  search?: string;
  categoryId?: string;
  stock?: "all" | "in" | "low" | "out";
  status?: "all" | "active" | "inactive";
  sort?: "newest" | "name" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc";
  page?: number;
  pageSize?: number;
}

export interface OrderFilters {
  storeId?: string;
  search?: string;
  orderStatus?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface StoreFilters {
  search?: string;
  status?: StoreStatus | "all";
  businessType?: string;
  sort?: "newest" | "name" | "revenue" | "orders";
  page?: number;
  pageSize?: number;
}

export interface InventoryFilters {
  storeId?: string;
  search?: string;
  level?: "all" | "low" | "out";
  page?: number;
  pageSize?: number;
}

export interface CustomerFilters {
  storeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditFilters {
  actorUserId?: string;
  storeId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface DomainFilters {
  storeId?: string;
  search?: string;
  status?: DomainStatus | "all";
  page?: number;
  pageSize?: number;
}

export interface CreateStoreInput {
  storeId?: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  domain: string;
  domainIsPrimary: boolean;
  status: StoreStatus;
  currency: string;
  language: string;
  theme: ThemeStyle;
  sheets?: StoreSheetsInput;
}

export type UpdateStoreInput = Partial<Omit<CreateStoreInput, "slug">> & {
  slug?: string;
};

export interface ProductInput {
  storeId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  stock: number;
  sku: string;
  categoryId: string | null;
  images: string[];
  variants: ProductVariant[];
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
}

export interface CategoryInput {
  storeId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface DomainInput {
  storeId: string;
  domain: string;
  isPrimary: boolean;
}

export interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  storeSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  note: string;
  items: CheckoutItemInput[];
  /** Customer-selected destination only; method and driver are server-owned. */
  delivery?: Pick<DeliveryDetails, "latitude" | "longitude">;
}
