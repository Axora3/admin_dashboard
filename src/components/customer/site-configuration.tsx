"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SiteConfiguration({ siteId, allowed, enabled, canManage }: { siteId: string; allowed: Array<{ id: string; label: string }>; enabled: string[]; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(enabled), [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function run(operation: "prepare" | "modules") {
    setPending(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/customer/site-config?siteId=" + encodeURIComponent(siteId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, ...(operation === "modules" ? { enabledModules: selected } : {}) }), signal: AbortSignal.timeout(120000) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Үйлдэл амжилтгүй боллоо.");
      setMessage(operation === "prepare" ? data.mode === "local" ? "Локал эмуляторын бүтэц бэлэн боллоо. Google Sheets шалгаагүй." : "Google Sheets-ийн бүтэц шалгаж бэлтгэлээ." : "Идэвхтэй боломжуудыг хадгаллаа.");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Хадгалж чадсангүй."); }
    finally { setPending(false); }
  }
  return <section className="rounded-xl border bg-white p-6"><h2 className="text-lg font-semibold">Идэвхтэй боломжууд</h2><p className="mt-2 text-sm text-slate-500">Сайтын төрлөөс хамаарах боломжууд. Google Sheets ID болон нууц түлхүүрийг энд өөрчлөхгүй.</p>
    <div className="my-5 grid gap-3 sm:grid-cols-2">{allowed.map(module => <label key={module.id} className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!canManage || pending} checked={selected.includes(module.id)} onChange={e => setSelected(current => e.target.checked ? [...current, module.id] : current.filter(id => id !== module.id))} className="accent-teal-800" />{module.label}</label>)}</div>
    {canManage ? <div className="flex flex-wrap gap-3"><button disabled={pending} onClick={() => void run("modules")} className="rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50">Боломжуудыг хадгалах</button><button disabled={pending} onClick={() => void run("prepare")} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Sheets бүтэц шалгаж бэлтгэх</button></div> : <p className="text-sm text-slate-500">Эзэмшигчийн эрх шаардлагатай.</p>}
    <p className="mt-4 text-xs text-slate-500">Бүтэц бэлтгэх нь зөвхөн нэмэлт tab/багана, дутуу ID болон хувилбарын огноо үүсгэнэ. Одоо байгаа бизнесийн утгыг дарж бичихгүй. Олон мөртэй хуучин sheet-ийг эхлээд нөөцөлж, staging дээр шалгана.</p>
    {pending ? <p role="status" className="mt-4 text-sm">Үйлдэл ажиллаж байна…</p> : null}{message ? <p role="status" className="mt-4 text-sm text-teal-800">{message}</p> : null}{error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
  </section>;
}
