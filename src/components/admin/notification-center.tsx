import Link from "next/link";
import type { AdminUser } from "@/lib/types";
import { notificationPage } from "@/lib/platform/notifications";
import { NOTIFICATION_CATEGORIES, CATEGORY_LABELS } from "@/lib/platform/notification-rules";
import { getStoreRegistry } from "@/lib/registry";
import { PlatformForm } from "./platform-form";

export async function NotificationCenter({ admin, page = 1, category, unreadOnly = false, basePath }: { admin: AdminUser; page?: number; category?: string; unreadOnly?: boolean; basePath: string }) {
  const filter = category && (NOTIFICATION_CATEGORIES as readonly string[]).includes(category) ? category : undefined;
  const result = await notificationPage(admin, page, { category: filter, unreadOnly });
  // Store names are resolved only for Super Admin; a Store Admin never sees other stores' names.
  const names = admin.isSuperAdmin ? new Map((await getStoreRegistry().list()).map(s => [s.id, s.name])) : null;
  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { category: filter, unread: unreadOnly ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  if (!result.available) return <section className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-semibold">Мэдэгдлийн төв</h1><p className="mt-3 text-sm text-ink-500">Мэдэгдлийн систем тохируулагдаагүй байна (Supabase platform storage шаардлагатай). Мэдэгдэл зохиомлоор харуулахгүй.</p></section>;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Мэдэгдлийн төв</h1><p className="mt-2 text-sm text-ink-500">Уншаагүй: {result.unread} · {filter || unreadOnly ? "Шүүлттэй" : "Нийт"}: {result.total}{!admin.isSuperAdmin && " · Зөвхөн таны дэлгүүрийн мэдэгдэл"}</p></div><PlatformForm operation="notification.read_all" label="Бүгдийг уншсан болгох" /></header>
    <nav className="flex flex-wrap gap-2 text-sm">
      <Link href={link({ category: undefined, page: undefined })} className={`rounded-full border px-3 py-1 ${!filter ? "bg-ink-900 text-white" : "bg-white"}`}>Бүгд</Link>
      {NOTIFICATION_CATEGORIES.map(c => <Link key={c} href={link({ category: c, page: undefined })} className={`rounded-full border px-3 py-1 ${filter === c ? "bg-ink-900 text-white" : "bg-white"}`}>{CATEGORY_LABELS[c] ?? c}</Link>)}
      <Link href={link({ unread: unreadOnly ? undefined : "1", page: undefined })} className={`rounded-full border px-3 py-1 ${unreadOnly ? "bg-brand-600 text-white" : "bg-white"}`}>Зөвхөн уншаагүй</Link>
    </nav>
    <div className="divide-y rounded-xl border bg-white">{result.rows.map(n => <article key={n.id} className={`flex flex-wrap justify-between gap-4 p-4 ${n.read ? "" : "bg-brand-50/50"}`}><div><p className="font-medium">{!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Уншаагүй" />}{n.title}</p><p className="mt-1 text-xs text-ink-500">{CATEGORY_LABELS[n.category] ?? n.category}{names ? ` · ${n.store_id ? names.get(n.store_id) ?? n.store_id : "Platform"}` : ""} · {new Date(n.created_at).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}</p></div>{!n.read && <PlatformForm operation="notification.read" label="Уншсан"><input type="hidden" name="id" value={n.id} /></PlatformForm>}</article>)}{!result.rows.length && <p className="p-6 text-sm text-ink-500">Мэдэгдэл байхгүй.</p>}</div>
    <nav className="flex gap-4 text-sm">{page > 1 && <Link href={link({ page: String(page - 1) })}>← Өмнөх</Link>}{page * 20 < result.total && <Link href={link({ page: String(page + 1) })}>Дараах →</Link>}</nav>
    <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">Мэдэгдлийн тохиргоо</summary><div className="mt-4"><p className="mb-3 text-sm text-ink-500">Сонгосон төрлийн мэдэгдлийг нуух (badge тоонд орохгүй):</p><PlatformForm operation="notification.preferences">{NOTIFICATION_CATEGORIES.map(c => <label key={c} className="mr-5 inline-flex items-center gap-2 text-sm"><input type="checkbox" name="muted" value={c} defaultChecked={result.muted.includes(c)} />{CATEGORY_LABELS[c] ?? c}</label>)}</PlatformForm></div></details>
    <p className="text-xs text-ink-500">Badge нь Supabase Realtime-аар (боломжтой үед) болон 60 секунд тутамд шинэчлэгдэнэ. Захиалгын мэдэгдэл scheduled polling-оор үүснэ.</p>
  </div>;
}
