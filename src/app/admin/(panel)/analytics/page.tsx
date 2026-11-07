import Link from "next/link";
import {
  BarChart3,
  Globe,
  Package,
  ShoppingCart,
  Store as StoreIcon,
  Users,
  Wallet,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { StatCard } from "@/components/admin/stat-card";
import { OrderStatusBadge } from "@/components/admin/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChart, BarChart, ProgressBar } from "@/components/ui/chart";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Статистик" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repository = getRepository();
  const context = await getStoreContext();
  const requestedStore = str(params.storeId);
  const storeId = requestedStore ?? context.storeId ?? undefined;
  const from = str(params.from);
  const to = str(params.to);

  const [stores, platform, storeAnalytics] = await Promise.all([
    repository.listStoreOptions(),
    repository.platformStats(),
    storeId ? repository.storeAnalytics(storeId, from, to) : Promise.resolve(null),
  ]);

  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const current = { storeId: requestedStore, from, to };

  return (
    <>
      <PageHeader
        title="Статистик"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн борлуулалт, захиалгын шинжилгээ.`
            : "AXORA платформын бүх дэлгүүрийн нэгдсэн гүйцэтгэл."
        }
        meta={
          <Badge tone={storeAnalytics ? "brand" : "neutral"} dot>
            {storeAnalytics ? "Дэлгүүрийн статистик" : "Платформын статистик"}
          </Badge>
        }
        actions={
          <Link href="/admin/analytics" className={buttonClasses("secondary", "md")}>
            <BarChart3 className="h-4 w-4" /> Платформ
          </Link>
        }
      />

      <FilterBar
        basePath="/admin/analytics"
        searchPlaceholder="Хайх…"
        current={current}
        dateRange={Boolean(storeAnalytics)}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
        ]}
      />

      {storeAnalytics && activeStore ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Нийт борлуулалт"
              value={formatCurrency(storeAnalytics.totalRevenue, "MNT", { compact: true })}
              hint="Төлөгдсөн захиалга"
              icon={Wallet}
              accent="success"
              trend={storeAnalytics.growth}
            />
            <StatCard
              label="Захиалга"
              value={formatNumber(storeAnalytics.totalOrders)}
              hint="Бүх төлөв"
              icon={ShoppingCart}
              accent="brand"
            />
            <StatCard
              label="Дундаж захиалга"
              value={formatCurrency(storeAnalytics.averageOrderValue, "MNT", { compact: true })}
              hint="Төлөгдсөн захиалгаар"
              icon={Package}
              accent="info"
            />
            <StatCard
              label="Харилцагч"
              value={formatNumber(storeAnalytics.totalCustomers)}
              hint="Давтагдахгүй"
              icon={Users}
              accent="neutral"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Борлуулалтын динамик"
                description="Сүүлийн 6 сарын төлөгдсөн захиалгын дүн."
              />
              <CardContent>
                <AreaChart
                  data={storeAnalytics.salesSeries}
                  valueLabel={(value) => formatCurrency(value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Захиалгын динамик" description="Сарын захиалгын тоо." />
              <CardContent>
                <BarChart
                  data={storeAnalytics.ordersSeries}
                  valueLabel={(value) => `${value} захиалга`}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="Захиалгын төлөв" description="Одоогийн хуваарилалт." />
              <CardContent className="space-y-3">
                {storeAnalytics.statusBreakdown.map((item) => {
                  const max = Math.max(
                    ...storeAnalytics.statusBreakdown.map((entry) => entry.count),
                    1,
                  );
                  return (
                    <div key={item.status}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <OrderStatusBadge status={item.status} />
                        <span className="font-semibold text-ink-700">{item.count}</span>
                      </div>
                      <ProgressBar value={item.count} max={max} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Топ бүтээгдэхүүн" description="Борлуулалтаар." />
              <CardContent className="space-y-2.5">
                {storeAnalytics.topProducts.length === 0 ? (
                  <EmptyState icon={Package} title="Борлуулалт байхгүй" />
                ) : (
                  storeAnalytics.topProducts.map((product, index) => (
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

            <Card>
              <CardHeader title="Топ ангилал" description="Орлогоор." />
              <CardContent className="space-y-2.5">
                {storeAnalytics.topCategories.length === 0 ? (
                  <EmptyState icon={BarChart3} title="Өгөгдөл байхгүй" />
                ) : (
                  storeAnalytics.topCategories.map((category, index) => (
                    <div key={category.id} className="flex items-center gap-2.5">
                      <span className="w-3 text-2xs font-semibold text-ink-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink-800">
                          {category.name}
                        </p>
                      </div>
                      <span className="text-2xs font-semibold text-ink-700">
                        {formatCurrency(category.revenue, "MNT", { compact: true })}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Нийт борлуулалт"
              value={formatCurrency(platform.totalRevenue, "MNT", { compact: true })}
              hint="Бүх дэлгүүрийн төлөгдсөн"
              icon={Wallet}
              accent="success"
            />
            <StatCard
              label="Нийт захиалга"
              value={formatNumber(platform.totalOrders)}
              hint="Бүх дэлгүүр"
              icon={ShoppingCart}
              accent="brand"
            />
            <StatCard
              label="Нийт харилцагч"
              value={formatNumber(platform.totalCustomers)}
              hint="Захиалгаар тодорхойлогдсон"
              icon={Users}
              accent="info"
            />
            <StatCard
              label="Идэвхтэй дэлгүүр"
              value={`${platform.activeStores}/${platform.totalStores}`}
              hint={`${platform.totalProducts} бүтээгдэхүүн`}
              icon={StoreIcon}
              accent="neutral"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Сарын борлуулалт"
                description="Сүүлийн 6 сарын төлөгдсөн захиалгын нийт дүн."
              />
              <CardContent>
                <AreaChart
                  data={platform.monthlySales}
                  valueLabel={(value) => formatCurrency(value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Өдрийн захиалга" description="Сүүлийн 14 хоног." />
              <CardContent>
                <BarChart
                  data={platform.dailyOrders}
                  valueLabel={(value) => `${value} захиалга`}
                />
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="Дэлгүүрийн өсөлт" description="Сарын шинэ дэлгүүр." />
              <CardContent>
                <BarChart
                  data={platform.storeGrowth}
                  color="#039855"
                  valueLabel={(value) => `${value} дэлгүүр`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Топ дэлгүүр" description="Борлуулалтаар." />
              <CardContent className="space-y-3">
                {platform.topStores.length === 0 ? (
                  <EmptyState icon={StoreIcon} title="Дэлгүүр байхгүй" />
                ) : (
                  platform.topStores.map((store, index) => {
                    const max = Math.max(
                      ...platform.topStores.map((entry) => entry.revenue),
                      1,
                    );
                    return (
                      <Link
                        key={store.id}
                        href={`/admin/analytics?storeId=${store.id}`}
                        className="block rounded-lg p-1 transition hover:bg-ink-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 text-2xs font-semibold text-ink-300">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-800">
                            {store.name}
                          </span>
                          <span className="text-2xs font-semibold text-ink-700">
                            {formatCurrency(store.revenue, "MNT", { compact: true })}
                          </span>
                        </div>
                        <ProgressBar value={store.revenue} max={max} className="mt-1.5" />
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Топ бүтээгдэхүүн" description="Бүх дэлгүүрийн нэгдсэн." />
              <CardContent className="space-y-2.5">
                {platform.topProducts.length === 0 ? (
                  <EmptyState icon={Package} title="Борлуулалт байхгүй" />
                ) : (
                  platform.topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-2.5">
                      <span className="w-3 text-2xs font-semibold text-ink-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink-800">
                          {product.name}
                        </p>
                        <p className="truncate text-2xs text-ink-400">
                          {product.storeName} · {product.quantity} ш
                        </p>
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

          <div className="mt-4">
            <Card>
              <CardHeader title="Шинэ дэлгүүрүүд" description="Хамгийн сүүлд нэмэгдсэн." />
              <CardContent>
                {platform.newStores.length === 0 ? (
                  <EmptyState icon={StoreIcon} title="Дэлгүүр байхгүй" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {platform.newStores.map((store) => (
                      <Link
                        key={store.id}
                        href={`/admin/stores/${store.id}`}
                        className="flex items-center gap-2.5 rounded-xl border border-ink-100 p-3 transition hover:border-ink-200 hover:bg-surface-muted/50"
                      >
                        <Avatar name={store.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-900">
                            {store.name}
                          </p>
                          <p className="truncate text-2xs text-ink-400">
                            {store.businessType}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-400">
            <Globe className="h-3 w-3" /> Домэйн холболт: {platform.connectedDomains}/
            {platform.totalDomains} идэвхтэй.
          </p>
        </>
      )}
    </>
  );
}
