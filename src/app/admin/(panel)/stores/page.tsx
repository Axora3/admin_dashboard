import Link from "next/link";
import {
  ExternalLink,
  Globe,
  LayoutGrid,
  List,
  Plus,
  Store as StoreIcon,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { StoreStatusBadge } from "@/components/admin/status-badges";
import { StoreActions } from "@/components/admin/store-actions";
import { Alert } from "@/components/admin/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { BUSINESS_TYPES } from "@/lib/labels";
import { buildQuery, cn, safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = str(params.view) === "grid" ? "grid" : "table";
  const current = {
    search: str(params.search),
    status: str(params.status) ?? "all",
    businessType: str(params.businessType) ?? "all",
    sort: str(params.sort) ?? "newest",
    view,
    page: str(params.page),
  };

  const repository = getRepository();
  const [result, stats, context] = await Promise.all([
    repository.listStores({
      search: current.search,
      status: current.status as "all" | "active" | "suspended" | "archived",
      businessType: current.businessType,
      sort: current.sort as "newest" | "name" | "revenue" | "orders",
      page: safeInt(current.page, 1),
      pageSize: view === "grid" ? 12 : 15,
    }),
    repository.platformStats(),
    getStoreContext(),
  ]);

  const nextPath = `/admin/stores${buildQuery(current, { page: current.page })}`;

  return (
    <>
      <PageHeader
        title="Дэлгүүрүүд"
        description="AXORA-аар хийгдсэн бүх онлайн дэлгүүр. Нэг дор харах, удирдах, шинэ дэлгүүр нэмэх."
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {stats.totalStores}</Badge>
            <Badge tone="success" dot>
              {stats.activeStores} идэвхтэй
            </Badge>
            <Badge tone="warning" dot>
              {stats.suspendedStores} түр хаасан
            </Badge>
            <Badge tone="neutral" dot>
              {stats.archivedStores} архив
            </Badge>
          </div>
        }
        actions={
          <Link href="/admin/stores/new" className={buttonClasses("primary", "md")}>
            <Plus className="h-4 w-4" /> Шинэ дэлгүүр
          </Link>
        }
      />

      {str(params.deleted) === "1" ? (
        <Alert variant="success" className="mb-4">
          Дэлгүүр болон түүний бүх өгөгдөл устгагдлаа.
        </Alert>
      ) : null}

      <FilterBar
        basePath="/admin/stores"
        searchPlaceholder="Нэр, эзэмшигч, домэйн, утас…"
        current={current}
        filters={[
          {
            name: "status",
            label: "Бүх төлөв",
            options: [
              { value: "active", label: "Идэвхтэй" },
              { value: "suspended", label: "Түр хаасан" },
              { value: "archived", label: "Архивласан" },
            ],
          },
          {
            name: "businessType",
            label: "Бүх төрөл",
            options: BUSINESS_TYPES.map((type) => ({ value: type, label: type })),
          },
          {
            name: "sort",
            label: "Эрэмбэлэх",
            options: [
              { value: "newest", label: "Шинэ нь эхэндээ" },
              { value: "name", label: "Нэрээр" },
              { value: "revenue", label: "Борлуулалтаар" },
              { value: "orders", label: "Захиалгаар" },
            ],
          },
        ]}
        right={
          <div className="inline-flex rounded-xl border border-ink-200 bg-white p-0.5 shadow-sm">
            <Link
              href={`/admin/stores${buildQuery(current, { view: "table", page: undefined })}`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
                view === "table" ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50",
              )}
            >
              <List className="h-3.5 w-3.5" /> Хүснэгт
            </Link>
            <Link
              href={`/admin/stores${buildQuery(current, { view: "grid", page: undefined })}`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
                view === "grid" ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-50",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Карт
            </Link>
          </div>
        }
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={StoreIcon}
            title="Дэлгүүр олдсонгүй"
            description={
              current.search || current.status !== "all"
                ? "Хайлт болон шүүлтүүрт тохирох дэлгүүр байхгүй. Шүүлтүүрээ өөрчилж үзнэ үү."
                : "Эхний дэлгүүрээ үүсгэж AXORA платформд нэмнэ үү."
            }
            action={
              <Link href="/admin/stores/new" className={buttonClasses("primary", "sm")}>
                <Plus className="h-4 w-4" /> Шинэ дэлгүүр
              </Link>
            }
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.rows.map((store) => (
            <Card key={store.id} className="p-4 transition hover:shadow-raised">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={store.name} src={store.logoUrl} size="lg" />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/stores/${store.id}`}
                      className="block truncate text-[14px] font-semibold text-ink-900 hover:text-brand-600"
                    >
                      {store.name}
                    </Link>
                    <p className="truncate text-2xs text-ink-400">{store.businessType}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <StoreStatusBadge status={store.status} />
                  <StoreActions store={store} next={nextPath} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-500">
                {store.primaryDomain ? (
                  <Link
                    href={`/store/${store.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                  >
                    <Globe className="h-3 w-3" /> {store.primaryDomain}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                ) : (
                  <span className="text-ink-300">Домэйн холбогдоогүй</span>
                )}
                <span>·</span>
                <span>{store.ownerName}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 divide-x divide-ink-100 rounded-xl bg-surface-muted/70 py-2 text-center">
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">
                    {formatNumber(store.productCount)}
                  </p>
                  <p className="text-[10px] text-ink-400">Бараа</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">
                    {formatNumber(store.orderCount)}
                  </p>
                  <p className="text-[10px] text-ink-400">Захиалга</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">
                    {formatCurrency(store.revenue, "MNT", { compact: true })}
                  </p>
                  <p className="text-[10px] text-ink-400">Борлуулалт</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-2xs text-ink-400">
                <span>Үүссэн: {formatDate(store.createdAt)}</span>
                <Link
                  href={`/admin/stores/${store.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Дэлгүүр нээх →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[1050px]">
              <thead>
                <tr>
                  <th>Дэлгүүр</th>
                  <th>Төрөл</th>
                  <th>Домэйн</th>
                  <th>Эзэмшигч</th>
                  <th className="text-right">Бараа</th>
                  <th className="text-right">Захиалга</th>
                  <th className="text-right">Борлуулалт</th>
                  <th>Төлөв</th>
                  <th>Үүссэн</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((store) => (
                  <tr key={store.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={store.name} src={store.logoUrl} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/stores/${store.id}`}
                            className="block max-w-[190px] truncate text-[13px] font-medium text-ink-900 hover:text-brand-600"
                          >
                            {store.name}
                          </Link>
                          <p className="max-w-[190px] truncate text-2xs text-ink-400">
                            /{store.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {store.businessType}
                    </td>
                    <td>
                      {store.primaryDomain ? (
                        <Link
                          href={`/store/${store.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-brand-600 hover:underline"
                        >
                          {store.primaryDomain}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td>
                      <p className="whitespace-nowrap text-[13px] text-ink-700">
                        {store.ownerName}
                      </p>
                      <p className="text-2xs text-ink-400">{store.ownerPhone}</p>
                    </td>
                    <td className="text-right text-[13px] tabular-nums text-ink-700">
                      {formatNumber(store.productCount)}
                    </td>
                    <td className="text-right text-[13px] tabular-nums text-ink-700">
                      {formatNumber(store.orderCount)}
                    </td>
                    <td className="whitespace-nowrap text-right text-[13px] font-medium tabular-nums text-ink-900">
                      {formatCurrency(store.revenue, "MNT", { compact: true })}
                    </td>
                    <td>
                      <StoreStatusBadge status={store.status} />
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(store.createdAt)}
                    </td>
                    <td>
                      <StoreActions store={store} next={nextPath} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/admin/stores"
            query={current}
          />
        </Card>
      )}

      {view === "grid" && result.pageCount > 1 ? (
        <Card className="mt-4">
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/admin/stores"
            query={current}
          />
        </Card>
      ) : null}

      {context.store ? (
        <p className="mt-4 text-2xs text-ink-400">
          Одоогийн сонгосон дэлгүүр: <b className="text-ink-600">{context.store.name}</b>.
          Бүх дэлгүүрийн жагсаалт харахын тулд header-ээс «Бүх дэлгүүр»-ийг сонгоно уу.
        </p>
      ) : null}
    </>
  );
}
