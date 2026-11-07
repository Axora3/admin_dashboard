import Link from "next/link";
import { getReports } from "@/lib/platform/reports";
import { compareStores, localDay, type StoreReport } from "@/lib/platform/report-rules";
import { BarChart, AreaChart } from "@/components/ui/chart";

const STATUS_LABELS: Record<string, string> = { new: "Шинэ", confirmed: "Баталгаажсан", processing: "Бэлтгэж буй", shipped: "Хүргэлтэнд", delivered: "Хүргэгдсэн", cancelled: "Цуцлагдсан" };
const n = (v: number) => Math.round(v).toLocaleString();
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function presets(basePath: string, storeId?: string) {
  const today = localDay(new Date().toISOString());
  const back = (days: number) => localDay(new Date(Date.now() - (days - 1) * 86400000).toISOString());
  return [["7 хоног", back(7), "daily"], ["30 хоног", back(30), "daily"], ["90 хоног", back(90), "weekly"], ["12 сар", back(365), "monthly"]].map(([label, from, group]) => ({
    label, href: `${basePath}?${new URLSearchParams({ from, to: today, group, ...(storeId ? { storeId } : {}) })}`,
  }));
}

function StoreSection({ r, open }: { r: { id: string; name: string; currency: string; refreshedAt: string; data: StoreReport }; open: boolean }) {
  const d = r.data;
  const maxStatus = Math.max(1, ...d.statusBreakdown.map(s => s.count));
  return <details open={open} className="group rounded-xl border bg-white p-5">
    <summary className="flex cursor-pointer flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">{r.name} · {r.currency}</h2><span className="text-xs text-ink-500">Сүүлд шинэчилсэн: {new Date(r.refreshedAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}</span></summary>
    <div className="mt-4 space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[["Нийт орлого", `${n(d.revenue)} ${r.currency}`], ["Нийт захиалга", d.orders], ["Дундаж захиалгын дүн", `${n(d.averageOrderValue)} ${r.currency}`], ["Хэрэглэгч", d.customers], ["Pending / Completed", `${d.pending} / ${d.completed}`], ["Цуцлагдсан", d.cancelled], ["Бүтээгдэхүүн (идэвхтэй)", `${d.products} (${d.activeProducts})`], ["Бага / дууссан үлдэгдэл", `${d.lowStock} / ${d.outOfStock}`]].map(([label, value]) => <div key={label} className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div><h3 className="mb-3 text-sm font-semibold">Борлуулалт</h3><AreaChart data={d.buckets.map(b => ({ label: b.label, value: b.revenue }))} />{!d.buckets.length && <p className="text-sm text-ink-500">Энэ хугацаанд мэдээлэл алга.</p>}</div>
        <div><h3 className="mb-3 text-sm font-semibold">Захиалга</h3><BarChart data={d.buckets.map(b => ({ label: b.label, value: b.orders }))} /></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div><h3 className="mb-2 font-semibold">Захиалгын төлөв</h3>{d.statusBreakdown.map(s => <div key={s.status} className="py-1.5 text-sm"><div className="flex justify-between"><span>{STATUS_LABELS[s.status]}</span><span>{s.count}</span></div><div className="mt-1 h-1.5 rounded bg-ink-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${(s.count / maxStatus) * 100}%` }} /></div></div>)}</div>
        <div><h3 className="mb-2 font-semibold">Хэрэглэгчийн идэвх</h3>{[["Идэвхтэй хэрэглэгч", d.customerActivity.active], ["Шинэ хэрэглэгч", d.customerActivity.newCustomers], ["Давтан захиалсан", d.customerActivity.returning], ["Хэрэглэгч бүрийн захиалга", d.customerActivity.ordersPerCustomer.toFixed(2)]].map(([label, value]) => <p key={label} className="flex justify-between border-t py-2 text-sm first:border-0"><span>{label}</span><span>{value}</span></p>)}</div>
        <div><h3 className="mb-2 font-semibold">Бараа материал</h3>{[["Нийт бүтээгдэхүүн", d.products], ["Идэвхтэй", d.activeProducts], ["Үлдэгдэл бага", d.lowStock], ["Дууссан", d.outOfStock], ["Хугацаанд зарагдаагүй (идэвхтэй)", d.unsoldProducts]].map(([label, value]) => <p key={label} className="flex justify-between border-t py-2 text-sm first:border-0"><span>{label}</span><span>{value}</span></p>)}</div>
      </div>
      <div className="overflow-x-auto"><h3 className="mb-2 font-semibold">Бүтээгдэхүүний эрэмбэ (орлогоор)</h3>
        <table className="w-full text-left text-sm"><thead className="text-xs text-ink-500"><tr>{["#", "Бүтээгдэхүүн", "Тоо ширхэг", "Захиалга", "Орлого", "Хувь"].map(t => <th key={t} className="py-2 pr-3">{t}</th>)}</tr></thead>
          <tbody>{d.topProducts.map((p, i) => <tr key={p.id} className="border-t"><td className="py-2 pr-3">{i + 1}</td><td className="pr-3">{p.name}</td><td className="pr-3">{p.quantity}</td><td className="pr-3">{p.orders}</td><td className="pr-3">{n(p.revenue)} {r.currency}</td><td>{pct(p.share)}</td></tr>)}</tbody></table>
        {!d.topProducts.length && <p className="text-sm text-ink-500">Энэ хугацаанд төлөгдсөн борлуулалт алга.</p>}
      </div>
      {!!d.invalidOrders && <p className="text-sm text-amber-700">Огноо эсвэл дүн буруу {d.invalidOrders} захиалгыг тооцоонд оруулаагүй.</p>}
    </div>
  </details>;
}

export async function AnalyticsReport({ storeId, query, basePath }: { storeId?: string; query: Record<string, string | undefined>; basePath: string }) {
  const result = await getReports(storeId, query);
  const qs = new URLSearchParams({ ...result.filters, ...(storeId && !basePath.startsWith("/store-admin") ? { storeId } : {}) });
  const isStore = basePath.startsWith("/store-admin");
  const comparison = !storeId ? compareStores(result.reports) : null;
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-semibold">{isStore ? "Дэлгүүрийн статистик" : storeId ? "Дэлгүүрийн статистик (Super Admin)" : "Платформын статистик"}</h1><p className="mt-2 text-sm text-ink-500">{result.filters.from} — {result.filters.to} · Asia/Ulaanbaatar · Орлого = төлөгдсөн, цуцлагдаагүй захиалга · Google Sheets-ийн бодит өгөгдөл</p></header>
    <div className="flex flex-wrap gap-2 text-sm">{presets(basePath, isStore ? undefined : storeId).map(p => <Link key={p.label} href={p.href} className="rounded-lg border bg-white px-3 py-1.5">{p.label}</Link>)}</div>
    <form className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm">Эхлэх<input className="rounded-lg border bg-white p-2" name="from" type="date" defaultValue={result.filters.from} /></label><label className="grid gap-1 text-sm">Дуусах<input className="rounded-lg border bg-white p-2" name="to" type="date" defaultValue={result.filters.to} /></label><label className="grid gap-1 text-sm">Хугацааны бүлэг<select className="rounded-lg border bg-white p-2" name="group" defaultValue={result.filters.group}><option value="daily">Өдөр</option><option value="weekly">7 хоног</option><option value="monthly">Сар</option></select></label>{storeId && !isStore && <input name="storeId" type="hidden" value={storeId} />}<button className="rounded-lg bg-brand-600 px-4 py-2 text-white">Шүүх</button>
      <Link href={`/api/reports?${qs}`} className="rounded-lg border bg-white px-4 py-2 text-sm">CSV: хугацаагаар</Link><Link href={`/api/reports?${qs}&report=products`} className="rounded-lg border bg-white px-4 py-2 text-sm">CSV: бүтээгдэхүүн</Link></form>
    {!!result.unavailable.length && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{isStore ? "Дэлгүүрийн мэдээллийг одоогоор уншиж чадсангүй." : `Мэдээлэл ачаалагдаагүй: ${result.unavailable.join(", ")}. Эдгээр дэлгүүрийг тайланд оруулаагүй — тоог тэг гэж тооцоогүй.`}</p>}
    {!result.storeCount && <p className="rounded-xl border bg-white p-6">Дэлгүүр бүртгэгдээгүй.</p>}
    {comparison && result.reports.length > 0 && <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Платформын нэгдсэн дүн</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {comparison.totals.map(t => <div key={t.currency} className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">Нийт орлого ({t.currency}, {t.stores} дэлгүүр)</p><p className="mt-2 text-xl font-semibold">{n(t.revenue)} {t.currency}</p><p className="text-xs text-ink-500">{t.orders} захиалга</p></div>)}
        <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs text-ink-500">Захиалгатай / захиалгагүй дэлгүүр</p><p className="mt-2 text-xl font-semibold">{comparison.activeStores} / {comparison.idleStores}</p></div>
      </div>
      <div className="overflow-x-auto"><h3 className="mb-2 font-semibold">Дэлгүүрийн гүйцэтгэлийн харьцуулалт</h3>
        <table className="w-full text-left text-sm"><thead className="text-xs text-ink-500"><tr>{["Дэлгүүр", "Захиалга", "Орлого", "Дундаж", "Хэрэглэгч", "Орлогын хувь (валютаар)"].map(t => <th key={t} className="py-2 pr-3">{t}</th>)}</tr></thead>
          <tbody>{comparison.rows.map(row => <tr key={row.id} className="border-t"><td className="py-2 pr-3"><Link className="text-brand-700" href={`${basePath}?${new URLSearchParams({ ...result.filters, storeId: row.id })}`}>{row.name}</Link></td><td className="pr-3">{row.orders}</td><td className="pr-3">{n(row.revenue)} {row.currency}</td><td className="pr-3">{n(row.averageOrderValue)}</td><td className="pr-3">{row.customers}</td><td><div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded bg-ink-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: pct(row.revenueShare) }} /></div>{pct(row.revenueShare)}</div></td></tr>)}</tbody></table>
      </div>
      <p className="text-xs text-ink-500">Өөр валюттай дэлгүүрийн орлогыг нэг дүн болгон нийлүүлэхгүй.</p>
    </section>}
    {result.reports.map(r => <StoreSection key={r.id} r={r} open={result.reports.length === 1} />)}
  </div>;
}
