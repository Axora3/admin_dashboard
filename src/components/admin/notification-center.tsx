import Link from "next/link";
import type { AdminUser } from "@/lib/types";
import { notificationPage,NOTIFICATION_CATEGORIES } from "@/lib/platform/notifications";
import { PlatformForm } from "./platform-form";
export async function NotificationCenter({admin,page=1}:{admin:AdminUser;page?:number}) {
  const result=await notificationPage(admin,page);
  return <div className="space-y-5"><header><h1 className="text-2xl font-semibold">Мэдэгдлийн төв</h1><p className="mt-2 text-sm text-ink-500">Уншаагүй: {result.unread} · Нийт: {result.total}</p></header><PlatformForm operation="notification.read_all" label="Бүгдийг уншсан болгох"/>
    <div className="divide-y rounded-xl border bg-white">{result.rows.map(n=><article key={n.id} className={`flex flex-wrap justify-between gap-4 p-4 ${n.read?"":"bg-brand-50/50"}`}><div><p className="font-medium">{n.title}</p><p className="mt-1 text-xs text-ink-500">{n.category} · {n.store_id??"Platform"} · {new Date(n.created_at).toLocaleString("mn-MN",{timeZone:"Asia/Ulaanbaatar"})}</p></div>{!n.read&&<PlatformForm operation="notification.read" label="Уншсан"><input type="hidden" name="id" value={n.id}/></PlatformForm>}</article>)}{!result.rows.length&&<p className="p-6 text-sm text-ink-500">Мэдэгдэл байхгүй.</p>}</div>
    <nav className="flex gap-4 text-sm">{page>1&&<Link href={`?page=${page-1}`}>← Өмнөх</Link>}{page*20<result.total&&<Link href={`?page=${page+1}`}>Дараах →</Link>}</nav>
    <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">Мэдэгдлийн тохиргоо</summary><div className="mt-4"><p className="mb-3 text-sm text-ink-500">Сонгосон төрлийн мэдэгдлийг нуух:</p><PlatformForm operation="notification.preferences">{NOTIFICATION_CATEGORIES.map(c=><label key={c} className="mr-5 inline-flex items-center gap-2 text-sm"><input type="checkbox" name="muted" value={c} defaultChecked={result.muted.includes(c)}/>{c}</label>)}</PlatformForm></div></details><p className="text-xs text-ink-500">Мэдэгдэл scheduled polling-оор шинэчлэгдэнэ. Хуудас шинэчлэхэд сүүлийн төлөв харагдана.</p></div>;
}
