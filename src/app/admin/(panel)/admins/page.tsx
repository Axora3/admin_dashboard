import { requireSuperAdmin } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/config";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/data";
import { AccountForm } from "@/components/admin/account-form";
export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  await requireSuperAdmin();
  if (isDemoMode()) return <div className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">Admin Management</h1><p className="mt-3">Store Admin account ашиглахын тулд Supabase Auth болон 0005 migration-ийг тохируулна уу. Local auth нь зөвхөн Super Admin-д зориулагдсан.</p></div>;
  const client = createSupabaseServiceClient();
  const [profiles, assignments, stores] = await Promise.all([
    client.from("profiles").select("id, email, full_name, is_active, created_at").eq("role", "store_admin"),
    client.from("admin_assignments").select("user_id, store_id"), getRepository().listStoreOptions(),
  ]);
  if (profiles.error || assignments.error) throw new Error("Admin migration эсвэл холболтыг шалгана уу.");
  const accounts = await Promise.all((profiles.data ?? []).map(async p => {
    const user = await client.auth.admin.getUserById(p.id);
    return { ...p, storeId: assignments.data?.find(a => a.user_id === p.id)?.store_id ?? "", lastLogin: user.data.user?.last_sign_in_at };
  }));
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Admin Management</h1><p className="mt-2 text-slate-500">Дэлгүүр бүрт нэг үндсэн Store Admin. Нууц үгийг Supabase Auth удирдана.</p></header>
    {notice && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">{notice}</p>}
    <AccountForm stores={stores} />
    {accounts.map(a => <section key={a.id} className="space-y-2"><div className="flex flex-wrap justify-between text-sm"><span>{a.email} · Үүссэн: {new Date(a.created_at).toLocaleDateString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })} · Сүүлд нэвтэрсэн: {a.lastLogin ? new Date(a.lastLogin).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "Нэвтрээгүй"}</span><a className="text-blue-700" href={`/admin/admins/${a.id}`}>Үйлдлийн түүх →</a></div><AccountForm stores={stores} account={a} /></section>)}
  </div>;
}
