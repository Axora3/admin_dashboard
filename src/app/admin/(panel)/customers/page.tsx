import Link from "next/link";
import { Mail, Phone, ShoppingCart, Users, Wallet } from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { StatCard } from "@/components/admin/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Захиалагчид" };

export default async function CustomersPage({
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
    page: str(params.page),
  };

  const [result, stores] = await Promise.all([
    repository.listCustomers({
      storeId,
      search: current.search,
      page: safeInt(current.page, 1),
      pageSize: 20,
    }),
    repository.listStoreOptions(),
  ]);

  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const totalSpent = result.rows.reduce((sum, customer) => sum + customer.totalSpent, 0);
  const repeat = result.rows.filter((customer) => customer.orderCount > 1).length;

  return (
    <>
      <PageHeader
        title="Захиалагчид"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн харилцагчид.`
            : "Захиалгаар тодорхойлогдсон бүх харилцагч, худалдан авалтын түүх."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {result.total}</Badge>
            <Badge tone="brand" dot>
              {repeat} давтан захиалагч
            </Badge>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Нийт харилцагч"
          value={formatNumber(result.total)}
          hint="Захиалгаар тодорхойлогдсон"
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Хуудасны зарцуулалт"
          value={formatCurrency(totalSpent, "MNT", { compact: true })}
          hint={`${result.rows.length} харилцагчийн нийлбэр`}
          icon={Wallet}
          accent="success"
        />
        <StatCard
          label="Давтан захиалагч"
          value={formatNumber(repeat)}
          hint="2+ захиалгатай"
          icon={ShoppingCart}
          accent="info"
        />
      </div>

      <FilterBar
        basePath="/admin/customers"
        searchPlaceholder="Нэр, утас, имэйл…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Харилцагч олдсонгүй"
            description={
              current.search
                ? "Хайлтад тохирох харилцагч байхгүй."
                : "Public storefront-ээс захиалга ирэхэд харилцагч автоматаар бүртгэгдэнэ."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Харилцагч</th>
                  <th>Холбоо барих</th>
                  <th className="text-right">Захиалга</th>
                  <th className="text-right">Зарцуулалт</th>
                  <th>Эхний захиалга</th>
                  <th>Сүүлийн захиалга</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={customer.name} size="sm" />
                        <div className="min-w-0">
                          <p className="max-w-[200px] truncate text-[13px] font-medium text-ink-900">
                            {customer.name}
                          </p>
                          <p className="text-2xs text-ink-400">
                            {stores.find((store) => store.id === customer.storeId)?.name ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="flex items-center gap-1.5 text-[13px] text-ink-700">
                        <Phone className="h-3 w-3 text-ink-400" /> {customer.phone || "—"}
                      </p>
                      <p className="flex items-center gap-1.5 text-2xs text-ink-400">
                        <Mail className="h-3 w-3" /> {customer.email || "—"}
                      </p>
                    </td>
                    <td className="text-right text-[13px] font-medium tabular-nums text-ink-800">
                      {customer.orderCount}
                    </td>
                    <td className="whitespace-nowrap text-right text-[13px] font-semibold text-ink-900">
                      {formatCurrency(customer.totalSpent)}
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(customer.firstOrderAt)}
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(customer.lastOrderAt)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/orders?search=${encodeURIComponent(
                          customer.phone || customer.email || customer.name,
                        )}${customer.storeId ? `&storeId=${customer.storeId}` : ""}`}
                        className={buttonClasses("secondary", "sm")}
                      >
                        Захиалга
                      </Link>
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
            basePath="/admin/customers"
            query={current}
          />
        </Card>
      )}
    </>
  );
}
