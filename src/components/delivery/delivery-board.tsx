"use client";

import { useMemo, useState } from "react";
import { MapPin, Truck, CheckCircle2, Search, Navigation, Phone, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { ORDER_STATUS } from "@/lib/labels";
import { DeliveryEditor } from "./delivery-editor";
import { LocationMap } from "./location-map";
import { OrderStatusBadge } from "@/components/admin/status-badges";

export type DeliveryOrder = Pick<Order, "id" | "storeId" | "storeName" | "orderNumber" | "customerName" | "customerPhone" | "customerAddress" | "orderStatus" | "delivery" | "updatedAt">;
function orderKey(o: DeliveryOrder) { return `${o.storeId}:${o.id}`; }
const input = "rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm";

export function DeliveryBoard({ orders, selectedOrderId }: { orders: DeliveryOrder[]; selectedOrderId?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(selectedOrderId ? "all" : "active");
  const [method, setMethod] = useState("all");
  const [selectedKey, setSelectedKey] = useState(orders.find(o => o.id === selectedOrderId) ? orderKey(orders.find(o => o.id === selectedOrderId)!) : "");
  const visible = useMemo(() => orders.filter(o => {
    const matchesSearch = `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.customerAddress} ${o.delivery?.driverName ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || (status === "active" ? !["delivered", "cancelled"].includes(o.orderStatus) : status === "unmapped" ? o.delivery?.latitude == null || o.delivery?.longitude == null : o.orderStatus === status);
    return matchesSearch && matchesStatus && (method === "all" || (method === "unassigned" ? !o.delivery : o.delivery?.method === method));
  }), [orders, search, status, method]);
  const selected = orders.find(o => orderKey(o) === selectedKey);
  const points = visible.flatMap(o => o.delivery?.latitude != null && o.delivery?.longitude != null && o.delivery.method !== "pickup" ? [{ id: orderKey(o), latitude: o.delivery.latitude, longitude: o.delivery.longitude, label: `${o.orderNumber} · ${ORDER_STATUS[o.orderStatus].label}`, status: o.orderStatus }] : []);
  const counts = [
    { label: "Бэлтгэж буй", count: orders.filter(o => !["shipped", "delivered", "cancelled"].includes(o.orderStatus)).length, icon: Truck, filter: "active" },
    { label: "Хүргэлтэд гарсан", count: orders.filter(o => o.orderStatus === "shipped").length, icon: Navigation, filter: "shipped" },
    { label: "Хүргэгдсэн", count: orders.filter(o => o.orderStatus === "delivered").length, icon: CheckCircle2, filter: "delivered" },
    { label: "Байршилгүй", count: orders.filter(o => o.delivery?.latitude == null || o.delivery?.longitude == null).length, icon: MapPin, filter: "unmapped" },
  ];
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{counts.map(({ label, count, icon: Icon, filter }) => <button key={label} type="button" onClick={() => setStatus(filter)} className="rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm transition hover:border-brand-300"><span className="flex items-center justify-between text-xs text-ink-500">{label}<Icon className="h-4 w-4 text-brand-600" /></span><span className="mt-2 block text-3xl font-semibold tabular-nums text-ink-950">{count}</span></button>)}</div>
    <div className="flex flex-wrap items-center gap-3"><label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-400" /><input aria-label="Хүргэлт хайх" className={`${input} w-full pl-9`} placeholder="Захиалга, нэр, утас, хаяг…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Хүргэлтийн төлөв" className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="active">Идэвхтэй захиалга</option><option value="all">Бүх төлөв</option><option value="shipped">Хүргэлтэд гарсан</option><option value="delivered">Хүргэгдсэн</option><option value="cancelled">Цуцлагдсан</option><option value="unmapped">Байршилгүй</option></select><select aria-label="Хүргэлтийн төрөл шүүх" className={input} value={method} onChange={e => setMethod(e.target.value)}><option value="all">Бүх төрөл</option><option value="store_delivery">Өөрөө хүргэнэ</option><option value="courier">Хүргэлтийн байгууллага</option><option value="pickup">Очиж авна</option><option value="unassigned">Тохируулаагүй</option></select><button type="button" aria-label="Мэдээлэл шинэчлэх" onClick={() => router.refresh()} className={input}><RefreshCw className="h-4 w-4" /></button></div>
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm"><div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 px-5 py-3"><h2 className="text-sm font-semibold">Хүргэлтийн байршлууд</h2><span className="text-xs text-ink-500">{points.length} цэг · {visible.length} захиалга</span></div><LocationMap points={points} selectedId={selectedKey} onSelect={setSelectedKey} className="h-[340px] md:h-[420px]" /><p className="px-5 py-3 text-xs text-ink-500">Хадгалсан хүргэх хаягууд харагдана. Газрын зураг дээрх цэгийг дарж захиалгаа сонгоно уу.</p></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]"><section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm"><div className="border-b border-ink-100 px-5 py-4"><h2 className="font-semibold">Захиалгын жагсаалт <span className="ml-2 text-sm font-normal text-ink-400">{visible.length}</span></h2></div><div className="max-h-[690px] overflow-y-auto divide-y divide-ink-100">{visible.map(o => <button type="button" key={orderKey(o)} onClick={() => setSelectedKey(orderKey(o))} aria-pressed={selectedKey === orderKey(o)} className={`block w-full px-5 py-4 text-left transition ${selectedKey === orderKey(o) ? "bg-brand-50" : "hover:bg-ink-50"}`}><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-ink-950">{o.orderNumber}</span><OrderStatusBadge status={o.orderStatus} /></span><span className="mt-1 block text-xs text-ink-400">{o.storeName}</span><span className="mt-2 block text-sm text-ink-700">{o.customerName} · {o.customerPhone}</span><span className="mt-1 flex items-start gap-1.5 text-xs text-ink-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{o.customerAddress || "Хаяг оруулаагүй"}</span><span className="mt-2 block text-xs text-brand-700">{o.delivery?.driverName ? `Хүргэгч: ${o.delivery.driverName}` : "Хүргэгч оноогоогүй"}{o.delivery?.latitude == null ? " · Байршил тэмдэглээгүй" : ""}</span></button>)}{visible.length === 0 && <div className="px-6 py-12 text-center"><Truck className="mx-auto mb-3 h-8 w-8 text-ink-300" /><p className="text-sm text-ink-500">Энэ шүүлтэд тохирох захиалга байхгүй.</p></div>}</div></section>
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">{selected ? <><div className="mb-5 border-b border-ink-100 pb-4"><h2 className="text-lg font-semibold">{selected.orderNumber}</h2><p className="mt-1 text-sm text-ink-500">{selected.customerAddress || "Хаяг оруулаагүй"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{selected.customerPhone && <a href={`tel:${selected.customerPhone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 text-brand-700"><Phone className="h-4 w-4" />{selected.customerPhone}</a>}{selected.delivery?.latitude != null && selected.delivery?.longitude != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.delivery.latitude},${selected.delivery.longitude}&travelmode=driving`} className="inline-flex items-center gap-1 text-brand-700"><Navigation className="h-4 w-4" />Зам заалгах ↗</a>}</div></div><DeliveryEditor key={`${orderKey(selected)}:${selected.updatedAt}`} order={selected} /></> : <div className="py-12 text-center"><MapPin className="mx-auto mb-3 h-8 w-8 text-ink-300" /><p className="text-sm text-ink-500">Зураг эсвэл жагсаалтаас захиалга сонгоод<br />хүргэлтийн мэдээллийг удирдана уу.</p></div>}</section></div>
  </div>;
}
