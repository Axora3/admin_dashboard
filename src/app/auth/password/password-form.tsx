"use client";
import { useActionState } from "react";
import { updatePassword } from "./update";
export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, "");
  return <form action={action} className="grid gap-4"><label>Шинэ нууц үг<input name="password" type="password" minLength={12} required autoComplete="new-password" className="w-full rounded border p-3" /></label><button disabled={pending} className="rounded bg-slate-900 p-3 text-white">Хадгалах</button><p role="status">{state}</p><a href="/admin/login">Нэвтрэх →</a></form>;
}
