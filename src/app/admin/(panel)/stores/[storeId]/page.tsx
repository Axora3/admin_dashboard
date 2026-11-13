import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Send,
  Settings,
  ShoppingCart,
  Tags,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Alert } from "@/components/admin/alert";
import { ActivityList } from "@/components/admin/activity-list";
import { StoreActions } from "@/components/admin/store-actions";
import {
  DomainStatusBadge,
  OrderStatusBadge,
  StoreStatusBadge,
} from "@/components/admin/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber, relativeTime } from "@/lib/format";
import { inviteStoreOwnerAction } from "@/app/admin/actions/stores";
import { ProvisionSheetsButton } from "@/components/admin/provision-sheets-button";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { storeId } = await params;
  const query = await searchParams;
  const repository = getRepository();
  const store = await repository.getStore(storeId);
  if (!store) notFound();

  const [analytics, orders, domains, activity, lowStock, categories] = await Promise.all([
    repository.storeAnalytics(store.id),
    repository.listOrders({ storeId: store.id, pageSize: 6 }),
    repository.listDomains({ storeId: store.id, pageSize: 20 }),
    repository.listAuditLogs({ storeId: store.id, pageSize: 6 }),
    repository.listInventory({ storeId: store.id, level: "low", pageSize: 5 }),
    repository.listCategories(store.id),
  ]);

  const invite = str(query.invite);
  const nextPath = `/admin/stores/${store.id}`;

  return (
    <>
      <PageHeader
        title={store.name}
        description={store.description || "Дэлгүүрийн мэдээлэл, үйл ажиллагаа."}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StoreStatusBadge status={store.status} />
            <Badge tone="neutral">{store.businessType}</Badge>
            {store.primaryDomain ? (
              <Badge tone="brand" dot>
                {store.primaryDomain}
              </Badge>
            ) : (
              <Badge tone="neutral">Домэйн холбогдоогүй</Badge>
            )}
            {!store.settings.visibility.published ? (
              <Badge tone="warning">Website хаалттай</Badge>
            ) : null}
          </div>
        }
        actions={
          <>
            <ProvisionSheetsButton siteId={store.id} status={store.sheets.connectionStatus} />
            <Link
              href={`/store/${store.slug}`}
              target="_blank"
              className={buttonClasses("secondary", "md")}
            >
              <ExternalLink className="h-4 w-4" /> Public website
            </Link>
            <Link
              href={`/admin/stores/${store.id}/edit`}
              className={buttonClasses("secondary", "md")}
            >
              <Settings className="h-4 w-4" /> Засах
            </Link>
            <StoreActions store={store} next={nextPath} />
          </>
        }
      />

      {str(query.created) === "1" ? (
        <Alert variant="success" className="mb-4">
          Дэлгүүр амжилттай үүслээ. Одоо бараа, ангилал, домэйноо тохируулна уу.
        </Alert>
      ) : null}
      {str(query.updated) === "1" ? (
        <Alert variant="success" className="mb-4">
          Дэлгүүрийн мэдээлэл шинэчлэгдлээ.
        </Alert>
      ) : null}
      {invite === "sent" ? (
        <Alert variant="success" className="mb-4">
          Эзэмшигчид урилга илгээгдлээ.
        </Alert>
      ) : null}
      {invite === "demo" ? (
        <Alert variant="warning" className="mb-4">
          Demo горимд имэйл илгээгдэхгүй. Production-д Supabase Auth урилга
          ашиглагдана.
        </Alert>
      ) : null}
      {invite === "failed" ? (
        <Alert variant="danger" className="mb-4">
          Урилга илгээхэд алдаа гарлаа. Supabase тохиргоо болон SMTP-г шалгана уу.
        </Alert>
      ) : null}
      {invite === "unconfigured" ? (
        <Alert variant="danger" className="mb-4">
          Supabase service role key тохируулаагүй тул урилга илгээх боломжгүй.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Нийт борлуулалт"
          value={formatCurrency(analytics.totalRevenue, "MNT", { compact: true })}
          hint="Төлөгдсөн захиалга"
          icon={Wallet}
          accent="success"
          trend={analytics.growth}
        />
        <StatCard
          label="Захиалга"
          value={formatNumber(analytics.totalOrders)}
          hint={`${orders.total} бүртгэлтэй`}
          icon={ShoppingCart}
          accent="brand"
        />
        <StatCard
          label="Харилцагч"
          value={formatNumber(analytics.totalCustomers)}
          hint="Давтагдахгүй"
          icon={Users}
          accent="info"
        />
        <StatCard
          label="Бүтээгдэхүүн"
          value={formatNumber(store.productCount)}
          hint={`${categories.length} ангилал`}
          icon={Package}
          accent="neutral"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Бизнесийн мэдээлэл"
              description="Public website болон холбоо барих мэдээлэл."
              action={
                <Link
                  href={`/admin/stores/${store.id}/edit`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Засах
                </Link>
              }
            />
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar name={store.name} src={store.logoUrl} size="lg" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink-900">{store.name}</p>
                  <p className="text-xs text-ink-400">
                    /{store.slug} · {store.currency} · {store.language.toUpperCase()}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                    {store.description || "Тайлбар оруулаагүй байна."}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 rounded-xl bg-surface-muted/70 p-3">
                  <Phone className="mt-0.5 h-4 w-4 text-ink-400" />
                  <div>
                    <p className="text-2xs text-ink-400">Утас</p>
                    <p className="text-[13px] font-medium text-ink-800">{store.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-surface-muted/70 p-3">
                  <Mail className="mt-0.5 h-4 w-4 text-ink-400" />
                  <div className="min-w-0">
                    <p className="text-2xs text-ink-400">Имэйл</p>
                    <p className="truncate text-[13px] font-medium text-ink-800">
                      {store.email || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-surface-muted/70 p-3 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-ink-400" />
                  <div>
                    <p className="text-2xs text-ink-400">Хаяг</p>
                    <p className="text-[13px] font-medium text-ink-800">
                      {store.address || "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-400">
                <CalendarDays className="h-3.5 w-3.5" />
                Үүссэн: {formatDate(store.createdAt)} · Шинэчлэгдсэн:{" "}
                {relativeTime(store.updatedAt)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Сүүлийн захиалгууд"
              description="Хамгийн сүүлд ирсэн захиалгууд."
              action={
                <Link
                  href={`/admin/orders?storeId=${store.id}`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Бүгд
                </Link>
              }
            />
            {orders.rows.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Захиалга байхгүй"
                description="Public website-ээс ирсэн захиалга энд харагдана."
              />
            ) : (
              <div className="axora-scroll">
                <table className="axora-table">
                  <thead>
                    <tr>
                      <th>Дугаар</th>
                      <th>Захиалагч</th>
                      <th>Дүн</th>
                      <th>Төлөв</th>
                      <th>Огноо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.rows.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium text-ink-900 hover:text-brand-600"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <p className="text-[13px] text-ink-800">{order.customerName}</p>
                          <p className="text-2xs text-ink-400">{order.customerPhone}</p>
                        </td>
                        <td className="whitespace-nowrap text-[13px] font-medium">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td>
                          <OrderStatusBadge status={order.orderStatus} />
                        </td>
                        <td className="whitespace-nowrap text-2xs text-ink-400">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Хурдан үйлдэл"
              description="Дэлгүүрийн бүх хэсэг рүү шилжих."
            />
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    href: `/admin/products?storeId=${store.id}`,
                    icon: Package,
                    label: "Бүтээгдэхүүн",
                    hint: `${store.productCount} бараа`,
                  },
                  {
                    href: `/admin/categories?storeId=${store.id}`,
                    icon: Tags,
                    label: "Ангилал",
                    hint: `${categories.length} ангилал`,
                  },
                  {
                    href: `/admin/orders?storeId=${store.id}`,
                    icon: ShoppingCart,
                    label: "Захиалга",
                    hint: `${store.orderCount} захиалга`,
                  },
                  {
                    href: `/admin/customers?storeId=${store.id}`,
                    icon: Users,
                    label: "Харилцагч",
                    hint: `${store.customerCount} харилцагч`,
                  },
                  {
                    href: `/admin/inventory?storeId=${store.id}`,
                    icon: Boxes,
                    label: "Үлдэгдэл",
                    hint: `${lowStock.total} бага үлдэгдэл`,
                  },
                  {
                    href: `/admin/analytics?storeId=${store.id}`,
                    icon: Wallet,
                    label: "Статистик",
                    hint: "Борлуулалтын шинжилгээ",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2.5 rounded-xl border border-ink-100 p-3 transition hover:border-ink-200 hover:bg-surface-muted/50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-ink-800">
                        {item.label}
                      </span>
                      <span className="block text-2xs text-ink-400">{item.hint}</span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-300 transition group-hover:text-brand-500" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Эзэмшигч" description="Store Owner бүртгэл." />
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={store.ownerName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">
                    {store.ownerName}
                  </p>
                  <p className="truncate text-2xs text-ink-400">{store.ownerEmail}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-2xs text-ink-500">
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-ink-400" /> {store.ownerPhone || "—"}
                </p>
                <p className="flex items-center gap-1.5">
                  <UserRound className="h-3 w-3 text-ink-400" /> Store Owner · идэвхтэй
                </p>
              </div>
              <form action={inviteStoreOwnerAction}>
                <input type="hidden" name="storeId" value={store.id} />
                <button
                  type="submit"
                  className={buttonClasses("secondary", "sm", "w-full")}
                >
                  <Send className="h-3.5 w-3.5" /> Эзэмшигчид урилга илгээх
                </button>
              </form>
              <p className="text-2xs leading-relaxed text-ink-400">
                Урилгаар эзэмшигч Supabase Auth бүртгэл үүсгэнэ. Нууц үг хэзээ ч
                гараар хадгалагдахгүй.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Домэйнууд"
              description="DNS болон SSL төлөв."
              action={
                <Link
                  href={`/admin/domains?storeId=${store.id}`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Удирдах
                </Link>
              }
            />
            <CardContent className="space-y-2.5">
              {domains.rows.length === 0 ? (
                <p className="py-3 text-center text-xs text-ink-400">
                  Домэйн бүртгэгдээгүй.
                </p>
              ) : (
                domains.rows.map((domain) => (
                  <div
                    key={domain.id}
                    className="rounded-xl border border-ink-100 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-800">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span className="truncate">{domain.domain}</span>
                      </span>
                      <DomainStatusBadge status={domain.status} />
                    </div>
                    <p className="mt-1 text-2xs text-ink-400">
                      {domain.isPrimary ? "Үндсэн домэйн" : "Нэмэлт домэйн"} ·{" "}
                      {domain.sslStatus === "active" ? "SSL идэвхтэй" : "SSL хүлээгдэж байна"}
                    </p>
                  </div>
                ))
              )}
              <Link
                href={`/admin/domains?storeId=${store.id}`}
                className={buttonClasses("ghost", "sm", "w-full")}
              >
                <Plus className="h-3.5 w-3.5" /> Домэйн нэмэх
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Бага үлдэгдэл" description="Анхаарал шаардсан бараа." />
            <CardContent className="space-y-2.5">
              {lowStock.rows.length === 0 ? (
                <p className="py-3 text-center text-xs text-ink-400">
                  Бага үлдэгдэлтэй бараа байхгүй.
                </p>
              ) : (
                lowStock.rows.map((product) => (
                  <Link
                    key={product.id}
                    href={`/admin/products/${product.id}`}
                    className="flex items-center gap-2.5 rounded-lg p-1 transition hover:bg-ink-50"
                  >
                    <Avatar name={product.name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink-800">
                        {product.name}
                      </span>
                      <span className="block text-2xs text-ink-400">
                        {product.sku || "SKU байхгүй"}
                      </span>
                    </span>
                    <span className="rounded-md bg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-warning-700">
                      {product.stock} ш
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Үйл ажиллагаа"
              description="Сүүлийн аудит бүртгэл."
              action={
                <Link
                  href={`/admin/audit-logs?storeId=${store.id}`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Бүгд
                </Link>
              }
            />
            <CardContent className="pt-1">
              <ActivityList items={activity.rows} />
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-400">
        <Building2 className="h-3 w-3" /> Store ID:{" "}
        <span className="font-mono">{store.id}</span>
      </p>
    </>
  );
}
