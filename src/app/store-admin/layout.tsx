import { requireStoreAdmin } from "@/lib/auth/server";
import { logoutAction } from "@/app/admin/actions/auth";
import { getStoreRegistry } from "@/lib/registry";
import { siteIntegrationConfig } from "@/lib/google/site-config";
import { MODULE_LABELS } from "@/lib/customer/modules";
import { SiteSwitcher } from "@/components/customer/site-switcher";
import { StoreConnectionWarning } from "@/components/admin/store-connection-indicator";
import { CustomerPortalNavigation } from "@/components/customer/portal-navigation";
import { sheetsMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStoreAdmin();
  const registry = getStoreRegistry();
  const store = await registry.get(actor.storeId);
  const sites = (await Promise.all((actor.siteIds ?? [actor.storeId]).map(id => registry.get(id))))
    .filter(site => site?.status === "active");
  const config = store ? siteIntegrationConfig(store) : null;
  const navigation = [
    { id: "overview", label: "Тойм", href: "/store-admin" },
    ...(config?.enabled_modules.filter(id => MODULE_LABELS[id]).map(id => ({
      id, label: MODULE_LABELS[id]!, href: `/store-admin/${id}`,
    })) ?? []),
    ...(config?.business_type === "online_store" && config.enabled_modules.includes("orders")
      ? [{ id: "deliveries", label: "Хүргэлт", href: "/store-admin/deliveries" }, { id: "analytics", label: "Статистик", href: "/store-admin/analytics" }]
      : []),
    { id: "subscription", label: "Захиалга ба төлбөр", href: "/store-admin/subscription" },
    { id: "settings", label: "Сайтын тохиргоо", href: "/store-admin/settings" },
    { id: "notifications", label: "Мэдэгдэл", href: "/store-admin/notifications" },
    { id: "audit-logs", label: "Үйлдлийн түүх", href: "/store-admin/audit-logs" },
  ];
  const status = store?.sheets.connectionStatus ?? "error";

  return <div className="portal-shell min-h-screen bg-[#F4F4F6] text-[#191A20]">
    <CustomerPortalNavigation items={navigation} brandName={store?.name ?? "AXORA"} />
    <div className="portal-main min-h-screen min-w-0">
      <header className="portal-topbar sticky top-0 z-30 flex min-h-[76px] flex-wrap items-center justify-between gap-3 border-b border-[#E9EAF0] bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-[#777B85]">AXORA <span className="px-1 text-[#C4C6CC]">/</span> {store?.name ?? "Миний сайт"}</p>
            <p className="mt-1 text-sm font-semibold">Хэрэглэгчийн портал</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          {sites.length > 1 ? <SiteSwitcher sites={sites.map(site => ({ id: site!.id, name: site!.name }))} selected={actor.storeId} /> : null}
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
            {status === "connected" ? "Холболт хэвийн" : status === "local" ? "Туршилтын горим" : status === "provisioning" ? "Тохируулж байна" : status === "unconfigured" ? "Холбогдоогүй" : "Холболтыг шалгана уу"}
          </span>
          <div className="hidden h-8 w-px bg-[#E9EAF0] sm:block" />
          <div className="text-right">
            <p className="max-w-40 truncate text-sm font-semibold">{actor.fullName}</p>
            <p className="text-xs text-[#777B85]">Таны бүртгэл</p>
          </div>
          <form action={logoutAction}><button className="rounded-lg border border-[#E9EAF0] px-3 py-2 text-sm font-medium text-[#555963] transition hover:border-[#F16B65] hover:text-[#D95751]">Гарах</button></form>
        </div>
      </header>
      <StoreConnectionWarning status={status} />
      {sheetsMode() === "local" ? <p className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900" role="status">Локал туршилтын өгөгдөл ашиглаж байна. Эндэх өөрчлөлт Google Sheets-д бичигдэхгүй.</p> : null}
      <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7 xl:p-9">{children}</main>
    </div>
  </div>;
}
