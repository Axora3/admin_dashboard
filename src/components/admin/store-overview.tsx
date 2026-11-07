import Link from "next/link";
import { readStoreReportData } from "@/lib/data/google-repository";
import { aggregateReport, localDay } from "@/lib/platform/report-rules";
import { AreaChart, BarChart } from "@/components/ui/chart";

const money = (value: number, currency: string) => `${Math.round(value).toLocaleString()} ${currency === "MNT" ? "₮" : currency}`;
const STATUS_LABELS: Record<string, string> = { new: "Шинэ", confirmed: "Баталгаажсан", processing: "Бэлтгэж буй", shipped: "Хүргэлтэнд", delivered: "Хүргэгдсэн", cancelled: "Цуцлагдсан" };

function Box({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{title && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{action}</div>}{children}</section>;
}

/**
 * Store Admin overview. Must be rendered inside `withStoreAdmin`, so the
 * registry lookup is scoped to the server-assigned store; the storeId argument
 * can never select another store.
 */
export async function StoreOverview({ storeId, currency }: { storeId: string; currency: string }) {
  let raw: Awaited<ReturnType<typeof readStoreReportData>>;
  try {
    raw = await readStoreReportData(storeId);
  } catch {
    return <Box><p role="alert" className="text-sm text-amber-800">Дэлгүүрийн борлуулалтын мэдээллийг одоогоор уншиж чадсангүй. Холболт сэргэсний дараа энд харагдана. Асуудал үргэлжилбэл AXORA Super Admin-д хандана уу.</p></Box>;
  }
  const today = localDay(new Date().toISOString());
  const allTime = aggregateReport(raw.orders, raw.products, "0000-01-01", today, "monthly");
  const daily = aggregateReport(raw.orders, raw.products, localDay(new Date(Date.now() - 29 * 86400000).toISOString()), today, "daily");
  const yearAgo = new Date(Date.now() + 8 * 3600000); yearAgo.setUTCMonth(yearAgo.getUTCMonth() - 11, 1);
  const monthly = aggregateReport(raw.orders, raw.products, yearAgo.toISOString().slice(0, 10), today, "monthly");

  const cards: Array<[string, string | number, string?]> = [
    ["Нийт борлуулалт", money(allTime.revenue, currency), "Төлөгдсөн, цуцлагдаагүй"],
    ["Нийт захиалга", allTime.orders],
    ["Нийт хэрэглэгч", allTime.customers],
    ["Нийт бүтээгдэхүүн", allTime.products, `${allTime.activeProducts} идэвхтэй`],
    ["Хүлээгдэж буй", allTime.pending, "Шинэ · баталгаажсан · бэлтгэж буй"],
    ["Хүргэгдсэн", allTime.completed],
    ["Цуцлагдсан", allTime.cancelled],
    ["Үлдэгдэл бага / дууссан", `${allTime.lowStock} / ${allTime.outOfStock}`],
  ];

  return <div className="space-y-6">
    <p className="text-xs text-slate-500">Сүүлд шинэчилсэн: {new Date(raw.refreshedAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })} · Зөвхөн энэ дэлгүүрийн өгөгдөл</p>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map(([label, value, hint]) => <Box key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</Box>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Box title="Өдрийн борлуулалт (30 хоног)"><AreaChart data={daily.buckets.map(b => ({ label: b.label.slice(5), value: b.revenue }))} valueLabel={v => money(v, currency)} />{!daily.buckets.length && <p className="text-sm text-slate-500">Энэ хугацаанд захиалга алга.</p>}</Box>
      <Box title="Сарын борлуулалт (12 сар)"><BarChart data={monthly.buckets.map(b => ({ label: b.label, value: b.revenue }))} valueLabel={v => money(v, currency)} />{!monthly.buckets.length && <p className="text-sm text-slate-500">Энэ хугацаанд захиалга алга.</p>}</Box>
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <Box title="Шилдэг бүтээгдэхүүн" action={<Link href="/store-admin/analytics" className="text-xs text-teal-700">Дэлгэрэнгүй →</Link>}>{allTime.topProducts.slice(0, 5).map(p => <div key={p.id} className="flex justify-between gap-3 border-t py-2 text-sm first:border-0"><span>{p.name} · {p.quantity} ш</span><span>{money(p.revenue, currency)}</span></div>)}{!allTime.topProducts.length && <p className="text-sm text-slate-500">Борлуулалт бүртгэгдээгүй.</p>}</Box>
      <Box title="Сүүлийн захиалгууд" action={<Link href="/store-admin/orders" className="text-xs text-teal-700">Бүгд →</Link>}>{allTime.recent.map(o => <div key={o.id} className="flex justify-between gap-3 border-t py-2 text-sm first:border-0"><span>{o.orderNumber} · {STATUS_LABELS[o.orderStatus] ?? o.orderStatus}</span><span>{money(o.totalAmount, currency)}</span></div>)}{!allTime.recent.length && <p className="text-sm text-slate-500">Захиалга байхгүй.</p>}</Box>
      <Box title="Барааны үлдэгдэл">{allTime.lowStockProducts.map(p => <div key={p.id} className="flex justify-between border-t py-2 text-sm first:border-0"><span>{p.name}</span><span className={p.stock === 0 ? "font-medium text-red-700" : "text-amber-700"}>{p.stock === 0 ? "Дууссан" : `${p.stock} ш`}</span></div>)}{!allTime.lowStockProducts.length && <p className="text-sm text-slate-500">Бүх барааны үлдэгдэл хангалттай.</p>}</Box>
    </div>
    {!!allTime.invalidOrders && <p className="text-xs text-amber-700">Огноо эсвэл дүн буруу {allTime.invalidOrders} захиалгыг тооцоонд оруулаагүй.</p>}
  </div>;
}
