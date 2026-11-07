import Link from "next/link";
import { checked, platformDb } from "@/lib/platform/db";
import { effectiveStatus, type Subscription } from "@/lib/platform/subscription-rules";
import { currentStoreHealth, summarizeStatuses, HEALTH_STATUSES, type HealthEvent } from "@/lib/platform/health-rules";
import { auditNotification } from "@/lib/platform/notification-rules";
import { isSheetsConfigured } from "@/lib/platform/health";
import { getStoreRegistry } from "@/lib/registry";
import { getRepository } from "@/lib/data";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";
import { HealthBadge } from "./health-badge";
import type { PlatformStats } from "@/lib/types";

const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "—";

type Activity = { at: string; kind: string; text: string; store: string | null };

/**
 * Platform-level (Supabase) overview for Super Admin. Every value comes from a
 * real record; a missing source is shown as unavailable rather than zero.
 */
export async function PlatformOverview({ stats }: { stats: PlatformStats }) {
  const db = platformDb();
  const [registry, subscriptions, admins, audit, health, backups, jobs, recentOrders] = await Promise.all([
    getStoreRegistry().list(),
    db.from("platform_subscriptions").select("*"),
    db.from("profiles").select("full_name,email,created_at,is_active").eq("role", "store_admin").order("created_at", { ascending: false }).limit(5),
    db.from("platform_audit").select("action,store_id,actor_name,metadata,created_at").order("created_at", { ascending: false }).limit(60),
    db.from("platform_health").select("*").eq("component", "sheets").order("checked_at", { ascending: false }).limit(500),
    db.from("platform_backups").select("store_id,status,kind,created_at,failure_code").order("created_at", { ascending: false }).limit(8),
    db.from("platform_jobs").select("status,started_at,failures").order("started_at", { ascending: false }).limit(5),
    getRepository().listOrders({ page: 1, pageSize: 6 }).catch(() => null),
  ]);
  for (const result of [subscriptions, admins, audit, health, backups, jobs]) checked(result);
  const subs = (subscriptions.data ?? []) as Subscription[];
  const events = (health.data ?? []) as HealthEvent[];
  const name = (id: string | null) => (id && registry.find(s => s.id === id)?.name) || id;

  const storeHealth = registry.map(store => ({ store, ...currentStoreHealth(events.filter(e => e.store_id === store.id), isSheetsConfigured(store)) }));
  const healthSummary = summarizeStatuses(storeHealth.map(h => h.status));
  const connectionProblems = storeHealth.filter(h => h.status === "error" || h.status === "disconnected").length;
  const states = subs.map(s => effectiveStatus(s));

  // Registration growth from the registry (last 6 months, Asia/Ulaanbaatar).
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const growth = months.map(month => ({ label: month.slice(5), value: registry.filter(s => new Date(Date.parse(s.createdAt) + 8 * 3600000).toISOString().slice(0, 7) === month).length }));

  const activity: Activity[] = [
    ...(audit.data ?? []).flatMap(a => {
      const notice = auditNotification(a.action, a.metadata ?? {});
      return notice ? [{ at: a.created_at, kind: notice.category, text: `${notice.title} · ${a.actor_name}`, store: name(a.store_id) }] : [];
    }),
    ...events.filter(e => e.status === "error").slice(0, 10).map(e => ({ at: e.checked_at, kind: "connection", text: `Google Sheets холболтын алдаа (${e.code})`, store: name(e.store_id) })),
    ...(backups.data ?? []).map(b => ({ at: b.created_at, kind: "backup", text: `Backup ${b.kind} · ${b.status}${b.failure_code ? ` (${b.failure_code})` : ""}`, store: name(b.store_id) })),
    ...(jobs.data ?? []).filter(j => j.status === "failed").map(j => ({ at: j.started_at, kind: "system", text: `Scheduled job амжилтгүй · ${j.failures} дэлгүүр`, store: null })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  const cards: Array<[string, React.ReactNode, string?]> = [
    ["Нийт дэлгүүр", registry.length],
    ["Идэвхтэй", registry.filter(s => s.status === "active").length],
    ["Идэвхгүй (архив)", registry.filter(s => s.status === "archived").length],
    ["Түр хаасан", registry.filter(s => s.status === "suspended").length],
    ["Холболтын асуудалтай", connectionProblems, connectionProblems ? "text-danger-600" : undefined],
    ["Идэвхтэй subscription", states.filter(s => ["active", "trial", "expiring"].includes(s)).length],
    ["Дууссан subscription", states.filter(s => s === "expired").length, states.includes("expired") ? "text-danger-600" : undefined],
    ["Багц оноогоогүй", registry.filter(s => !subs.some(x => x.store_id === s.id)).length],
  ];

  return <section className="mb-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Платформын тойм</h2>
        <p className="text-xs text-ink-500">Платформын статистик (Supabase registry, subscription, health). Дэлгүүрийн бизнесийн дүн доор — Google Sheets-ээс. Сүүлд шинэчилсэн: {fmt(stats.refreshedAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2">{[["System Health", "/admin/system-health"], ["Мэдэгдэл", "/admin/notifications"], ["Subscriptions", "/admin/subscriptions"], ["Backup & Recovery", "/admin/backups"]].map(([label, href]) => <Link key={href} className="rounded-xl border bg-white px-3 py-1.5 text-xs font-medium text-brand-700" href={href}>{label} →</Link>)}</div>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label, value, tone]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-ink-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone ?? "text-ink-900"}`}>{value}</p></div>)}</div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader title="Google Sheets холболтын эрүүл мэнд" description="Дэлгүүр бүрийн сүүлийн бодит шалгалтаар" /><CardContent className="space-y-2">
        {HEALTH_STATUSES.map(s => <div key={s} className="flex items-center justify-between text-sm"><HealthBadge status={s} /><span className="font-medium">{healthSummary[s]}</span></div>)}
        {!registry.length && <p className="text-sm text-ink-500">Дэлгүүр бүртгэгдээгүй.</p>}
      </CardContent></Card>
      <Card><CardHeader title="Шинэ дэлгүүрийн бүртгэл" description="Сүүлийн 6 сар" /><CardContent><BarChart data={growth} height={150} valueLabel={v => `${v} дэлгүүр`} /></CardContent></Card>
      <Card><CardHeader title="Subscription багцын хуваарилалт" /><CardContent className="space-y-2">
        {["basic", "pro", "business"].map(id => <p key={id} className="flex justify-between text-sm"><span className="capitalize">{id}</span><span className="font-medium">{subs.filter(s => s.plan_id === id).length}</span></p>)}
        {["trial", "expiring", "suspended", "cancelled"].map(st => <p key={st} className="flex justify-between text-xs text-ink-500"><span>{st}</span><span>{states.filter(s => s === st).length}</span></p>)}
      </CardContent></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Хамгийн идэвхтэй дэлгүүр" description="Захиалгын тоогоор (Sheets)" /><CardContent>
        {[...stats.topStores].sort((a, b) => b.orders - a.orders).slice(0, 5).map(s => <p key={s.id} className="flex justify-between border-t py-2 text-sm first:border-0"><span>{s.name}</span><span>{s.orders} захиалга</span></p>)}
        {!stats.topStores.length && <p className="text-sm text-ink-500">Захиалгын мэдээлэл алга.</p>}
      </CardContent></Card>
      <Card><CardHeader title="Сүүлийн захиалгууд" description="Бүх дэлгүүр" /><CardContent>
        {recentOrders === null ? <p className="text-sm text-warning-700">Захиалгын мэдээлэл ачаалагдсангүй.</p> : recentOrders.rows.map(o => <p key={o.id} className="flex justify-between border-t py-2 text-sm first:border-0"><span>{o.orderNumber} · {name(o.storeId)}</span><span className="text-ink-500">{fmt(o.createdAt)}</span></p>)}
        {recentOrders && !recentOrders.rows.length && <p className="text-sm text-ink-500">Захиалга бүртгэгдээгүй.</p>}
      </CardContent></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card><CardHeader title="Платформын сүүлийн үйл явдал" description="Дэлгүүр, Admin, subscription, Sheets алдаа, backup, системийн үйл явдал" /><CardContent>
        {activity.map((a, i) => <div key={i} className="flex flex-wrap justify-between gap-2 border-t py-2 text-sm first:border-0"><span><span className="mr-2 rounded bg-ink-100 px-1.5 py-0.5 text-2xs uppercase text-ink-600">{a.kind}</span>{a.text}{a.store ? ` · ${a.store}` : ""}</span><span className="text-xs text-ink-500">{fmt(a.at)}</span></div>)}
        {!activity.length && <p className="text-sm text-ink-500">Үйл явдал бүртгэгдээгүй.</p>}
      </CardContent></Card>
      <Card><CardHeader title="Шинээр үүссэн Admin" /><CardContent>
        {admins.data?.map((a, i) => <p key={i} className="border-t py-2 text-sm first:border-0">{a.full_name || a.email} · {a.is_active ? "Идэвхтэй" : "Идэвхгүй"}<span className="block text-xs text-ink-500">{fmt(a.created_at)}</span></p>)}
        {!admins.data?.length && <p className="text-sm text-ink-500">Store Admin үүсээгүй.</p>}
        <p className="mt-3 text-xs text-ink-500">Сүүлийн scheduled check: {fmt(jobs.data?.[0]?.started_at)} · {jobs.data?.[0]?.status ?? "Ажиллаагүй"}</p>
      </CardContent></Card>
    </div>
  </section>;
}
