import { requireSuperAdmin } from "@/lib/auth/server";
import { getStoreRegistry } from "@/lib/registry";
import { checked, platformDb } from "@/lib/platform/db";
import { effectiveStatus, usageLimit, FEATURE_CATALOG, STATUS_LABELS, type Plan, type Subscription, type UsageKind } from "@/lib/platform/subscription-rules";
import { storeUsage, paymentIntegrationStatus } from "@/lib/platform/subscriptions";
import { PlatformForm } from "@/components/admin/platform-form";

const cls = "w-full rounded-lg border p-2 text-sm";
const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "—";
const USAGE: Array<[UsageKind, string]> = [["products", "Бүтээгдэхүүн"], ["orders", "Энэ сарын захиалга"], ["admins", "Admin"], ["storage", "Backup storage"]];
const bytes = (v: number) => v >= 1048576 ? `${(v / 1048576).toFixed(1)} MB` : `${Math.round(v / 1024)} KB`;

export default async function Page() {
  await requireSuperAdmin();
  const db = platformDb();
  const [plans, subscriptions, history, stores, billing] = await Promise.all([
    db.from("platform_plans").select("*").order("id"),
    db.from("platform_subscriptions").select("*"),
    db.from("platform_subscription_history").select("*").order("created_at", { ascending: false }).limit(30),
    getStoreRegistry().list(),
    db.from("platform_billing_events").select("*").order("created_at", { ascending: false }).limit(30),
  ]);
  const list = (checked(plans).data ?? []) as Plan[];
  const subs = (checked(subscriptions).data ?? []) as Subscription[];
  checked(history);
  // Billing metadata table is added by migration 0007; report clearly if it has not been applied.
  const billingAvailable = !billing.error;
  const usage = new Map(await Promise.all(stores.map(async s => [s.id, await storeUsage(s.id)] as const)));
  const name = (id: string) => stores.find(s => s.id === id)?.name ?? id;

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Subscription & Plans</h1><p className="mt-2 text-sm text-ink-500">Багцыг Super Admin гараар онооно. Хязгаарыг сервер талд шалгана. Хоосон хязгаар = хязгааргүй; сарын захиалгын тоо Улаанбаатарын цагаар.</p>
      <p className="mt-2 inline-block rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">Төлбөрийн интеграци: {paymentIntegrationStatus() === "not_integrated" ? "холбогдоогүй — төлбөр хүлээн авахгүй, төлбөрийн амжилтыг зохиомлоор харуулахгүй" : "тохируулсан"}</p></header>

    <section className="space-y-3"><h2 className="font-semibold">Багцын тохиргоо</h2>
      <div className="grid gap-4 xl:grid-cols-3">{list.map(p => <details key={p.id} className="rounded-xl border bg-white p-5"><summary className="cursor-pointer"><span className="text-lg font-semibold">{p.name}</span><span className="ml-2 text-xs text-ink-500">{subs.filter(s => s.plan_id === p.id).length} дэлгүүр · {p.max_products ?? "∞"} бараа · {p.max_orders ?? "∞"} захиалга/сар</span></summary><div className="mt-4"><PlatformForm operation="plan.save"><input type="hidden" name="id" value={p.id} />
        {([["name", "Нэр"], ["description", "Тайлбар"], ["monthly_price", "Сарын үнэ (metadata)"], ["yearly_price", "Жилийн үнэ (metadata)"], ["max_products", "Бүтээгдэхүүний хязгаар"], ["max_orders", "Сарын захиалгын хязгаар"], ["max_admins", "Admin хязгаар"], ["storage_bytes", "Backup storage (bytes)"], ["duration_days", "Үргэлжлэх хоног"], ["support_level", "Support level"]] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<input className={cls} name={key} defaultValue={String(p[key] ?? "")} type={["name", "description", "support_level"].includes(key) ? "text" : "number"} min={0} /></label>)}
        <fieldset className="text-sm"><legend className="mb-1">Боломжууд</legend>{FEATURE_CATALOG.map(f => <label className="mr-3 inline-flex gap-2" key={f.id}><input name="features" value={f.id} type="checkbox" defaultChecked={p.features.includes(f.id)} />{f.label}</label>)}</fieldset>
      </PlatformForm></div></details>)}</div></section>

    <section className="space-y-4"><h2 className="font-semibold">Дэлгүүрийн subscription</h2>
      {stores.map(store => {
        const s = subs.find(x => x.store_id === store.id);
        const plan = s ? list.find(p => p.id === s.plan_id) ?? null : null;
        const state = s ? effectiveStatus(s) : null;
        const u = usage.get(store.id)!;
        return <section className="space-y-4 rounded-xl border bg-white p-5" key={store.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold">{store.name}</h3><p className="text-sm">{s ? <><strong>{plan?.name ?? s.plan_id}</strong> · <span className={state === "expired" || state === "suspended" || state === "cancelled" ? "text-danger-700" : state === "expiring" ? "text-warning-700" : "text-success-700"}>{STATUS_LABELS[state!]}</span> · Дуусах: {fmt(s.expires_at)}</> : <span className="text-ink-500">Багц оноогоогүй — хязгаар хэрэгжихгүй</span>}</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{USAGE.map(([kind, label]) => {
            const used = u[kind], limit = usageLimit(plan, kind);
            const ratio = used !== null && limit ? Math.min(1, used / limit) : 0;
            const show = (v: number) => kind === "storage" ? bytes(v) : String(v);
            return <div key={kind} className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 font-semibold">{used === null ? "Мэдээлэл алга" : show(used)} / {limit === null ? "∞" : show(limit)}</p>{limit !== null && used !== null && <div className="mt-2 h-1.5 rounded bg-ink-200"><div className={`h-1.5 rounded ${ratio >= 1 ? "bg-danger-500" : ratio >= 0.8 ? "bg-warning-500" : "bg-brand-500"}`} style={{ width: `${ratio * 100}%` }} /></div>}</div>;
          })}</div>
          <PlatformForm operation="subscription.save" label={s ? "Багц / төлөв өөрчлөх" : "Багц оноох"}><input type="hidden" name="storeId" value={store.id} /><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm">Багц<select name="planId" className={cls} defaultValue={s?.plan_id}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="grid gap-1 text-sm">Төлөв<select name="status" className={cls} defaultValue={s?.status ?? "trial"}>{["trial", "active", "suspended", "cancelled"].map(v => <option key={v} value={v}>{STATUS_LABELS[v as keyof typeof STATUS_LABELS]}</option>)}</select></label><label className="grid gap-1 text-sm">Дуусах огноо<input className={cls} name="expires" type="date" required defaultValue={s?.expires_at?.slice(0, 10)} /></label></div></PlatformForm>
          {s && <div className="flex flex-wrap items-end gap-4 border-t pt-4">
            <PlatformForm operation="subscription.extend" label="Хугацаа сунгах"><input type="hidden" name="storeId" value={store.id} /><label className="grid gap-1 text-sm">Хоног<input className={cls} name="days" type="number" min={1} max={3660} defaultValue={plan?.duration_days ?? 30} /></label></PlatformForm>
            {state !== "suspended" && <PlatformForm operation="subscription.suspend" label="Түдгэлзүүлэх"><input type="hidden" name="storeId" value={store.id} /></PlatformForm>}
            {(state === "suspended" || state === "cancelled") && <PlatformForm operation="subscription.reactivate" label="Сэргээх"><input type="hidden" name="storeId" value={store.id} /></PlatformForm>}
            <p className="text-xs text-ink-500">Төлбөр: {s.payment_status ?? "not_integrated"}{s.provider ? ` · ${s.provider}` : ""}</p>
          </div>}
        </section>;
      })}
      {!stores.length && <p className="rounded-xl border bg-white p-6 text-sm text-ink-500">Дэлгүүр бүртгэгдээгүй.</p>}
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Subscription түүх</h2>{history.data?.map(h => <details key={h.id} className="border-t py-3"><summary className="cursor-pointer text-sm">{name(h.store_id)} · {h.before_value?.plan_id ?? "—"}/{h.before_value?.status ?? "—"} → {h.after_value?.plan_id}/{h.after_value?.status} · {fmt(h.created_at)}</summary><pre className="overflow-auto p-3 text-xs">{JSON.stringify({ before: h.before_value, after: h.after_value }, null, 2)}</pre></details>)}{!history.data?.length && <p className="text-sm text-ink-500">Өөрчлөлт бүртгэгдээгүй.</p>}</section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Төлбөрийн түүх</h2>{!billingAvailable ? <p className="text-sm text-warning-700">Billing metadata хүснэгт байхгүй — 0007 migration-ийг ажиллуулна уу.</p> : billing.data?.length ? billing.data.map(b => <p key={b.id} className="border-t py-2 text-sm">{name(b.store_id)} · {b.provider} · {b.status} · {b.amount ?? "—"} {b.currency} · {fmt(b.created_at)}</p>) : <p className="text-sm text-ink-500">Төлбөрийн бүртгэл алга. Төлбөрийн provider холбогдсоны дараа баталгаажсан гүйлгээ энд харагдана.</p>}</section>
    </div>
    <p className="text-sm text-ink-500">Хугацаа дууссан, suspended эсвэл cancelled багцтай дэлгүүрийн бизнесийн бичих үйлдэл сервер талд хаагдана. Унших болон түүхэн өгөгдөл хадгалагдана. Downgrade өгөгдөл устгахгүй.</p>
  </div>;
}
