import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  History,
  PackageX,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { StatCard } from "@/components/admin/stat-card";
import { InventoryAdjustButton } from "@/components/admin/inventory-adjust";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buildQuery, cn, safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Барааны үлдэгдэл" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repository = getRepository();
  const context = await getStoreContext();
  const requestedStore = str(params.storeId);
  const storeId = requestedStore ?? context.storeId ?? undefined;

  const current = {
    search: str(params.search),
    storeId: requestedStore,
    level: str(params.level) ?? "all",
    page: str(params.page),
  };

  const [result, all, low, out, stores, logs] = await Promise.all([
    repository.listInventory({
      storeId,
      search: current.search,
      level: current.level as "all" | "low" | "out",
      page: safeInt(current.page, 1),
      pageSize: 20,
    }),
    repository.listInventory({ storeId, level: "all", page: 1, pageSize: 1 }),
    repository.listInventory({ storeId, level: "low", page: 1, pageSize: 1 }),
    repository.listInventory({ storeId, level: "out", page: 1, pageSize: 1 }),
    repository.listStoreOptions(),
    repository.listInventoryLogs(storeId, undefined, 1, 12),
  ]);

  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const back = `/admin/inventory${buildQuery(current, { page: current.page })}`;

  return (
    <>
      <PageHeader
        title="Барааны үлдэгдэл"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн үлдэгдэл.`
            : "Бүх дэлгүүрийн барааны үлдэгдэл, хөдөлгөөний түүх."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {all.total}</Badge>
            <Badge tone="warning" dot>
              {low.total} бага
            </Badge>
            <Badge tone="danger" dot>
              {out.total} дууссан
            </Badge>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Нийт бүтээгдэхүүн"
          value={formatNumber(all.total)}
          hint="Бүртгэлтэй бараа"
          icon={Boxes}
          accent="brand"
        />
        <StatCard
          label="Бага үлдэгдэл"
          value={formatNumber(low.total)}
          hint="1–5 ширхэг"
          icon={AlertTriangle}
          accent="warning"
        />
        <StatCard
          label="Дууссан"
          value={formatNumber(out.total)}
          hint="0 ширхэг"
          icon={PackageX}
          accent="danger"
        />
      </div>

      <FilterBar
        basePath="/admin/inventory"
        searchPlaceholder="Барааны нэр эсвэл SKU…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
          {
            name: "level",
            label: "Бүх үлдэгдэл",
            options: [
              { value: "low", label: "Бага (1–5)" },
              { value: "out", label: "Дууссан (0)" },
            ],
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Бүх үлдэгдэл хэвийн"
            description={
              current.search || current.level !== "all"
                ? "Хайлт болон шүүлтүүрт тохирох бараа байхгүй."
                : "Одоогоор анхаарал шаардсан үлдэгдэл байхгүй."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[880px]">
              <thead>
                <tr>
                  <th>Бүтээгдэхүүн</th>
                  <th>Дэлгүүр</th>
                  <th>SKU</th>
                  <th className="text-right">Үлдэгдэл</th>
                  <th>Төлөв</th>
                  <th>Шинэчлэгдсэн</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={product.name} src={product.images[0] ?? null} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="block max-w-[230px] truncate text-[13px] font-medium text-ink-900 hover:text-brand-600"
                          >
                            {product.name}
                          </Link>
                          <p className="max-w-[230px] truncate text-2xs text-ink-400">
                            {product.categoryName ?? "Ангилалгүй"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {storeNames.get(product.storeId) ?? "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-2xs text-ink-500">
                      {product.sku || "—"}
                    </td>
                    <td className="text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                          product.stock <= 0
                            ? "bg-danger-50 text-danger-700"
                            : product.stock <= 5
                              ? "bg-warning-50 text-warning-700"
                              : "bg-success-50 text-success-700",
                        )}
                      >
                        {product.stock} ш
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          product.stock <= 0
                            ? "danger"
                            : product.stock <= 5
                              ? "warning"
                              : "success"
                        }
                      >
                        {product.stock <= 0
                          ? "Дууссан"
                          : product.stock <= 5
                            ? "Бага"
                            : "Хэвийн"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(product.updatedAt)}
                    </td>
                    <td>
                      <InventoryAdjustButton product={product} back={back} />
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
            basePath="/admin/inventory"
            query={current}
          />
        </Card>
      )}

      <div className="mt-4">
        <Card>
          <CardHeader
            title="Сүүлийн үлдэгдлийн хөдөлгөөн"
            description="Захиалга, засвар, буцаалтын бүртгэл."
            action={
              <Badge tone="neutral">{logs.total} бичлэг</Badge>
            }
          />
          {logs.rows.length === 0 ? (
            <EmptyState
              icon={History}
              title="Хөдөлгөөн байхгүй"
              description="Үлдэгдэл өөрчлөгдөхөд энд бүртгэгдэнэ."
            />
          ) : (
            <div className="axora-scroll">
              <table className="axora-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Огноо</th>
                    <th>Бараа</th>
                    <th>Шалтгаан</th>
                    <th className="text-right">Өөрчлөлт</th>
                    <th className="text-right">Үлдэгдэл</th>
                    <th>Хийсэн</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.rows.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-2xs text-ink-400">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td>
                        <Link
                          href={`/admin/products/${log.productId}`}
                          className="block max-w-[220px] truncate text-[13px] font-medium text-ink-800 hover:text-brand-600"
                        >
                          {log.productName}
                        </Link>
                      </td>
                      <td>
                        <p className="text-[13px] text-ink-700">{log.reason}</p>
                        {log.note ? (
                          <p className="text-2xs text-ink-400">{log.note}</p>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "text-right text-[13px] font-semibold tabular-nums",
                          log.changeAmount > 0 ? "text-success-700" : "text-danger-700",
                        )}
                      >
                        {log.changeAmount > 0 ? "+" : ""}
                        {log.changeAmount}
                      </td>
                      <td className="text-right text-[13px] tabular-nums text-ink-700">
                        {log.balanceAfter}
                      </td>
                      <td className="whitespace-nowrap text-2xs text-ink-400">
                        {log.actorName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
