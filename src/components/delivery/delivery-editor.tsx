"use client";

import { useActionState, useState } from "react";
import { Truck, CheckCircle2 } from "lucide-react";
import { deliveryAction } from "@/app/admin/actions/delivery";
import { LocationPicker } from "./location-picker";
import type { Order } from "@/lib/types";

const field = "w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none";
export function DeliveryEditor({ order }: { order: Pick<Order, "id" | "storeId" | "orderStatus" | "delivery"> }) {
  const [state, action, pending] = useActionState(deliveryAction, undefined);
  const [statusState, statusAction, statusPending] = useActionState(deliveryAction, undefined);
  const [method, setMethod] = useState(order.delivery?.method ?? "store_delivery");
  const complete = order.orderStatus === "delivered" || order.orderStatus === "cancelled";
  return <div className="space-y-5">
    <form action={action} className="space-y-4">
      <input type="hidden" name="operation" value="details" /><input type="hidden" name="storeId" value={order.storeId} /><input type="hidden" name="orderId" value={order.id} />
      <label className="grid gap-1.5 text-sm font-medium">Хүргэлтийн төрөл<select name="method" value={method} onChange={e => setMethod(e.target.value as typeof method)} className={field}><option value="store_delivery">Дэлгүүр өөрөө хүргэнэ</option><option value="courier">Хүргэлтийн байгууллага</option><option value="pickup">Дэлгүүрээс очиж авна</option></select></label>
      {method !== "pickup" && <><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">Хүргэгчийн нэр<input name="driverName" maxLength={100} defaultValue={order.delivery?.driverName ?? ""} className={field} placeholder="Нэр" /></label><label className="grid gap-1.5 text-sm">Хүргэгчийн утас<input name="driverPhone" type="tel" maxLength={30} defaultValue={order.delivery?.driverPhone ?? ""} className={field} placeholder="Утасны дугаар" /></label></div>
      <LocationPicker initialLatitude={order.delivery?.latitude} initialLongitude={order.delivery?.longitude} /></>}
      {method === "pickup" && <><input type="hidden" name="latitude" value="" /><input type="hidden" name="longitude" value="" /><input type="hidden" name="driverName" value="" /><input type="hidden" name="driverPhone" value="" /></>}
      <label className="grid gap-1.5 text-sm">Хүргэлтийн тэмдэглэл<textarea name="note" maxLength={1000} rows={2} defaultValue={order.delivery?.note ?? ""} className={field} placeholder="Орц, давхар, хүргэх цаг…" /></label>
      <button disabled={pending} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : "Хүргэлт хадгалах"}</button>
      {state && <p role="status" className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </form>
    {order.delivery && order.delivery.method !== "pickup" && !complete && <form action={statusAction} className="border-t border-ink-100 pt-4">
      <input type="hidden" name="operation" value="status" /><input type="hidden" name="storeId" value={order.storeId} /><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="status" value={order.orderStatus === "shipped" ? "delivered" : "shipped"} />
      <button disabled={statusPending} className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{order.orderStatus === "shipped" ? <CheckCircle2 className="h-4 w-4" /> : <Truck className="h-4 w-4" />}{statusPending ? "Хадгалж байна…" : order.orderStatus === "shipped" ? "Хүргэгдсэн гэж тэмдэглэх" : "Хүргэлтэд гаргах"}</button>
      {statusState && <p role="status" className={`mt-2 text-sm ${statusState.ok ? "text-emerald-700" : "text-red-700"}`}>{statusState.message}</p>}
    </form>}
  </div>;
}
