import type {
  Category,
  Domain,
  Order,
  OrderStatus,
  PlatformStats,
  Product,
  SeriesPoint,
  Store,
  StoreAnalytics,
} from "@/lib/types";
import { monthLabel } from "@/lib/format";

interface Bucket {
  label: string;
  start: Date;
  end: Date;
}

function monthBuckets(count: number): Bucket[] {
  const buckets: Bucket[] = [];
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(base);
    start.setMonth(base.getMonth() - i);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);
    buckets.push({ label: monthLabel(start.getMonth(), true), start, end });
  }
  return buckets;
}

function dayBuckets(count: number): Bucket[] {
  const buckets: Bucket[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(base);
    start.setDate(base.getDate() - i);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    buckets.push({
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      start,
      end,
    });
  }
  return buckets;
}

function inBucket(iso: string, bucket: Bucket) {
  const time = new Date(iso).getTime();
  return time >= bucket.start.getTime() && time < bucket.end.getTime();
}

function paid(orders: Order[]) {
  return orders.filter(
    (o) => o.orderStatus !== "cancelled" && o.paymentStatus === "paid",
  );
}

function customerCount(orders: Order[]) {
  const keys = new Set(
    orders.map((o) =>
      `${o.customerPhone || o.customerEmail || o.customerName}`.toLowerCase(),
    ),
  );
  return keys.size;
}

export function computePlatformStats(
  stores: Store[],
  products: Product[],
  orders: Order[],
  domains: Domain[],
): PlatformStats {
  const months = monthBuckets(6);
  const days = dayBuckets(14);
  const revenueOrders = paid(orders);
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const monthlySales: SeriesPoint[] = months.map((bucket) => ({
    label: bucket.label,
    value: revenueOrders
      .filter((o) => inBucket(o.createdAt, bucket))
      .reduce((sum, o) => sum + o.totalAmount, 0),
  }));

  const dailyOrders: SeriesPoint[] = days.map((bucket) => ({
    label: bucket.label,
    value: orders.filter((o) => inBucket(o.createdAt, bucket)).length,
  }));

  const storeGrowth: SeriesPoint[] = months.map((bucket) => ({
    label: bucket.label,
    value: stores.filter((s) => inBucket(s.createdAt, bucket)).length,
  }));

  const storeById = new Map(stores.map((s) => [s.id, s]));
  const productById = new Map(products.map((p) => [p.id, p]));

  const topStores = stores
    .map((store) => {
      const storeOrders = revenueOrders.filter((o) => o.storeId === store.id);
      return {
        id: store.id,
        name: store.name,
        revenue: storeOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        orders: orders.filter((o) => o.storeId === store.id).length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const productAgg = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    if (order.orderStatus === "cancelled") continue;
    for (const item of order.items) {
      if (!item.productId) continue;
      const agg = productAgg.get(item.productId) ?? { quantity: 0, revenue: 0 };
      agg.quantity += item.quantity;
      agg.revenue += item.quantity * item.unitPrice;
      productAgg.set(item.productId, agg);
    }
  }

  const topProducts = Array.from(productAgg.entries())
    .map(([id, agg]) => {
      const product = productById.get(id);
      return {
        id,
        name: product?.name ?? "Устсан бараа",
        storeName: product ? (storeById.get(product.storeId)?.name ?? "—") : "—",
        quantity: agg.quantity,
        revenue: agg.revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return {
    totalStores: stores.length,
    activeStores: stores.filter((s) => s.status === "active").length,
    suspendedStores: stores.filter((s) => s.status === "suspended").length,
    archivedStores: stores.filter((s) => s.status === "archived").length,
    totalProducts: products.length,
    totalOrders: orders.length,
    totalCustomers: customerCount(orders),
    totalRevenue,
    connectedDomains: domains.filter((d) => d.status === "active").length,
    totalDomains: domains.length,
    connectedSheets: 0,
    sheetErrors: 0,
    localSheets: 0,
    lastSheetSyncAt: null,
    monthlySales,
    dailyOrders,
    storeGrowth,
    topStores,
    topProducts,
    newStores: [...stores]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}

export function computeStoreAnalytics(
  inputOrders: Order[],
  products: Product[],
  categories: Category[],
  from?: string,
  to?: string,
): StoreAnalytics {
  let orders = inputOrders;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    orders = orders.filter((o) => new Date(o.createdAt) >= start);
  }
  if (to) {
    const end = new Date(`${to}T23:59:59`);
    orders = orders.filter((o) => new Date(o.createdAt) <= end);
  }

  const revenueOrders = paid(orders);
  const totalRevenue = revenueOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const months = monthBuckets(6);

  const salesSeries: SeriesPoint[] = months.map((bucket) => ({
    label: bucket.label,
    value: revenueOrders
      .filter((o) => inBucket(o.createdAt, bucket))
      .reduce((sum, o) => sum + o.totalAmount, 0),
  }));

  const ordersSeries: SeriesPoint[] = months.map((bucket) => ({
    label: bucket.label,
    value: orders.filter((o) => inBucket(o.createdAt, bucket)).length,
  }));

  const currentRevenue = salesSeries[salesSeries.length - 1]?.value ?? 0;
  const previousRevenue = salesSeries[salesSeries.length - 2]?.value ?? 0;
  const growth =
    previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : currentRevenue > 0
        ? 100
        : 0;

  const productById = new Map(products.map((p) => [p.id, p]));
  const productAgg = new Map<string, { quantity: number; revenue: number }>();
  const categoryAgg = new Map<string, number>();

  for (const order of orders) {
    if (order.orderStatus === "cancelled") continue;
    for (const item of order.items) {
      if (!item.productId) continue;
      const product = productById.get(item.productId);
      const agg = productAgg.get(item.productId) ?? { quantity: 0, revenue: 0 };
      agg.quantity += item.quantity;
      agg.revenue += item.quantity * item.unitPrice;
      productAgg.set(item.productId, agg);
      if (product?.categoryId) {
        categoryAgg.set(
          product.categoryId,
          (categoryAgg.get(product.categoryId) ?? 0) + item.quantity * item.unitPrice,
        );
      }
    }
  }

  const topProducts = Array.from(productAgg.entries())
    .map(([id, agg]) => ({
      id,
      name: productById.get(id)?.name ?? "Устсан бараа",
      quantity: agg.quantity,
      revenue: agg.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const topCategories = Array.from(categoryAgg.entries())
    .map(([id, revenue]) => ({
      id,
      name: categoryById.get(id)?.name ?? "Бусад",
      revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const statuses: OrderStatus[] = [
    "new",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  return {
    totalRevenue,
    totalOrders: orders.length,
    averageOrderValue:
      revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0,
    totalCustomers: customerCount(orders),
    salesSeries,
    ordersSeries,
    topProducts,
    topCategories,
    growth,
    statusBreakdown: statuses.map((status) => ({
      status,
      count: orders.filter((o) => o.orderStatus === status).length,
    })),
  };
}
