import { requireSuperAdmin } from "@/lib/auth/server";
import { getStoreRegistry } from "@/lib/registry";
import { platformHealth, isSheetsConfigured } from "@/lib/platform/health";
import { checked, platformDb } from "@/lib/platform/db";
import { effectiveStatus, type Subscription } from "@/lib/platform/subscription-rules";
import { currentStoreHealth, summarizeStatuses, overallStatus, subscriptionConsistency, healthCodeLabel, HEALTH_STATUSES, type HealthStatus } from "@/lib/platform/health-rules";
import { isGoogleSheetsConfigured, sheetsMode } from "@/lib/config";
import { PlatformForm } from "@/components/admin/platform-form";
import { HealthBadge } from "@/components/admin/health-badge";

const fmt = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "—";
const box = "rounded-xl border bg-white p-5";

function Status({ label, status, detail }: { label: string; status: HealthStatus; detail: string }) {
  return <section className={box}><p className="text-sm text-ink-500">{label}</p><div className="my-3"><HealthBadge status={status} /></div><p className="break-words text-xs text-ink-500">{detail}</p></section>;
}

export default async function Page() {
  await requireSuperAdmin();
  const info = await platformHealth();
  const stores = await getStoreRegistry().list();
  const db = info.supabase.status === "healthy" ? platformDb() : null;
  const [subscriptions, plans] = db ? await Promise.all([db.from("platform_subscriptions").select("*"), db.from("platform_plans").select("*")]) : [null, null];
  const subs = (subscriptions ? checked(subscriptions).data ?? [] : []) as Subscription[];
  const planRows = plans ? checked(plans).data ?? [] : [];

  const sheetEvents = info.health.filter(h => h.component === "sheets");
  const apiErrors = info.health.filter(h => h.component === "google_api");
  const rows = stores.map(store => {
    const events = sheetEvents.filter(h => h.store_id === store.id).sort((a, b) => b.checked_at.localeCompare(a.checked_at));
    const current = currentStoreHealth(events, isSheetsConfigured(store));
    let consecutiveFailures = 0;
    for (const e of events) { if (e.status !== "error") break; consecutiveFailures++; }
    return { store, events, ...current, consecutiveFailures, lastSuccess: events.find(e => e.status === "healthy" || e.status === "warning"), lastFailure: events.find(e => e.status === "error") };
  });
  const storeStatuses = rows.map(r => r.status);
  const summary = summarizeStatuses(storeStatuses);
  const issues = db ? subscriptionConsistency(stores, subs, planRows) : [];

  const job = info.jobs[0];
  const schedulerStatus: HealthStatus = !process.env.AXORA_JOB_SECRET ? "disconnected" : !job ? "unknown" : Date.now() - Date.parse(job.started_at) > 30 * 60_000 ? "warning" : job.status === "failed" ? "error" : job.status === "running" ? "warning" : "healthy";
  const googleStatus: HealthStatus = sheetsMode() === "local" ? "warning" : !isGoogleSheetsConfigured() ? "disconnected" : apiErrors.some(e => Date.now() - Date.parse(e.checked_at) < 3600_000) ? "warning" : "healthy";
  const recentBackupFailures = info.backups.filter(b => b.status === "failed");
  const backupStatus: HealthStatus = !info.backups.length ? "unknown" : recentBackupFailures.length && info.backups[0].status === "failed" ? "error" : recentBackupFailures.length ? "warning" : "healthy";
  const domains = stores.flatMap(s => s.domains.map(d => ({ store: s, d })));
  const domainStatus: HealthStatus = !domains.length ? "unknown" : domains.some(x => x.d.verificationStatus === "failed" || x.d.sslStatus === "error") ? "error" : domains.some(x => x.d.verificationStatus !== "verified" || x.d.sslStatus !== "active") ? "warning" : "healthy";
  const subscriptionStatus: HealthStatus = !db ? "unknown" : issues.some(i => i.severity === "error") ? "error" : issues.length ? "warning" : "healthy";
  const overall = overallStatus([info.supabase.status, schedulerStatus, googleStatus, backupStatus, subscriptionStatus, ...storeStatuses]);
  const name = (id: string | null) => (id && stores.find(s => s.id === id)?.name) || id || "Platform";

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">System Health Center</h1><p className="mt-2 text-sm text-ink-500">Бодит шалгалтын үр дүн. Тохиргоо байгаа гэдгээр Healthy гэж харуулахгүй; мэдээлэлгүй бол Unknown. Нууц мэдээлэл (credential, spreadsheet ID) харуулахгүй.</p></div><div className="text-right"><p className="text-xs text-ink-500">Нийт төлөв</p><HealthBadge status={overall} /><p className="mt-1 text-xs text-ink-500">{fmt(info.supabase.checkedAt)}</p></div></header>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Status label="Supabase (platform DB)" status={info.supabase.status} detail={info.supabase.status === "healthy" ? `${info.supabase.latencyMs} ms` : "Холболт эсвэл platform migration-ийг шалгана уу."} />
      <Status label="Google Sheets API" status={googleStatus} detail={sheetsMode() === "local" ? "Local emulator горим — бодит Google Sheets биш" : !isGoogleSheetsConfigured() ? "Service account тохируулаагүй" : `Сүүлийн 1 цагийн API алдаа: ${apiErrors.filter(e => Date.now() - Date.parse(e.checked_at) < 3600_000).length}`} />
      <Status label="Scheduled tasks" status={schedulerStatus} detail={!process.env.AXORA_JOB_SECRET ? "AXORA_JOB_SECRET тохируулаагүй" : job ? `Сүүлд: ${fmt(job.started_at)} · ${job.status} · амжилтгүй ${job.failures}` : "Scheduler нэг ч удаа ажиллаагүй (POST /api/jobs, 15 минут тутам)"} />
      <Status label="Backup" status={backupStatus} detail={`Сүүлийн 30 backup-д амжилтгүй: ${recentBackupFailures.length}`} />
      <Status label="Domain / SSL" status={domainStatus} detail={`${domains.length} домэйн · баталгаажсан ${domains.filter(x => x.d.verificationStatus === "verified").length}`} />
      <Status label="Subscription consistency" status={subscriptionStatus} detail={`${issues.length} асуудал`} />
    </div>

    <section className={box}><h2 className="mb-3 font-semibold">Дэлгүүрийн Sheets холболт — хураангуй</h2><div className="flex flex-wrap gap-2">{HEALTH_STATUSES.map(s => <HealthBadge key={s} status={s} suffix={String(summary[s])} />)}</div>
      <div className="mt-4 flex flex-wrap gap-4"><PlatformForm operation="health.check_all" label="Бүх холболтыг одоо шалгах" /><PlatformForm operation="jobs.run" label="Scheduled job (шалгалт, polling, backup) ажиллуулах" /></div></section>

    <section className="overflow-x-auto rounded-xl border bg-white"><table className="axora-table"><thead><tr>{["Дэлгүүр", "Төлөв", "Онош", "Сүүлд шалгасан", "Сүүлд амжилттай", "Сүүлд алдаатай", "Retry", "Subscription", ""].map(t => <th key={t}>{t}</th>)}</tr></thead>
      <tbody>{rows.map(r => {
        const sub = subs.find(x => x.store_id === r.store.id);
        return <tr key={r.store.id}>
          <td>{r.store.name}<p className="text-xs text-ink-500">{r.store.status}</p></td>
          <td><HealthBadge status={r.status} suffix={r.stale ? "хуучирсан" : undefined} /></td>
          <td className="text-xs">{r.status === "disconnected" ? healthCodeLabel("not_configured") : healthCodeLabel(r.last?.code)}{r.last?.latency_ms != null && <p className="text-ink-500">{r.last.latency_ms} ms</p>}</td>
          <td>{fmt(r.last?.checked_at)}</td><td>{fmt(r.lastSuccess?.checked_at)}</td><td>{fmt(r.lastFailure?.checked_at)}</td>
          <td className="text-xs">{r.consecutiveFailures ? `${r.consecutiveFailures} дараалсан алдаа · дараагийн job дахин оролдоно` : r.last?.code === "connection_verified_after_retry" ? "Retry-ээр сэргэсэн" : "—"}</td>
          <td>{sub ? effectiveStatus(sub) : "Unassigned"}</td>
          <td><PlatformForm operation="health.check" label="Connection test"><input type="hidden" name="storeId" value={r.store.id} /></PlatformForm></td>
        </tr>;
      })}</tbody></table>{!stores.length && <p className="p-6 text-sm text-ink-500">Дэлгүүр бүртгэгдээгүй.</p>}</section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className={box}><h2 className="mb-2 font-semibold">Sheets холболтын алдааны түүх</h2>{sheetEvents.filter(h => h.status === "error").slice(0, 30).map(h => <p className="border-t py-2 text-sm" key={h.id}>{name(h.store_id)} · {healthCodeLabel(h.code)} · {fmt(h.checked_at)}</p>)}{!sheetEvents.some(h => h.status === "error") && <p className="text-sm text-ink-500">Алдаа бүртгэгдээгүй.</p>}</section>
      <section className={box}><h2 className="mb-2 font-semibold">Google API алдаа</h2>{apiErrors.slice(0, 30).map(h => <p className="border-t py-2 text-sm" key={h.id}>{h.code} · {fmt(h.checked_at)}</p>)}{!apiErrors.length && <p className="text-sm text-ink-500">Алдаа бүртгэгдээгүй.</p>}<p className="mt-2 text-xs text-ink-500">Зөвхөн алдааны код хадгална — URL, хүсэлтийн агуулга, Google-ийн мессеж хадгалахгүй.</p></section>
    </div>

    <section className={box}><h2 className="mb-2 font-semibold">Subscription consistency</h2>{issues.map((i, k) => <p key={k} className={`border-t py-2 text-sm ${i.severity === "error" ? "text-danger-700" : "text-warning-700"}`}>{name(i.storeId)} · {i.message}</p>)}{db && !issues.length && <p className="text-sm text-ink-500">Зөрчил илрээгүй.</p>}{!db && <p className="text-sm text-ink-500">Supabase холбогдоогүй тул шалгах боломжгүй (Unknown).</p>}</section>

    <section className={box}><h2 className="mb-2 font-semibold">Domain / SSL</h2>{domains.map(({ store, d }) => <p className="border-t py-2 text-sm" key={d.id}>{store.name} · {d.domain} · DNS {d.verificationStatus} · SSL {d.sslStatus} · Сүүлд шалгасан {fmt(d.lastCheckedAt)}</p>)}{!domains.length && <p className="text-sm text-ink-500">Custom domain бүртгэгдээгүй.</p>}</section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className={box}><h2 className="mb-2 font-semibold">Scheduled task түүх</h2>{info.jobs.map(j => <p className="border-t py-2 text-sm" key={j.id}>{j.status} · амжилтгүй дэлгүүр {j.failures} · {fmt(j.started_at)}{j.completed_at ? ` → ${fmt(j.completed_at)}` : ""}</p>)}{!info.jobs.length && <p className="text-sm text-ink-500">Ажиллаагүй.</p>}</section>
      <section className={box}><h2 className="mb-2 font-semibold">Backup алдаа</h2>{recentBackupFailures.map(b => <p className="border-t py-2 text-sm" key={b.id}>{name(b.store_id)} · {b.kind} · {b.failure_code ?? "failed"} · {fmt(b.created_at)}</p>)}{!recentBackupFailures.length && <p className="text-sm text-ink-500">Сүүлийн backup-уудад алдаа алга.</p>}</section>
    </div>
  </div>;
}
