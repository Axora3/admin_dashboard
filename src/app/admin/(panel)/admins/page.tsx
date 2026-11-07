import { requireSuperAdmin } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/data";
import { AccountForm } from "@/components/admin/account-form";

const fmt = (iso: string) => new Date(iso).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" });

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  await requireSuperAdmin();
  if (isDemoMode()) return <div className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Admin Management</h1><p className="mt-3">Store Admin account ашиглахын тулд Supabase Auth болон 0005 migration-ийг тохируулна уу. Local auth нь зөвхөн Super Admin-д зориулагдсан.</p></div>;
  const client = createSupabaseServiceClient();
  const [profiles, assignments, stores] = await Promise.all([
    client.from("profiles").select("id, email, full_name, is_active, created_at").eq("role", "store_admin").order("created_at", { ascending: false }),
    client.from("admin_assignments").select("user_id, store_id"), getRepository().listStoreOptions(),
  ]);
  if (profiles.error || assignments.error) throw new Error("Admin migration эсвэл холболтыг шалгана уу.");
  const accounts = await Promise.all((profiles.data ?? []).map(async p => {
    const user = await client.auth.admin.getUserById(p.id);
    return { ...p, email: p.email ?? user.data.user?.email ?? "", storeId: assignments.data?.find(a => a.user_id === p.id)?.store_id ?? "", lastLogin: user.data.user?.last_sign_in_at };
  }));
  const active = accounts.filter(a => a.is_active && a.storeId).length;
  const unassignedStores = stores.filter(s => !accounts.some(a => a.storeId === s.id));
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Admin Management</h1><p className="mt-2 text-slate-500">Зөвхөн Super Admin нь Store Admin үүсгэж, оноох эрхтэй. Нууц үгийг Supabase Auth удирдана — систем нууц үг хадгалахгүй.</p></header>
    <div className="grid gap-3 sm:grid-cols-3">{[["Store Admin", accounts.length], ["Идэвхтэй", active], ["Admin-гүй дэлгүүр", unassignedStores.length]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    {notice && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">{notice}</p>}
    <section className="space-y-2"><h2 className="font-semibold">Шинэ Store Admin</h2><AccountForm stores={stores} /></section>
    <section className="space-y-4"><h2 className="font-semibold">Бүртгэлтэй Store Admin</h2>
      {accounts.map(a => {
        const state = !a.storeId ? "Эрх цуцлагдсан" : a.is_active ? "Идэвхтэй" : "Идэвхгүй";
        return <article key={a.id} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span><strong>{a.email}</strong> · <span className={!a.storeId || !a.is_active ? "text-red-700" : "text-emerald-700"}>{state}</span> · {stores.find(s => s.id === a.storeId)?.name ?? "Дэлгүүр оноогоогүй"}</span>
            <span className="text-slate-500">Үүссэн: {fmt(a.created_at)} · Сүүлд нэвтэрсэн: {a.lastLogin ? fmt(a.lastLogin) : "Нэвтрээгүй"} · <a className="text-blue-700" href={`/admin/admins/${a.id}`}>Үйлдлийн түүх →</a></span>
          </div>
          <AccountForm stores={stores} account={a} />
        </article>;
      })}
      {!accounts.length && <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Store Admin бүртгэгдээгүй.</p>}
    </section>
  </div>;
}
