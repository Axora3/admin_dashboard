"use client";
import { useActionState,type ReactNode } from "react";
import { platformAction } from "@/app/admin/actions/platform";
export function PlatformForm({operation,children,label="Хадгалах"}:{operation:string;children?:ReactNode;label?:string}) {
  const [state,action,pending]=useActionState(platformAction,undefined);
  return <form action={action} className="space-y-3"><input name="operation" type="hidden" value={operation}/>{children}<button disabled={pending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending?"Ажиллаж байна…":label}</button>{state&&<p role="status" className={`text-sm ${state.ok?"text-emerald-700":"text-red-700"}`}>{state.message}</p>}</form>;
}
