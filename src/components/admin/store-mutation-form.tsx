"use client";
import { useActionState, type ReactNode } from "react";
import { storeMutation } from "@/app/store-admin/actions";
export function StoreMutationForm({ children, operation, id = "", label = "Хадгалах" }: { children?: ReactNode; operation: string; id?: string; label?: string }) {
  const [state, action, pending] = useActionState(storeMutation, undefined);
  return <form action={action} onSubmit={e => { if (operation.endsWith("delete") && !confirm("Устгахдаа итгэлтэй байна уу?")) e.preventDefault(); }} className="space-y-3">
    <input type="hidden" name="operation" value={operation} /><input type="hidden" name="id" value={id} />
    {children}<button disabled={pending} className="rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Хадгалж байна…" : label}</button>
    {state && <p role="status" className={`text-sm ${state.ok ? "text-teal-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}
