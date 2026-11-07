import Link from "next/link";
import { StoreOverview } from "@/components/admin/store-overview";
import { hasPermission, type Permission } from "@/lib/platform/permissions";
import { notFound } from "next/navigation";

const SECTION_PERMISSION: Record<string, Permission> = {
  overview: "analytics.read", products: "products.read", categories: "products.read", orders: "orders.read",
  customers: "customers.read", settings: "settings.manage", "audit-logs": "audit.read",
};
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { getRepository } from "@/lib/data";
import { StoreMutationForm } from "@/components/admin/store-mutation-form";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white p-2.5";
function Field({ name, label, value = "", type = "text" }: { name: string; label: string; value?: string | number; type?: string }) { return <label className="grid gap-1 text-sm">{label}<input className={inputClass} name={name} type={type} defaultValue={value} min={type === "number" ? 0 : undefined} step={type === "number" ? "any" : undefined} /></label>; }
function Box({ children }: { children: React.ReactNode }) { return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>; }
export default async function StorePage({ params, searchParams }: { params: Promise<{ section?: string[] }>; searchParams: Promise<Record<string,string | undefined>> }) {
  const { section = [] } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const current = section[0] || "overview";
  // "analytics" and "notifications" have dedicated routes.
  if (section.length > 1 || !SECTION_PERMISSION[current]) notFound();
  return withStoreAdmin(async admin => {
    // Server-side read authorization; storeId always comes from the verified assignment.
    if (!hasPermission(admin, SECTION_PERMISSION[current], admin.storeId)) notFound();
    const repo = getRepository();
    const store = await repo.getStore(admin.storeId);
    if (!store) notFound();
    const titles: Record<string,string> = { overview: store.name, products: "Бүтээгдэхүүн", categories: "Ангилал", orders: "Захиалга", customers: "Хэрэглэгчид", settings: "Дэлгүүрийн тохиргоо", "audit-logs": "Үйлдлийн түүх" };
    let content: React.ReactNode;
    if (current === "overview") {
      content = <StoreOverview storeId={admin.storeId} currency={store.currency} />;
    } else if (current === "products") {
      const products = await repo.listProducts({ storeId: admin.storeId, page, pageSize: 20, search: query.search });
      const categories = await repo.listCategories(admin.storeId);
      const edit = query.edit ? await repo.getProduct(query.edit) : null;
      if (query.edit && !edit) notFound();
      content = <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Box><form className="mb-4 flex gap-2"><input className={inputClass} name="search" defaultValue={query.search} placeholder="Нэрээр хайх" aria-label="Бүтээгдэхүүн хайх" /><button className="rounded border px-3">Хайх</button></form>{products.rows.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-4"><div><Link href={`?edit=${encodeURIComponent(p.id)}`} className="font-medium text-teal-800">{p.name} ↗</Link><p className="text-sm text-slate-500">{p.price.toLocaleString()} ₮ · Үлдэгдэл {p.stock} · {p.isActive ? "Идэвхтэй" : "Идэвхгүй"}</p></div><StoreMutationForm operation="product.delete" id={p.id} label="Устгах" /></div>)}{!products.total && <p>Бүтээгдэхүүн олдсонгүй.</p>}<Pages page={page} count={products.pageCount} search={query.search} /></Box><Box><h2 className="mb-4 text-lg font-semibold">{edit ? "Бүтээгдэхүүн засах" : "Бүтээгдэхүүн нэмэх"}</h2><StoreMutationForm key={edit?.id || "new"} operation="product.save" id={edit?.id}>
        <Field name="name" label="Нэр" value={edit?.name} /><Field name="slug" label="URL нэр" value={edit?.slug} /><Field name="description" label="Тайлбар" value={edit?.description} /><Field name="price" label="Үнэ" type="number" value={edit?.price ?? 0} /><Field name="salePrice" label="Хямдарсан үнэ" type="number" value={edit?.salePrice ?? ""} /><Field name="stock" label="Үлдэгдэл" type="number" value={edit?.stock ?? 0} /><Field name="sku" label="SKU" value={edit?.sku} /><label className="grid gap-1 text-sm">Ангилал<select className={inputClass} name="categoryId" defaultValue={edit?.categoryId ?? ""}><option value="">Ангилалгүй</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="grid gap-1 text-sm">Зургийн URL (мөр бүрт нэг)<textarea className={inputClass} name="images" defaultValue={edit?.images.join("\n")} /></label><label className="block text-sm"><input type="checkbox" name="isActive" defaultChecked={edit?.isActive ?? true} /> Идэвхтэй</label>
      </StoreMutationForm>{edit && <Link href="/store-admin/products" className="mt-4 block text-sm text-teal-800">Шинээр нэмэх →</Link>}</Box></div>;
    } else if (current === "categories") {
      const categories = await repo.listCategories(admin.storeId);
      content = <div className="grid gap-4 md:grid-cols-2">{[null, ...categories].map(c => <Box key={c?.id ?? "new"}><h2 className="mb-3 font-semibold">{c ? "Ангилал засах" : "Ангилал нэмэх"}</h2><StoreMutationForm operation="category.save" id={c?.id}><Field name="name" label="Нэр" value={c?.name} /><Field name="description" label="Тайлбар" value={c?.description} /><Field name="sortOrder" label="Дараалал" type="number" value={c?.sortOrder ?? 0} /></StoreMutationForm>{c && <div className="mt-3"><StoreMutationForm operation="category.delete" id={c.id} label="Устгах" /></div>}</Box>)}</div>;
    } else if (current === "orders") {
      const orders = await repo.listOrders({ storeId: admin.storeId, page, pageSize: 20 });
      content = <Box>{orders.rows.map(o => <div key={o.id} className="grid gap-3 border-b py-4 md:grid-cols-2"><div><h2 className="font-semibold">{o.orderNumber} · {o.totalAmount.toLocaleString()} ₮</h2><p>{o.customerName} · {o.customerPhone}</p><p className="text-sm text-slate-500">{o.customerAddress} · {o.paymentStatus}</p>{o.items.map(i => <p key={i.id} className="text-sm">{i.productName} × {i.quantity}</p>)}</div><StoreMutationForm operation="order.status" id={o.id}><label className="grid gap-1 text-sm">Захиалгын төлөв<select name="status" className={inputClass} defaultValue={o.orderStatus}>{["new","confirmed","processing","shipped","delivered","cancelled"].map(s => <option key={s}>{s}</option>)}</select></label></StoreMutationForm></div>)}{!orders.total && <p>Захиалга байхгүй.</p>}<Pages page={page} count={orders.pageCount} /></Box>;
    } else if (current === "customers") {
      const customers = await repo.listCustomers({ storeId: admin.storeId, page, pageSize: 20, search: query.search });
      content = <Box><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Нэр","Утас","Имэйл","Захиалга","Нийт дүн"].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{customers.rows.map(c => <tr key={c.id} className="border-t">{[c.name,c.phone,c.email,c.orderCount,`${c.totalSpent.toLocaleString()} ₮`].map((v,i) => <td key={i} className="p-3">{v}</td>)}</tr>)}</tbody></table></div>{!customers.total && <p>Хэрэглэгч байхгүй.</p>}<Pages page={page} count={customers.pageCount} /></Box>;
    } else if (current === "settings") {
      content = <Box><StoreMutationForm operation="settings.save"><div className="grid gap-4 md:grid-cols-2"><Field name="name" label="Дэлгүүрийн нэр" value={store.name} /><Field name="email" label="Имэйл" type="email" value={store.email} /><Field name="phone" label="Утас" value={store.phone} /><Field name="address" label="Хаяг" value={store.address} /><Field name="description" label="Тайлбар" value={store.description} /></div></StoreMutationForm></Box>;
    } else {
      const logs = await repo.listAuditLogs({ storeId: admin.storeId, page, pageSize: 20 });
      content = <Box>{logs.rows.map(l => <details key={l.id} className="border-b py-4"><summary className="cursor-pointer">{l.actorName} · {l.action} · {new Date(l.createdAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}</summary><pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(l.metadata,null,2)}</pre></details>)}{!logs.total && <p>Үйлдлийн бүртгэл байхгүй.</p>}<Pages page={page} count={logs.pageCount} /></Box>;
    }
    return <div className="space-y-6"><header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">{store.name} / Store workspace</p><h1 className="text-3xl font-semibold">{titles[current]}</h1></header>{content}</div>;
  });
}
function Pages({ page, count, search }: { page: number; count: number; search?: string }) { return count > 1 ? <nav className="mt-4 flex justify-between text-sm"><Link href={`?page=${Math.max(1,page-1)}&search=${encodeURIComponent(search ?? "")}`}>← Өмнөх</Link><span>{page} / {count}</span><Link href={`?page=${Math.min(count,page+1)}&search=${encodeURIComponent(search ?? "")}`}>Дараах →</Link></nav> : null; }
