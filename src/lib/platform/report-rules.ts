import type { Order, Product } from "@/lib/types";

export type Granularity = "daily" | "weekly" | "monthly";
export const ORDER_STATUSES = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
export const LOW_STOCK_THRESHOLD = 5;

/** Calendar day in Asia/Ulaanbaatar (UTC+8, no DST). Empty string for invalid dates. */
export function localDay(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function bucketFor(day: string, group: Granularity): string {
  if (group === "monthly") return day.slice(0, 7);
  if (group === "weekly") {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  return day;
}

const isPaidRevenue = (o: Order) => o.paymentStatus === "paid" && o.orderStatus !== "cancelled";
const isValidOrder = (o: Order) => Boolean(localDay(o.createdAt)) && Number.isFinite(o.totalAmount) && o.totalAmount >= 0;
const customerKey = (o: Order) => o.customerPhone || o.customerEmail || o.customerName;

export function aggregateReport(orders: Order[], products: Product[], from: string, to: string, group: Granularity) {
  const valid = orders.filter(o => isValidOrder(o) && localDay(o.createdAt) >= from && localDay(o.createdAt) <= to);
  const paid = valid.filter(isPaidRevenue);

  const buckets = new Map<string, { label: string; orders: number; revenue: number }>();
  for (const o of valid) {
    const label = bucketFor(localDay(o.createdAt), group);
    const b = buckets.get(label) ?? { label, orders: 0, revenue: 0 };
    b.orders++;
    if (isPaidRevenue(o)) b.revenue += o.totalAmount;
    buckets.set(label, b);
  }

  const ranking = new Map<string, { id: string; name: string; quantity: number; revenue: number; orders: number }>();
  for (const order of paid) for (const item of order.items) {
    if (!Number.isFinite(item.quantity) || !Number.isFinite(item.unitPrice) || item.quantity < 0 || item.unitPrice < 0) continue;
    const key = item.productId ?? item.productName;
    const p = ranking.get(key) ?? { id: key, name: item.productName, quantity: 0, revenue: 0, orders: 0 };
    p.quantity += item.quantity;
    p.revenue += item.quantity * item.unitPrice;
    p.orders += 1;
    ranking.set(key, p);
  }
  const itemRevenue = [...ranking.values()].reduce((sum, p) => sum + p.revenue, 0);
  const ranked = [...ranking.values()].map(p => ({ ...p, share: itemRevenue ? p.revenue / itemRevenue : 0 }));

  // Customer activity: "new" = first-ever valid order (across all supplied orders) falls inside the range.
  const firstOrder = new Map<string, string>();
  for (const o of orders.filter(isValidOrder)) {
    const key = customerKey(o);
    if (!key) continue;
    const day = localDay(o.createdAt);
    if (!firstOrder.has(key) || day < firstOrder.get(key)!) firstOrder.set(key, day);
  }
  const perCustomer = new Map<string, number>();
  for (const o of valid) { const key = customerKey(o); if (key) perCustomer.set(key, (perCustomer.get(key) ?? 0) + 1); }
  const newCustomers = [...perCustomer.keys()].filter(k => { const d = firstOrder.get(k); return d !== undefined && d >= from && d <= to; }).length;

  const revenue = paid.reduce((sum, o) => sum + o.totalAmount, 0);
  const soldIds = new Set(ranked.map(p => p.id));
  return {
    orders: valid.length,
    paidOrders: paid.length,
    revenue,
    averageOrderValue: paid.length ? revenue / paid.length : 0,
    customers: perCustomer.size,
    customerActivity: {
      active: perCustomer.size,
      newCustomers,
      returning: [...perCustomer.values()].filter(n => n > 1).length,
      ordersPerCustomer: perCustomer.size ? valid.length / perCustomer.size : 0,
    },
    products: products.length,
    activeProducts: products.filter(p => p.isActive).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    lowStockProducts: products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock).slice(0, 10).map(p => ({ id: p.id, name: p.name, stock: p.stock })),
    unsoldProducts: products.filter(p => p.isActive && !soldIds.has(p.id)).length,
    pending: valid.filter(o => ["new", "confirmed", "processing"].includes(o.orderStatus)).length,
    completed: valid.filter(o => o.orderStatus === "delivered").length,
    cancelled: valid.filter(o => o.orderStatus === "cancelled").length,
    statusBreakdown: ORDER_STATUSES.map(status => ({ status, count: valid.filter(o => o.orderStatus === status).length })),
    buckets: [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label)),
    topProducts: [...ranked].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topByQuantity: [...ranked].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    recent: [...valid].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    invalidOrders: orders.filter(o => !isValidOrder(o)).length,
  };
}

export type StoreReport = ReturnType<typeof aggregateReport>;

/**
 * Platform comparison. Revenue is grouped per currency and never summed across
 * currencies; shares are computed within each currency.
 */
export function compareStores(reports: Array<{ id: string; name: string; currency: string; data: StoreReport }>) {
  const totals = new Map<string, { currency: string; revenue: number; orders: number; stores: number }>();
  for (const r of reports) {
    const t = totals.get(r.currency) ?? { currency: r.currency, revenue: 0, orders: 0, stores: 0 };
    t.revenue += r.data.revenue; t.orders += r.data.orders; t.stores += 1;
    totals.set(r.currency, t);
  }
  const rows = reports.map(r => {
    const t = totals.get(r.currency)!;
    return { id: r.id, name: r.name, currency: r.currency, orders: r.data.orders, revenue: r.data.revenue, averageOrderValue: r.data.averageOrderValue, customers: r.data.customers, revenueShare: t.revenue ? r.data.revenue / t.revenue : 0 };
  }).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  return { totals: [...totals.values()], rows, activeStores: rows.filter(r => r.orders > 0).length, idleStores: rows.filter(r => r.orders === 0).length };
}
