"use client";
import { useActionState, useState } from "react";
import { manageAdminAction } from "@/app/admin/actions/admins";

type Account = { id: string; email: string; full_name: string; is_active: boolean; storeId: string };

export function AccountForm({ stores, account }: { stores: { id: string; name: string }[]; account?: Account }) {
  const [state, action, pending] = useActionState(manageAdminAction, undefined);
  const [revoking, setRevoking] = useState(false);
  const revoked = Boolean(account && !account.storeId);
  return <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
    <input type="hidden" name="id" value={account?.id ?? ""} />
    <label className="grid gap-1 text-sm">Нэр<input className="rounded border p-2" name="name" required defaultValue={account?.full_name} /></label>
    {!account && <label className="grid gap-1 text-sm">Имэйл<input className="rounded border p-2" name="email" type="email" required /></label>}
    <label className="grid gap-1 text-sm">Дэлгүүр<select className="rounded border p-2" name="storeId" defaultValue={account?.storeId || ""} required>
      {revoked && <option value="" disabled>— Оноогоогүй —</option>}
      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    {account && <label className="p-2 text-sm"><input name="active" type="checkbox" defaultChecked={account.is_active} /> Идэвхтэй</label>}
    <button disabled={pending} name="operation" value={account ? "update" : "create"} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : account ? (revoked ? "Дахин оноох" : "Хадгалах") : "Admin үүсгэх"}</button>
    {account && <button disabled={pending} name="operation" value="reset" formNoValidate className="rounded border px-4 py-2">Нууц үг сэргээх</button>}
    {account && !revoked && !revoking && <button type="button" onClick={() => setRevoking(true)} className="rounded border border-red-200 px-4 py-2 text-red-700">Эрх цуцлах</button>}
    {account && revoking && <div className="flex w-full flex-wrap items-end gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <label className="grid gap-1 text-sm">Баталгаажуулах: <strong>{account.email}</strong><input className="rounded border bg-white p-2" name="confirmation" autoComplete="off" /></label>
      <button disabled={pending} name="operation" value="revoke" formNoValidate className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">Эрхийг бүрэн цуцлах</button>
      <button type="button" onClick={() => setRevoking(false)} className="px-2 py-2 text-sm">Болих</button>
      <p className="w-full text-xs text-red-800">Account идэвхгүй болж, дэлгүүрийн оноолт устна. Нэвтэрсэн session дараагийн хүсэлт дээр хаагдана.</p>
    </div>}
    {state && <p role="status" className={`w-full text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}
