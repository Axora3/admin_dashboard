"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { CustomerRecord } from "@/lib/customer/data";
import type { FieldDescriptor } from "@/lib/customer/modules";

function controlValue(field: FieldDescriptor, value: unknown): string {
  if (field.kind === "json") return JSON.stringify(value ?? field.defaultValue ?? [], null, 2);
  if (field.kind === "datetime" && typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 16);
  return value == null ? String(field.defaultValue ?? "") : String(value);
}
const inputClass = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100";
export function RecordManager({ siteId, module, fields, initialRecords, initialError, canWrite, updateOnly = false }: {
  siteId: string; module: string; fields: FieldDescriptor[]; initialRecords: CustomerRecord[]; initialError: boolean; canWrite: boolean; updateOnly?: boolean;
}) {
  const [records, setRecords] = useState(initialRecords), [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [failed, setFailed] = useState(initialError), [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [search, setSearch] = useState(""), [page, setPage] = useState(1), [formVersion, setFormVersion] = useState(0);
  const attempt = useRef({ fingerprint: "", key: "" });
  const endpoint = "/api/admin/site-data/" + module + "?siteId=" + encodeURIComponent(siteId);
  async function refresh() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.site_id !== siteId || !Array.isArray(data.data)) throw new Error(data.message || "Өгөгдөл уншиж чадсангүй.");
    setRecords(data.data); setFailed(false); return data.data as CustomerRecord[];
  }
  async function reload() { setPending(true); setError(""); try { await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Өгөгдөл уншиж чадсангүй."); } finally { setPending(false); } }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || !canWrite) return;
    const form = new FormData(event.currentTarget), payload: Record<string, unknown> = {};
    try {
      for (const field of fields) {
        const raw = String(form.get(field.key) ?? "");
        if (field.kind === "boolean") payload[field.key] = form.get(field.key) === "on";
        else if (field.kind === "number") { if (raw !== "") payload[field.key] = Number(raw); else if (field.nullable) payload[field.key] = null; }
        else if (field.kind === "json") { if (raw.trim()) payload[field.key] = JSON.parse(raw); }
        else if (field.kind === "datetime") { if (raw) payload[field.key] = new Date(raw + "+08:00").toISOString(); else if (field.nullable) payload[field.key] = null; }
        else if (raw || field.required) payload[field.key] = raw;
        else if (selected) payload[field.key] = field.nullable ? null : "";
      }
    } catch { setError("JSON эсвэл огнооны форматыг шалгана уу."); return; }
    const fingerprint = JSON.stringify(payload);
    if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    const body = selected ? { id: selected.id, expectedUpdatedAt: selected.updatedAt, payload } : { payload, idempotencyKey: attempt.current.key };
    await mutate(selected ? "PATCH" : "POST", body);
  }
  async function mutate(method: string, body: unknown) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Үйлдэл амжилтгүй боллоо.");
      setMessage(data.message); attempt.current = { fingerprint: "", key: "" };
      setSelected(null); setFormVersion(v => v + 1); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Хадгалж чадсангүй. Дахин оролдоно уу."); }
    finally { setPending(false); }
  }
  const visible = records.filter(record => Object.values(record).some(value => typeof value === "string" && value.toLowerCase().includes(search.toLowerCase())));
  const pages = Math.max(1, Math.ceil(visible.length / 15)), current = Math.min(page, pages);
  const rows = visible.slice((current - 1) * 15, current * 15);
  return <div data-testid={"module-" + module} className="space-y-4">
    {!canWrite ? <p className="rounded-lg border bg-white p-4 text-sm text-slate-600">Та энэ сайтад зөвхөн харах эрхтэй.</p> : null}
    {message ? <p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">{message}</p> : null}
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {failed ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><p>Өгөгдлийг уншиж чадсангүй. Холболт эсвэл Sheets-ийн бүтцийг шалгана уу.</p><Link className="mt-2 inline-block font-medium text-teal-800" href="/store-admin/settings">Сайтын тохиргоо →</Link></div> : null}
    <div className={"grid min-w-0 gap-6 " + (canWrite ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "")}>
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="mb-4 flex flex-wrap gap-3"><input className={inputClass + " flex-1"} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} aria-label="Бүртгэл хайх" placeholder="Нэр, агуулгаар хайх" /><button disabled={pending} onClick={() => void reload()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{pending ? "Ачаалж байна…" : "Шинэчлэх"}</button></div>
        {!rows.length && !failed ? <p role="status" className="py-10 text-center text-sm text-slate-500">Бүртгэл байхгүй.</p> : null}
        <div className="divide-y">{rows.map(record => <article data-record-id={record.id} key={record.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{String(record.name || record.title || record.code || record.customerName || record.orderNumber || record.staffId || "Бүртгэл")}</h2><p className="mt-1 break-all font-mono text-xs text-slate-500">{record.id || "ID байхгүй — бүтэц бэлтгэнэ үү"}</p><p className="mt-1 text-sm text-slate-500">{[record.status, typeof record.stock === "number" ? "Үлдэгдэл: " + record.stock : "", typeof record.price === "number" ? record.price.toLocaleString("mn-MN") + " ₮" : ""].filter(Boolean).join(" · ")}</p></div>
          {canWrite ? <div className="flex shrink-0 gap-3 text-sm"><button disabled={pending || !record.id} className="font-medium text-teal-800 disabled:opacity-50" onClick={() => { setSelected(record); setError(""); setMessage(""); }}>Засах</button>{!updateOnly ? <button disabled={pending || !record.id} className="text-red-700 disabled:opacity-50" onClick={() => { if (confirm("Энэ бүртгэлийг устгахдаа итгэлтэй байна уу?")) void mutate("DELETE", { id: record.id, expectedUpdatedAt: record.updatedAt, confirmed: true }); }}>Устгах</button> : null}</div> : null}
        </article>)}</div>
        {pages > 1 ? <nav className="mt-4 flex items-center justify-between text-sm"><button disabled={current === 1} onClick={() => setPage(current - 1)}>← Өмнөх</button><span>{current} / {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)}>Дараах →</button></nav> : null}
      </section>
      {canWrite ? <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex justify-between gap-2"><h2 className="font-semibold">{selected ? "Бүртгэл засах" : updateOnly ? "Үлдэгдэл засах" : "Бүртгэл нэмэх"}</h2>{selected ? <button className="text-sm text-teal-800" onClick={() => setSelected(null)}>Болих</button> : null}</div>
        {updateOnly && !selected ? <p className="text-sm text-slate-500">Жагсаалтаас бүтээгдэхүүн сонгон бодит үлдэгдлийг өөрчилнө.</p> : <form key={(selected?.id ?? "new") + ":" + (selected?.updatedAt ?? formVersion)} onSubmit={save} className="space-y-4">
          {fields.map(field => <label key={field.key} className="grid min-w-0 gap-1 text-sm"><span>{field.label}{field.required ? " *" : ""}{field.kind === "datetime" ? " (УБ UTC+08:00)" : ""}</span>
            {field.kind === "boolean" ? <input name={field.key} type="checkbox" defaultChecked={Boolean(selected?.[field.key] ?? field.defaultValue)} className="h-4 w-4 accent-teal-800" /> :
              field.kind === "select" ? <select className={inputClass} name={field.key} defaultValue={controlValue(field, selected?.[field.key])} required={field.required}>{!field.required ? <option value="">Сонгохгүй</option> : null}{field.options?.map(option => <option key={option} value={option}>{({ draft: "Ноорог", published: "Нийтэлсэн", new: "Шинэ", confirmed: "Баталгаажсан", processing: "Бэлтгэж байна", shipped: "Хүргэлтэд", delivered: "Хүргэсэн", cancelled: "Цуцлагдсан", requested: "Хүсэлт ирсэн", completed: "Дууссан", in_progress: "Шийдвэрлэж байна", resolved: "Шийдвэрлэсэн", spam: "Спам", percent: "Хувь", fixed: "Тогтмол дүн", cash: "Бэлэн мөнгө", bank: "Банк", qpay: "QPay" } as Record<string,string>)[option] ?? option}</option>)}</select> :
              field.kind === "json" || ["body","description","note","message","summary","caption"].includes(field.key) ? <textarea className={inputClass + (field.kind === "json" ? " min-h-28 font-mono text-xs" : " min-h-24")} name={field.key} defaultValue={controlValue(field, selected?.[field.key])} required={field.required} rows={field.kind === "json" ? 4 : 3} /> :
              <input className={inputClass} name={field.key} type={field.kind === "number" ? "number" : field.kind === "datetime" ? "datetime-local" : "text"} step={field.kind === "number" ? "any" : undefined} defaultValue={controlValue(field, selected?.[field.key])} required={field.required} />}
          </label>)}
          <p className="text-xs text-slate-500">Холбогдох бүртгэлд зөвхөн энэ сайтын ID ашиглана. Зураг нь бодит HTTPS холбоос байна.</p>
          <button disabled={pending} type="submit" className="w-full rounded-lg bg-teal-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : "Хадгалах"}</button>
        </form>}
      </section> : null}
    </div>
  </div>;
}
