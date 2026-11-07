import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/server";
import { getStoreContext } from "@/lib/store-context";
import { getStoreRegistry } from "@/lib/registry";
import { checked, platformDb } from "@/lib/platform/db";
import { effectiveStatus, type Subscription } from "@/lib/platform/subscription-rules";
import { currentStoreHealth, summarizeStatuses, HEALTH_STATUSES, type HealthEvent } from "@/lib/platform/health-rules";
import { isSheetsConfigured } from "@/lib/platform/health";
import { AnalyticsReport } from "@/components/admin/analytics-report";
import { HealthBadge } from "@/components/admin/health-badge";

async function PlatformStatusStrip() {
  const db = platformDb();
  const [stores, subscriptions, health] = await Promise.all([
    getStoreRegistry().list(),
    db.from("platform_subscriptions").select("*"),
    db.from("platform_health").select("*").eq("component", "sheets").order("checked_at", { ascending: false }).limit(500),
  ]);
  const subs = (checked(subscriptions).data ?? []) as Subscription[];
  const events = (checked(health).data ?? []) as HealthEvent[];
  const statuses = stores.map(s => currentStoreHealth(events.filter(e => e.store_id === s.id), isSheetsConfigured(s)).status);
  const summary = summarizeStatuses(statuses);
  const states = subs.map(s => effectiveStatus(s));
  const box = "rounded-xl border bg-white p-4";
  return <div className="grid gap-3 md:grid-cols-3">
    <section className={box}><h2 className="mb-2 text-sm font-semibold">Дэлгүүрийн төлөв</h2>{(["active", "suspended", "archived"] as const).map(s => <p key={s} className="flex justify-between text-sm"><span>{{ active: "Идэвхтэй", suspended: "Түр хаасан", archived: "Идэвхгүй" }[s]}</span><span>{stores.filter(x => x.status === s).length}</span></p>)}</section>
    <section className={box}><h2 className="mb-2 text-sm font-semibold">Subscription</h2>{["basic", "pro", "business"].map(p => <p key={p} className="flex justify-between text-sm capitalize"><span>{p}</span><span>{subs.filter(s => s.plan_id === p).length}</span></p>)}<p className="mt-1 text-xs text-ink-500">Дууссан {states.filter(s => s === "expired").length} · Оноогоогүй {stores.length - subs.length}</p></section>
    <section className={box}><h2 className="mb-2 text-sm font-semibold">Google Sheets холболт</h2><div className="flex flex-wrap gap-2">{HEALTH_STATUSES.filter(s => summary[s]).map(s => <HealthBadge key={s} status={s} suffix={String(summary[s])} />)}{!stores.length && <span className="text-sm text-ink-500">Дэлгүүр алга</span>}</div><Link href="/admin/system-health" className="mt-2 block text-xs text-brand-700">System Health →</Link></section>
  </div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSuperAdmin();
  const query = await searchParams;
  const context = await getStoreContext();
  const storeId = query.storeId ?? context.storeId ?? undefined;
  return <div className="space-y-5">
    {!storeId && <PlatformStatusStrip />}
    {query.storeId && !context.storeId && <Link href="/admin/analytics" className="text-sm text-brand-700">← Платформын статистик</Link>}
    <AnalyticsReport query={query} storeId={storeId} basePath="/admin/analytics" />
  </div>;
}
