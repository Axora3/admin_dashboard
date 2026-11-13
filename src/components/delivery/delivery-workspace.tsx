import Link from "next/link";
import { Truck } from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreRegistry } from "@/lib/registry";
import { storeScope } from "@/lib/auth/store-scope";
import { DeliveryBoard, type DeliveryOrder } from "./delivery-board";

export type DeliveryQuery = Record<string, string | string[] | undefined>;
export function queryText(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export async function DeliveryWorkspace({ storeId, query, superAdmin = false }: { storeId?: string; query: DeliveryQuery; superAdmin?: boolean }) {
  const stores = superAdmin ? await getRepository().listStoreOptions() : [];
  const selectedStore = storeId || (stores.length === 1 ? stores[0].id : undefined);
  const store = selectedStore ? await getStoreRegistry().get(selectedStore) : null;
  const page = Math.max(1, Math.floor(Number(queryText(query.page)) || 1));
  const orderId = queryText(query.order);
  const base = superAdmin ? "/admin/deliveries" : "/store-admin/deliveries";
  let rows: DeliveryOrder[] = [], total = 0, pages = 1, currentPage = 1, failed = false;
  if (store) {
    try {
      await storeScope.run(store.id, async () => {
        const repo = getRepository();
        const result = await repo.listOrders({ storeId: store.id, page, pageSize: 100 });
        total = result.total; pages = result.pageCount; currentPage = result.page;
        const orders = [...result.rows];
        if (orderId && !orders.some(o => o.id === orderId)) { const selected = await repo.getOrder(orderId, store.id); if (selected) orders.unshift(selected); }
        rows = orders.map(({ id, storeId, storeName, orderNumber, customerName, customerPhone, customerAddress, orderStatus, delivery, updatedAt }) => ({ id, storeId, storeName, orderNumber, customerName, customerPhone, customerAddress, orderStatus, delivery, updatedAt }));
      });
    } catch { failed = true; }
  }
  return <div className="space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-600">{store?.name ?? "AXORA"} / Хүргэлтийн удирдлага</p><h1 className="flex items-center gap-3 text-3xl font-semibold text-ink-950"><Truck className="h-7 w-7" />Хүргэлт</h1><p className="mt-2 text-sm text-ink-500">Хаягаа тэмдэглэж, хүргэгч оноогоод захиалгын явцыг удирдана.</p></div><Link href={superAdmin ? "/admin/orders" : "/store-admin/orders"} className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium">Захиалгууд →</Link></header>
    {superAdmin && <form className="flex flex-wrap gap-3"><label className="flex min-w-64 flex-1 items-center gap-3 text-sm"><span>Дэлгүүр</span><select name="storeId" aria-label="Хүргэлтийн дэлгүүр" defaultValue={selectedStore ?? ""} className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2.5"><option value="">Дэлгүүр сонгох</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-medium text-white">Харах</button></form>}
    {!store ? <div className="rounded-2xl border border-ink-200 bg-white p-10 text-center text-sm text-ink-500">{selectedStore ? "Дэлгүүр олдсонгүй." : stores.length ? "Хүргэлтүүдийг харах дэлгүүрээ сонгоно уу." : "Дэлгүүр бүртгэсний дараа захиалгын хүргэлтүүд энд харагдана."}</div> : failed ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Захиалгын мэдээллийг уншиж чадсангүй. Дэлгүүрийн холболтыг шалгаад дахин ачаална уу.</div> : <><p className="text-xs text-ink-500">Нийт {total} захиалгаас энэ хуудсанд {rows.length} харагдаж байна. Зураг, тоолуур, шүүлт нь энэ хуудсын захиалгуудад хамаарна.</p><DeliveryBoard key={`${store.id}:${currentPage}`} orders={rows} selectedOrderId={orderId} />{pages > 1 && <nav aria-label="Хүргэлтийн хуудас" className="flex justify-between text-sm"><Link href={`${base}?storeId=${encodeURIComponent(store.id)}&page=${Math.max(1, currentPage - 1)}`}>← Өмнөх</Link><span>{currentPage} / {pages}</span><Link href={`${base}?storeId=${encodeURIComponent(store.id)}&page=${Math.min(pages, currentPage + 1)}`}>Дараах →</Link></nav>}</>}
  </div>;
}
