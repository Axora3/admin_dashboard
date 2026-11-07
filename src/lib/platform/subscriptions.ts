import "server-only";
import { checked, platformDb, platformEnabled } from "./db";
import { assertEntitlement, type Plan, type Subscription, type UsageKind } from "./subscription-rules";

/** Centralized subscription service. All limit checks happen server-side here. */
export async function subscriptionFor(storeId: string) {
  if (!platformEnabled()) return { subscription: null, plan: null };
  const sub = checked(await platformDb().from("platform_subscriptions").select("*").eq("store_id", storeId).maybeSingle());
  const plan = sub.data ? checked(await platformDb().from("platform_plans").select("*").eq("id", sub.data.plan_id).single()).data : null;
  return { subscription: sub.data as Subscription | null, plan: plan as Plan | null };
}

export async function enforceLimit(storeId: string, kind: Parameters<typeof assertEntitlement>[2], usage = 0, addition = 0, feature?: string) {
  const { subscription, plan } = await subscriptionFor(storeId);
  assertEntitlement(subscription, plan, kind, usage, addition, feature);
}

/** Current month start (YYYY-MM-01) in Asia/Ulaanbaatar, matching the order-limit window. */
export function currentMonthStart(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" }).slice(0, 7) + "-01";
}

/**
 * Real usage for one store. Each figure is null when its source cannot be read,
 * so the UI can show "unavailable" instead of an invented 0.
 */
export async function storeUsage(storeId: string): Promise<Record<UsageKind, number | null>> {
  const { getRepository } = await import("@/lib/data");
  const repo = getRepository();
  const db = platformDb();
  const [products, orders, admins, storage] = await Promise.all([
    repo.listProducts({ storeId, pageSize: 1 }).then(r => r.total).catch(() => null),
    repo.listOrders({ storeId, from: currentMonthStart(), pageSize: 1 }).then(r => r.total).catch(() => null),
    db.from("admin_assignments").select("user_id", { count: "exact", head: true }).eq("store_id", storeId).then(r => (r.error ? null : r.count ?? 0)),
    db.from("platform_backups").select("size_bytes").eq("store_id", storeId).eq("status", "success").then(r => (r.error ? null : (r.data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0))),
  ]);
  return { products, orders, admins, storage };
}

/**
 * Payment provider abstraction for a future phase (QPay, bank integrations).
 * No adapter is registered: subscriptions are assigned manually by Super Admin
 * and payment_status stays `not_integrated`. Never mark a payment as paid
 * without a verified provider webhook.
 */
export interface PaymentProviderAdapter {
  readonly provider: string;
  createInvoice(input: { storeId: string; planId: string; period: "monthly" | "yearly"; amount: number; currency: string }): Promise<{ externalReference: string; paymentUrl: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<{ eventId: string; externalReference: string; status: "pending" | "paid" | "failed" | "refunded" | "cancelled" }>;
}

const providers = new Map<string, PaymentProviderAdapter>();
export function registerPaymentProvider(adapter: PaymentProviderAdapter) { providers.set(adapter.provider, adapter); }
export function paymentProvider(name: string): PaymentProviderAdapter | null { return providers.get(name) ?? null; }
export function paymentIntegrationStatus(): "not_integrated" | "configured" { return providers.size ? "configured" : "not_integrated"; }
