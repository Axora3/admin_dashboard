import Link from "next/link";
import { PlatformOverview } from "@/components/admin/platform-overview";
import { AnalyticsReport } from "@/components/admin/analytics-report";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ExternalLink,
  Globe,
  Package,
  PauseCircle,
  Plus,
  ShoppingCart,
  Store as StoreIcon,
  Users,
  Wallet,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { ActivityList } from "@/components/admin/activity-list";
import { OrderStatusBadge, StoreStatusBadge } from "@/components/admin/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AreaChart, BarChart, ProgressBar } from "@/components/ui/chart";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber, relativeTime } from "@/lib/format";
import { percentChange } from "@/lib/utils";
import type { Store } from "@/lib/types";

export default async function DashboardPage() {
  const context = await getStoreContext();
  if (context.store) {
    return <StoreDashboard store={context.store} />;
  }

  const repository = getRepository();
  const [stats, activity] = await Promise.all([
    repository.platformStats(),
    repository.listAuditLogs({ page: 1, pageSize: 7 }),
  ]);

  const currentRevenue = stats.monthlySales.at(-1)?.value ?? 0;
  if ((stats.currencies?.length??0)>1) return <><PlatformOverview stats={stats}/><AnalyticsReport query={{}} basePath="/admin/dashboard"/></>;
  const previousRevenue = stats.monthlySales.at(-2)?.value ?? 0;
  const revenueTrend = percentChange(currentRevenue, previousRevenue);
  const recentOrders = stats.dailyOrders.reduce((sum, point) => sum + point.value, 0);
  const maxStoreRevenue = Math.max(...stats.topStores.map((store) => store.revenue), 1);

  return (
    <>
      <PlatformOverview stats={stats} />
      {stats.unavailableStores?.length ? <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Мэдээлэл дутуу: {stats.unavailableStores.join(", ")}. Зөвхөн амжилттай ачаалсан дэлгүүрүүдийн дүнг харуулж байна.</p> : null}
      <p className="mb-4 text-xs text-ink-500">Sheets data refreshed: {stats.refreshedAt ?? "Unknown"}</p>
      <PageHeader
        title="Хянах самбар"
        description="AXORA платформын бүх дэлгүүрийн нэгдсэн гүйцэтгэл, сүүлийн үйл ажиллагаа."
        actions={
          <>
            <Link href="/admin/stores" className={buttonClasses("secondary", "md")}>
              <StoreIcon className="h-4 w-4" /> Бүх дэлгүүр
            </Link>
            <Link href="/admin/stores/new" className={buttonClasses("primary", "md")}>
              <Plus className="h-4 w-4" /> Шинэ дэлгүүр
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Нийт дэлгүүр"
          value={formatNumber(stats.totalStores)}
          hint={`${stats.activeStores} идэвхтэй · ${stats.archivedStores} архив`}
          icon={StoreIcon}
          accent="brand"
        />
        <StatCard
          label="Идэвхтэй дэлгүүр"
          value={formatNumber(stats.activeStores)}
          hint="Public website нээлттэй"
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard
          label="Түр хаасан"
          value={formatNumber(stats.suspendedStores)}
          hint="Website түр хаалттай"
          icon={PauseCircle}
          accent="warning"
        />
        <StatCard
          label="Нийт бүтээгдэхүүн"
          value={formatNumber(stats.totalProducts)}
          hint="Бүх дэлгүүрийн бараа"
          icon={Package}
          accent="info"
        />
        <StatCard
          label="Нийт захиалга"
          value={formatNumber(stats.totalOrders)}
          hint={`Сүүлийн 14 хоног: ${formatNumber(recentOrders)}`}
          icon={ShoppingCart}
          accent="brand"
        />
        <StatCard
          label="Нийт хэрэглэгч"
          value={formatNumber(stats.totalCustomers)}
          hint="Захиалгаар тодорхойлогдсон"
          icon={Users}
          accent="neutral"
        />
        <StatCard
          label="Нийт борлуулалт"
          value={formatCurrency(stats.totalRevenue, "MNT", { compact: true })}
          hint="Төлөгдсөн, цуцлагдаагүй"
          icon={Wallet}
          accent="success"
          trend={revenueTrend}
        />
        <StatCard
          label="Домэйн холболт"
          value={`${stats.connectedDomains}/${stats.totalDomains}`}
          hint="SSL идэвхтэй домэйн"
          icon={Globe}
          accent="warning"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Сарын борлуулалт"
            description="Сүүлийн 6 сарын төлөгдсөн захиалгын нийт дүн."
            action={
              <span className="rounded-lg bg-ink-50 px-2 py-1 text-2xs font-medium text-ink-500">
                MNT
              </span>
            }
          />
          <CardContent>
            <div className="mb-3 flex items-end gap-2">
              <p className="text-2xl font-semibold tracking-tight text-ink-950">
                {formatCurrency(currentRevenue)}
              </p>
              <span className="pb-1 text-2xs text-ink-400">энэ сар</span>
            </div>
            <AreaChart
              data={stats.monthlySales}
              valueLabel={(value) => formatCurrency(value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Өдрийн захиалга"
            description="Сүүлийн 14 хоногийн захиалгын тоо."
          />
          <CardContent>
            <div className="mb-3 flex items-end gap-2">
              <p className="text-2xl font-semibold tracking-tight text-ink-950">
                {formatNumber(recentOrders)}
              </p>
              <span className="pb-1 text-2xs text-ink-400">захиалга</span>
            </div>
            <BarChart data={stats.dailyOrders} height={180} valueLabel={(v) => `${v} захиалга`} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Хамгийн их борлуулалттай дэлгүүр"
            description="Нийт борлуулалтаар эрэмбэлсэн."
            action={
              <Link
                href="/admin/stores?sort=revenue"
                className="text-2xs font-medium text-brand-600 hover:underline"
              >
                Бүгд
              </Link>
            }
          />
          <CardContent className="space-y-4">
            {stats.topStores.length === 0 ? (
              <EmptyState icon={StoreIcon} title="Дэлгүүр байхгүй" />
            ) : (
              stats.topStores.map((store, index) => (
                <Link
                  key={store.id}
                  href={`/admin/stores/${store.id}`}
                  className="block rounded-xl p-1 transition hover:bg-ink-50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 text-2xs font-semibold text-ink-300">
                      {index + 1}
                    </span>
                    <Avatar name={store.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-800">
                        {store.name}
                      </p>
                      <p className="text-2xs text-ink-400">
                        {formatNumber(store.orders)} захиалга
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-ink-800">
                      {formatCurrency(store.revenue, "MNT", { compact: true })}
                    </span>
                  </div>
                  <ProgressBar
                    value={store.revenue}
                    max={maxStoreRevenue}
                    className="mt-2"
                  />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Хамгийн их борлуулалттай бүтээгдэхүүн"
            description="Бүх дэлгүүрийн нэгдсэн."
          />
          <CardContent className="space-y-3">
            {stats.topProducts.length === 0 ? (
              <EmptyState icon={Package} title="Борлуулалт байхгүй" />
            ) : (
              stats.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-2xs font-semibold text-ink-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-800">
                      {product.name}
                    </p>
                    <p className="truncate text-2xs text-ink-400">
                      {product.storeName} · {product.quantity} ш
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-ink-800">
                    {formatCurrency(product.revenue, "MNT", { compact: true })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Сүүлийн үйл ажиллагаа"
            description="Аудит лог-оос автоматаар."
            action={
              <Link
                href="/admin/audit-logs"
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

      <div className="mt-4">
        <Card>
          <CardHeader
            title="Шинээр нэмэгдсэн дэлгүүрүүд"
            description="Хамгийн сүүлд үүссэн дэлгүүрүүд."
            action={
              <Link
                href="/admin/stores"
                className="text-2xs font-medium text-brand-600 hover:underline"
              >
                Бүх дэлгүүр
              </Link>
            }
          />
          <CardContent>
            {stats.newStores.length === 0 ? (
              <EmptyState
                icon={StoreIcon}
                title="Дэлгүүр байхгүй"
                description="Эхний дэлгүүрээ үүсгэнэ үү."
                action={
                  <Link href="/admin/stores/new" className={buttonClasses("primary", "sm")}>
                    <Plus className="h-4 w-4" /> Дэлгүүр нэмэх
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.newStores.map((store) => (
                  <Link
                    key={store.id}
                    href={`/admin/stores/${store.id}`}
                    className="group rounded-xl border border-ink-100 p-3.5 transition hover:border-ink-200 hover:bg-surface-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Avatar name={store.name} size="md" />
                      <StoreStatusBadge status={store.status} />
                    </div>
                    <p className="mt-2.5 truncate text-[13px] font-semibold text-ink-900">
                      {store.name}
                    </p>
                    <p className="truncate text-2xs text-ink-400">
                      {store.businessType} · {store.primaryDomain ?? "домэйнгүй"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-2xs text-ink-400">
                      <span>
                        {formatNumber(store.productCount)} бараа ·{" "}
                        {formatNumber(store.orderCount)} захиалга
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function StoreDashboard({ store }: { store: Store }) {
  const repository = getRepository();
  const [analytics, orders, lowStock] = await Promise.all([
    repository.storeAnalytics(store.id),
    repository.listOrders({ storeId: store.id, pageSize: 6 }),
    repository.listInventory({ storeId: store.id, level: "low", pageSize: 100 }),
  ]);

  return (
    <>
      <PageHeader
        title={store.name}
        description={store.description || "Дэлгүүрийн нэгдсэн гүйцэтгэл."}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StoreStatusBadge status={store.status} />
            <span className="text-2xs text-ink-400">{store.businessType}</span>
            {store.primaryDomain ? (
              <span className="text-2xs text-ink-400">· {store.primaryDomain}</span>
            ) : null}
            {!store.settings.visibility.published ? (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-medium text-warning-700">
                Website хаалттай
              </span>
            ) : null}
          </div>
        }
        actions={
          <>
            <Link
              href={`/store/${store.slug}`}
              target="_blank"
              className={buttonClasses("secondary", "md")}
            >
              <ExternalLink className="h-4 w-4" /> Public website
            </Link>
            <Link
              href={`/admin/stores/${store.id}/settings`}
              className={buttonClasses("dark", "md")}
            >
              Дэлгүүрийн тохиргоо
            </Link>
          </>
        }
      />

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
          hint="Бүх төлөв"
          icon={ShoppingCart}
          accent="brand"
        />
        <StatCard
          label="Захиалагч"
          value={formatNumber(analytics.totalCustomers)}
          hint="Давтагдахгүй харилцагч"
          icon={Users}
          accent="info"
        />
        <StatCard
          label="Дундаж захиалга"
          value={formatCurrency(analytics.averageOrderValue, "MNT", { compact: true })}
          hint="Төлөгдсөн захиалгаар"
          icon={Package}
          accent="neutral"
        />
        <StatCard
          label="Бүтээгдэхүүн"
          value={formatNumber(store.productCount)}
          hint="Нийт бүртгэлтэй"
          icon={Package}
          accent="brand"
        />
        <StatCard
          label="Бага үлдэгдэл"
          value={formatNumber(lowStock.total)}
          hint="5 буюу түүнээс бага"
          icon={Boxes}
          accent="warning"
        />
        <StatCard
          label="Нийт захиалга (бүртгэл)"
          value={formatNumber(store.orderCount)}
          hint="Дэлгүүрийн бүх захиалга"
          icon={ShoppingCart}
          accent="neutral"
        />
        <StatCard
          label="Домэйн"
          value={store.primaryDomain ?? "—"}
          hint={store.status === "active" ? "SSL идэвхтэй" : "Шалгах шаардлагатай"}
          icon={Globe}
          accent="info"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Борлуулалтын динамик"
            description="Сүүлийн 6 сарын төлөгдсөн захиалга."
          />
          <CardContent>
            <AreaChart
              data={analytics.salesSeries}
              valueLabel={(value) => formatCurrency(value)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Захиалгын төлөв" description="Одоогийн хуваарилалт." />
          <CardContent className="space-y-3">
            {analytics.statusBreakdown.map((item) => {
              const max = Math.max(
                ...analytics.statusBreakdown.map((entry) => entry.count),
                1,
              );
              return (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <OrderStatusBadge status={item.status} />
                    <span className="font-semibold text-ink-700">{item.count}</span>
                  </div>
                  <ProgressBar value={item.count} max={max} color="#3562F5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
          <div className="axora-scroll">
            {orders.rows.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Захиалга байхгүй"
                description="Public website-ээс ирсэн захиалга энд харагдана."
              />
            ) : (
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
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Бага үлдэгдэл"
              description="5 буюу түүнээс бага үлдэгдэлтэй бараа."
              action={
                <Link
                  href={`/admin/inventory?storeId=${store.id}&level=low`}
                  className="text-2xs font-medium text-brand-600 hover:underline"
                >
                  Бүгд
                </Link>
              }
            />
            <CardContent className="space-y-2.5">
              {lowStock.rows.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-400">
                  Бага үлдэгдэлтэй бараа байхгүй.
                </p>
              ) : (
                lowStock.rows.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center gap-2.5">
                    <Avatar name={product.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-800">
                        {product.name}
                      </p>
                      <p className="text-2xs text-ink-400">{product.sku || "SKU байхгүй"}</p>
                    </div>
                    <span className="rounded-md bg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-warning-700">
                      {product.stock} ш
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Топ бүтээгдэхүүн" description="Борлуулалтаар." />
            <CardContent className="space-y-2.5">
              {analytics.topProducts.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-400">
                  Борлуулалт байхгүй.
                </p>
              ) : (
                analytics.topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center gap-2.5">
                    <span className="w-3 text-2xs font-semibold text-ink-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink-800">
                        {product.name}
                      </p>
                      <p className="text-2xs text-ink-400">{product.quantity} ш</p>
                    </div>
                    <span className="text-2xs font-semibold text-ink-700">
                      {formatCurrency(product.revenue, "MNT", { compact: true })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-4 text-2xs text-ink-400">
        Сүүлийн шинэчлэл: {relativeTime(store.updatedAt)} · Store ID:{" "}
        <span className="font-mono">{store.id}</span>
      </p>
    </>
  );
}
