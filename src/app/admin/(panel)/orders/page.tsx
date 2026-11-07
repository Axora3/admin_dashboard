import Link from "next/link";
import { Eye, ShoppingCart, Wallet } from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildQuery, safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Захиалгууд" };

export default async function OrdersPage({
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
    orderStatus: str(params.orderStatus) ?? "all",
    paymentStatus: str(params.paymentStatus) ?? "all",
    from: str(params.from),
    to: str(params.to),
    page: str(params.page),
  };

  const [result, stores] = await Promise.all([
    repository.listOrders({
      storeId,
      search: current.search,
      orderStatus: current.orderStatus as never,
      paymentStatus: current.paymentStatus as never,
      from: current.from,
      to: current.to,
      page: safeInt(current.page, 1),
      pageSize: 20,
    }),
    repository.listStoreOptions(),
  ]);

  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const visibleRevenue = result.rows
    .filter((order) => order.paymentStatus === "paid" && order.orderStatus !== "cancelled")
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const newCount = result.rows.filter((order) => order.orderStatus === "new").length;

  return (
    <>
      <PageHeader
        title="Захиалгууд"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн захиалга.`
            : "Бүх дэлгүүрээс ирсэн захиалга, төлбөр, хүргэлтийн төлөв."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {result.total}</Badge>
            <Badge tone="info" dot>
              {newCount} шинэ
            </Badge>
            <Badge tone="success" dot>
              {formatCurrency(visibleRevenue, "MNT", { compact: true })} төлөгдсөн
            </Badge>
          </div>
        }
        actions={
          <Link href="/admin/products" className={buttonClasses("secondary", "md")}>
            <ShoppingCart className="h-4 w-4" /> Бараа
          </Link>
        }
      />

      <FilterBar
        basePath="/admin/orders"
        searchPlaceholder="Захиалгын дугаар, нэр, утас…"
        current={current}
        dateRange
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
          {
            name: "orderStatus",
            label: "Бүх төлөв",
            options: [
              { value: "new", label: "Шинэ" },
              { value: "confirmed", label: "Баталгаажсан" },
              { value: "processing", label: "Бэлтгэж байгаа" },
              { value: "shipped", label: "Хүргэлтэд гарсан" },
              { value: "delivered", label: "Хүргэгдсэн" },
              { value: "cancelled", label: "Цуцлагдсан" },
            ],
          },
          {
            name: "paymentStatus",
            label: "Бүх төлбөр",
            options: [
              { value: "unpaid", label: "Төлөгдөөгүй" },
              { value: "pending", label: "Хүлээгдэж байгаа" },
              { value: "paid", label: "Төлөгдсөн" },
              { value: "refunded", label: "Буцаагдсан" },
            ],
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title="Захиалга олдсонгүй"
            description={
              current.search || current.orderStatus !== "all" || current.paymentStatus !== "all"
                ? "Хайлт болон шүүлтүүрт тохирох захиалга байхгүй."
                : "Public storefront-ээс захиалга ирэхэд энд харагдана."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[940px]">
              <thead>
                <tr>
                  <th>Дугаар</th>
                  <th>Дэлгүүр</th>
                  <th>Захиалагч</th>
                  <th className="text-right">Дүн</th>
                  <th>Төлбөр</th>
                  <th>Төлөв</th>
                  <th>Огноо</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-[13px] font-medium text-ink-900 hover:text-brand-600"
                      >
                        {order.orderNumber}
                      </Link>
                      <p className="text-2xs text-ink-400">{order.items.length} төрөл</p>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {order.storeName}
                    </td>
                    <td>
                      <p className="whitespace-nowrap text-[13px] text-ink-800">
                        {order.customerName}
                      </p>
                      <p className="text-2xs text-ink-400">{order.customerPhone}</p>
                    </td>
                    <td className="whitespace-nowrap text-right text-[13px] font-medium text-ink-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td>
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                    <td>
                      <OrderStatusBadge status={order.orderStatus} />
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className={buttonClasses("ghost", "icon", "h-8 w-8")}
                        title="Дэлгэрэнгүй"
                      >
                        <Eye className="h-3.5 w-3.5" />
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
            basePath="/admin/orders"
            query={current}
          />
        </Card>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-400">
        <Wallet className="h-3 w-3" /> Төлбөрийн төлөв нь бодит гүйлгээгээр гараар
        шинэчлэгдэнэ. Хуурамч төлбөрийн амжилт харуулахгүй.
      </p>
    </>
  );
}
