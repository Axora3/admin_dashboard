import Link from "next/link";
import { requireStoreAdmin } from "@/lib/auth/server";
import { logoutAction } from "@/app/admin/actions/auth";
const navigation = [["", "Хянах самбар"], ["products", "Бүтээгдэхүүн"], ["categories", "Ангилал"], ["orders", "Захиалга"], ["customers", "Хэрэглэгчид"], ["analytics", "Статистик"], ["settings", "Тохиргоо"], ["notifications", "Мэдэгдэл"], ["audit-logs", "Үйлдлийн түүх"]];
export default async function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireStoreAdmin();
  return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="bg-teal-950 px-6 py-5 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><Link href="/store-admin" className="text-xl font-bold tracking-widest">AXORA <span className="ml-3 text-xs font-normal tracking-normal text-teal-200">STORE ADMIN</span></Link><div className="flex items-center gap-5 text-sm"><span>{admin.fullName}</span><form action={logoutAction}><button>Гарах →</button></form></div></div></header><nav className="border-b bg-white px-6"><div className="mx-auto flex max-w-7xl flex-wrap gap-x-6">{navigation.map(([path, label]) => <Link key={path} className="py-4 text-sm font-medium hover:text-teal-700" href={`/store-admin${path ? `/${path}` : ""}`}>{label}</Link>)}</div></nav><main className="mx-auto max-w-7xl p-6 md:p-8">{children}</main></div>;
}
