import type {
  AuditFilters,
  AuditLog,
  Category,
  CategoryInput,
  CheckoutInput,
  Customer,
  CustomerFilters,
  DeliveryDetails,
  Domain,
  DomainFilters,
  DomainInput,
  InventoryFilters,
  InventoryLog,
  Order,
  OrderFilters,
  OrderStatus,
  Paginated,
  PaymentStatus,
  PlatformStats,
  Product,
  ProductFilters,
  ProductInput,
  Store,
  StoreAnalytics,
  StoreFilters,
  StoreSettingsData,
  StoreStatus,
} from "@/lib/types";

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
}

export interface AuditInput {
  actorUserId: string | null;
  actorName: string;
  storeId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
}

export interface Repository {
  readonly mode: "google" | "local" | "supabase";

  // Stores
  listStores(filters: StoreFilters): Promise<Paginated<Store>>;
  getStore(idOrSlug: string): Promise<Store | null>;
  listStoreOptions(): Promise<StoreOption[]>;
  createStore(input: import("@/lib/types").CreateStoreInput): Promise<Store>;
  updateStore(
    id: string,
    input: import("@/lib/types").UpdateStoreInput,
  ): Promise<Store>;
  updateStoreSheets(
    id: string,
    sheets: import("@/lib/google/types").StoreSheetsInput,
  ): Promise<Store>;
  setStoreStatus(id: string, status: StoreStatus): Promise<void>;
  deleteStore(id: string): Promise<void>;

  // Analytics
  platformStats(): Promise<PlatformStats>;
  storeAnalytics(storeId: string, from?: string, to?: string): Promise<StoreAnalytics>;

  // Categories
  listCategories(storeId?: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | null>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Products
  listProducts(filters: ProductFilters): Promise<Paginated<Product>>;
  getProduct(id: string): Promise<Product | null>;
  getProductBySlug(storeId: string, slug: string): Promise<Product | null>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: ProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  bulkUpdateProducts(
    ids: string[],
    patch: { isActive?: boolean; delete?: boolean },
  ): Promise<void>;

  // Orders
  listOrders(filters: OrderFilters): Promise<Paginated<Order>>;
  getOrder(id: string, storeId?: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
  updateOrderDelivery(id: string, delivery: DeliveryDetails, storeId?: string): Promise<void>;
  updatePaymentStatus(id: string, status: PaymentStatus): Promise<void>;
  createOrder(input: CheckoutInput): Promise<Order>;

  // Customers
  listCustomers(filters: CustomerFilters): Promise<Paginated<Customer>>;

  // Inventory
  listInventory(filters: InventoryFilters): Promise<Paginated<Product>>;
  listInventoryLogs(
    storeId: string | undefined,
    productId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<Paginated<InventoryLog>>;
  adjustStock(
    productId: string,
    changeAmount: number,
    reason: string,
    note: string,
    actorName: string,
  ): Promise<void>;

  // Domains
  listDomains(filters: DomainFilters): Promise<Paginated<Domain>>;
  getDomain(id: string): Promise<Domain | null>;
  createDomain(input: DomainInput): Promise<Domain>;
  updateDomain(
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
  ): Promise<Domain>;
  deleteDomain(id: string): Promise<void>;
  findStoreByDomain(domain: string): Promise<Store | null>;

  // Store settings
  getStoreSettings(storeId: string): Promise<StoreSettingsData>;
  updateStoreSettings(
    storeId: string,
    settings: StoreSettingsData,
  ): Promise<void>;

  // Audit
  listAuditLogs(filters: AuditFilters): Promise<Paginated<AuditLog>>;
  recordAudit(input: AuditInput): Promise<void>;

  // Public storefront
  getStorefront(storeSlug: string): Promise<{
    store: Store;
    products: Product[];
    categories: Category[];
  } | null>;
}

export type { Paginated };
