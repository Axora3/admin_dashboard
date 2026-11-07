"use client";
import { useActionState } from "react";
import { manageAdminAction } from "@/app/admin/actions/admins";
export function AccountForm({ stores, account }: { stores: { id: string; name: string }[]; account?: { id: string; full_name: string; is_active: boolean; storeId: string } }) {
  const [state, action, pending] = useActionState(manageAdminAction, undefined);
  return <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
    <input type="hidden" name="id" value={account?.id ?? ""} />
    <label className="grid gap-1 text-sm">Нэр<input className="rounded border p-2" name="name" required defaultValue={account?.full_name} /></label>
    {!account && <label className="grid gap-1 text-sm">Имэйл<input className="rounded border p-2" name="email" type="email" required /></label>}
    <label className="grid gap-1 text-sm">Дэлгүүр<select className="rounded border p-2" name="storeId" defaultValue={account?.storeId} required>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {account && <label className="p-2 text-sm"><input name="active" type="checkbox" defaultChecked={account.is_active} /> Идэвхтэй</label>}
    <button disabled={pending} name="operation" value={account ? "update" : "create"} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : account ? "Хадгалах" : "Admin үүсгэх"}</button>
    {account && <button disabled={pending} name="operation" value="reset" className="rounded border px-4 py-2">Нууц үг сэргээх</button>}
    {state && <p role="status" className={`w-full text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}
