import Link from "next/link";
import { notFound } from "next/navigation";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { getStoreRegistry } from "@/lib/registry";
import { siteIntegrationConfig } from "@/lib/google/site-config";
import { canonicalBusinessType, modulesForBusiness } from "@/lib/google/schema-registry";
import { readCustomerModule, type CustomerRecord } from "@/lib/customer/data";
import { fieldsForSite } from "@/lib/customer/schema";
import { MODULE_LABELS, BUSINESS_LABELS, modulePermission } from "@/lib/customer/modules";
import { hasPermission } from "@/lib/platform/permissions";
import { RecordManager } from "@/components/customer/record-manager";
import { SiteConfiguration } from "@/components/customer/site-configuration";
import { SubscriptionPanel } from "@/components/customer/subscription-panel";
import { listPlatformAuditLogs } from "@/lib/registry/audit-store";
export default async function CustomerSitePage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const current = section[0] || "overview";
  return withStoreAdmin(async actor => {
    const store = await getStoreRegistry().get(actor.storeId);
    if (!store) notFound();
    const config = siteIntegrationConfig(store), type = canonicalBusinessType(store.businessType);
    const title = current === "overview" ? store.name : current === "settings" ? "Сайтын тохиргоо" : current === "subscription" ? "Захиалга ба төлбөр" : current === "audit-logs" ? "Үйлдлийн түүх" : MODULE_LABELS[current as keyof typeof MODULE_LABELS];
    let content: React.ReactNode;
    if (current === "overview") {
      const domain = store.domains.find(d => d.isPrimary && d.status === "active" && d.verificationStatus === "verified");
      const moduleItems = config.enabled_modules.filter(module => MODULE_LABELS[module]);
      const userRole = actor.siteRole === "viewer" ? "Зөвхөн харах эрх" : actor.siteRole === "editor" ? "Засварлах эрх" : "Сайтын эзэмшигч";
      content = <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-[#E9EAF0] bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(250px,0.7fr)]">
            <div className="p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#D95751]">Таны AXORA сайт</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#191A20] md:text-3xl">{store.name}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#777B85]">Сайтын мэдээлэл, бүтээгдэхүүн болон тохиргоогоо нэг дороос удирдаарай.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {domain ? <a className="inline-flex items-center gap-2 rounded-lg bg-[#F16B65] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DF5D57]" href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer">Вэбсайтаа нээх <span aria-hidden>↗</span></a> : <Link className="inline-flex items-center gap-2 rounded-lg bg-[#F16B65] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#DF5D57]" href="/store-admin/settings">Сайтын тохиргоо <span aria-hidden>→</span></Link>}
                {moduleItems[0] ? <Link className="inline-flex items-center gap-2 rounded-lg border border-[#E9EAF0] px-4 py-2.5 text-sm font-semibold text-[#444751] transition hover:border-[#F16B65]" href={`/store-admin/${moduleItems[0]}`}>Мэдээллээ удирдах <span aria-hidden>→</span></Link> : null}
              </div>
            </div>
            <div className="border-t border-[#E9EAF0] bg-[#FAFAFB] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#454852]">Сайтын мэдээлэл</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${domain ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{domain ? "Идэвхтэй домэйн" : "Домэйн холбогдоогүй"}</span></div>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-xs text-[#777B85]">Домэйн</dt><dd className="mt-1 break-all font-medium text-[#252730]">{domain ? domain.domain : "Баталгаажсан домэйн алга"}</dd></div>
                <div><dt className="text-xs text-[#777B85]">Бизнесийн төрөл</dt><dd className="mt-1 font-medium text-[#252730]">{BUSINESS_LABELS[type]}</dd></div>
                <div><dt className="text-xs text-[#777B85]">Таны эрх</dt><dd className="mt-1 font-medium text-[#252730]">{userRole}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section aria-label="Сайтын товч мэдээлэл" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Идэвхтэй боломж", value: String(moduleItems.length), detail: "Таны сайтад тохируулсан" },
            { label: "Сайтын холболт", value: config.integration_status === "connected" ? "Хэвийн" : config.integration_status === "local" ? "Туршилт" : config.integration_status === "provisioning" ? "Тохируулж байна" : "Шалгах шаардлагатай", detail: "Мэдээллийн сангийн төлөв" },
            { label: "Бүртгэлийн дугаар", value: store.id, detail: "AXORA дэмжлэгтэй холбогдоход ашиглана", compact: true },
          ].map(card => <article key={card.label} className="rounded-xl border border-[#E9EAF0] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-[#777B85]">{card.label}</p>
            <p className={`mt-3 truncate font-semibold tracking-tight text-[#202129] ${card.compact ? "text-sm" : "text-2xl"}`} title={card.value}>{card.value}</p>
            <p className="mt-1.5 text-xs text-[#9295A0]">{card.detail}</p>
          </article>)}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#202129]">Сайтын хэрэгслүүд</h2><p className="mt-1 text-sm text-[#777B85]">Танд нээлттэй боломжууд</p></div><span className="text-xs text-[#9295A0]">{moduleItems.length} боломж</span></div>
          {moduleItems.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{moduleItems.map(module => <Link key={module} href={`/store-admin/${module}`} className="group flex min-h-[102px] items-center gap-4 rounded-xl border border-[#E9EAF0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#F3B1AD] hover:shadow-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFF0EF] text-[#D95751]"><span className="text-lg" aria-hidden>↗</span></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#252730]">{MODULE_LABELS[module]}</span><span className="mt-1 block text-xs text-[#858894]">Энэ сайтын мэдээллийг удирдах</span></span>
            <span className="text-lg text-[#B7BAC3] transition group-hover:translate-x-0.5 group-hover:text-[#D95751]" aria-hidden>→</span>
          </Link>)}</div> : <p className="rounded-xl border border-dashed border-[#D8DAE0] bg-white p-8 text-center text-sm text-[#777B85]">Одоогоор удирдах боломж тохируулаагүй байна.</p>}
        </section>
      </div>;
    } else if (current === "subscription") content = <SubscriptionPanel siteId={store.id} />;
    else if (current === "settings") content = <div className="space-y-5"><section className="rounded-xl border bg-white p-6"><h2 className="font-semibold">{store.name}</h2><p className="mt-2 text-sm text-slate-500">{BUSINESS_LABELS[type]} · {store.id}</p><p className="mt-3 text-sm">Эзэмшигч: {store.ownerName || "Тохируулаагүй"} · {store.ownerEmail}</p><p className="mt-2 text-sm text-slate-500">Sheets: {config.integration_status} · Бүтцийн хувилбар {config.schema_version} · Тохиргооны хувилбар {config.configuration_version}</p></section><SiteConfiguration key={store.id + ":" + config.configuration_version} siteId={store.id} allowed={modulesForBusiness(type).filter(id => MODULE_LABELS[id]).map(id => ({ id,label:MODULE_LABELS[id]! }))} enabled={config.enabled_modules} canManage={hasPermission(actor,"settings.manage",store.id)} /></div>;
    else if (current === "audit-logs") {
      if (!hasPermission(actor,"audit.read",store.id)) notFound();
      const logs = await listPlatformAuditLogs({storeId:store.id,pageSize:100},new Map([[store.id,store.name]]));
      content = <section className="rounded-xl border bg-white p-5">{logs.rows.length ? logs.rows.map(log => <div key={log.id} className="border-b py-4 text-sm"><p>{log.actorName} · {log.action}</p><p className="mt-1 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("mn-MN",{timeZone:"Asia/Ulaanbaatar"})}</p></div>) : <p className="text-sm text-slate-500">Үйлдлийн бүртгэл байхгүй.</p>}</section>;
    } else {
      if (!title || !config.enabled_modules.includes(current as never) || !hasPermission(actor,modulePermission(current),store.id)) notFound();
      // Inventory edits the same Products.stock consumed by the customer website; historical journal rows are not stock commands.
      const resource = current === "inventory" ? "products" : current;
      let records: CustomerRecord[] = [], failed = false;
      try { records = await readCustomerModule(actor,store,resource); } catch { failed = true; }
      let fields = fieldsForSite(store,resource).filter(field => field.key !== "paymentStatus");
      if (current === "inventory") fields = fields.filter(field => field.key === "stock");
      content = <>{current === "inventory" ? <p className="mb-4 rounded-lg border bg-white p-4 text-sm text-slate-600">Энд бүтээгдэхүүний бодит үлдэгдлийг өөрчилнө. Түүхийн журнал нь тусдаа бүртгэл; журналын мөр засах нь үлдэгдэл өөрчлөх команд биш.</p> : null}<RecordManager key={store.id + ":" + current} siteId={store.id} module={resource} fields={fields} initialRecords={records} initialError={failed} canWrite={hasPermission(actor,modulePermission(current,true),store.id)} updateOnly={current === "inventory"} /></>;
    }
    return <div className="space-y-6"><header><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#D95751]">{BUSINESS_LABELS[type]}</p><h1 className="text-2xl font-semibold tracking-tight text-[#202129] md:text-3xl">{current === "overview" ? "Тойм" : title}</h1></header>{content}</div>;
  });
}
