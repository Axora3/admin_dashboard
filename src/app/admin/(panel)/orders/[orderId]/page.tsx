import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  Store as StoreIcon,
  Truck,
  UserRound,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import {
  updateOrderStatusAction,
  updatePaymentStatusAction,
} from "@/app/admin/actions/orders";
import { PageHeader } from "@/components/admin/page-header";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { ORDER_STATUS, ORDER_STATUS_FLOW } from "@/lib/labels";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const repository = getRepository();
  const order = await repository.getOrder(orderId);
  if (!order) notFound();

  const back = `/admin/orders/${order.id}`;
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.orderStatus as OrderStatus);
  const isCancelled = order.orderStatus === "cancelled";

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`${order.storeName} · ${formatDateTime(order.createdAt)}`}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <OrderStatusBadge status={order.orderStatus} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <Badge tone="neutral">{order.items.length} төрөл бараа</Badge>
          </div>
        }
        actions={
          <>
            <Link
              href="/admin/orders"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-medium text-ink-800 shadow-sm transition hover:bg-ink-50"
            >
              <ArrowLeft className="h-4 w-4" /> Жагсаалт
            </Link>
            <Link
              href={`/admin/stores/${order.storeId}`}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-ink-900 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-ink-800"
            >
              <StoreIcon className="h-4 w-4" /> Дэлгүүр
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title="Захиалгын бараа"
              description="Захиалсан бүтээгдэхүүн, тоо ширхэг, үнэ."
              action={<Badge tone="neutral">{order.items.length} мөр</Badge>}
            />
            <div className="axora-scroll">
              <table className="axora-table">
                <thead>
                  <tr>
                    <th>Бараа</th>
                    <th className="text-right">Үнэ</th>
                    <th className="text-right">Тоо</th>
                    <th className="text-right">Нийт</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={item.productName} size="sm" />
                          <div className="min-w-0">
                            {item.productId ? (
                              <Link
                                href={`/admin/products/${item.productId}`}
                                className="block max-w-[260px] truncate text-[13px] font-medium text-ink-900 hover:text-brand-600"
                              >
                                {item.productName}
                              </Link>
                            ) : (
                              <span className="block max-w-[260px] truncate text-[13px] font-medium text-ink-900">
                                {item.productName}
                              </span>
                            )}
                            <p className="text-2xs text-ink-400">Бүтээгдэхүүн</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right text-[13px] text-ink-700">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="text-right text-[13px] tabular-nums text-ink-700">
                        {item.quantity}
                      </td>
                      <td className="whitespace-nowrap text-right text-[13px] font-semibold text-ink-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-ink-100 px-5 py-4">
              <div className="ml-auto max-w-xs space-y-1.5 text-[13px]">
                <div className="flex items-center justify-between text-ink-500">
                  <span>Барааны дүн</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-ink-500">
                  <span>Хүргэлт</span>
                  <span className="tabular-nums">
                    {order.shippingAmount > 0 ? formatCurrency(order.shippingAmount) : "Үнэгүй"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-[15px] font-semibold text-ink-950">
                  <span>Нийт</span>
                  <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </Card>

          {order.note ? (
            <Card>
              <CardHeader title="Захиалагчийн тэмдэглэл" />
              <CardContent>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-600">
                  {order.note}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Захиалгын явц"
              description="Одоогийн төлөв болон дараагийн алхмууд."
            />
            <CardContent>
              {isCancelled ? (
                <div className="flex items-center gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
                  <ReceiptText className="h-4 w-4" />
                  Захиалга цуцлагдсан. Барааны үлдэгдэл буцаагдсан.
                </div>
              ) : (
                <ol className="space-y-3">
                  {ORDER_STATUS_FLOW.map((status, index) => {
                    const done = index <= currentIndex;
                    const active = index === currentIndex;
                    return (
                      <li key={status} className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
                            done
                              ? "bg-brand-600 text-white"
                              : "bg-ink-100 text-ink-400",
                          )}
                        >
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-[13px] font-medium",
                              active ? "text-ink-900" : done ? "text-ink-700" : "text-ink-400",
                            )}
                          >
                            {ORDER_STATUS[status].label}
                          </p>
                          {active ? (
                            <p className="text-2xs text-brand-600">Одоогийн төлөв</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Захиалагч" description="Холбоо барих мэдээлэл." />
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={order.customerName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">
                    {order.customerName}
                  </p>
                  <p className="truncate text-2xs text-ink-400">
                    {order.customerEmail || "Имэйлгүй"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-[13px] text-ink-600">
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-ink-400" /> {order.customerPhone}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  <span>{order.customerAddress || "Хаяг оруулаагүй"}</span>
                </p>
                <p className="flex items-center gap-2 text-2xs text-ink-400">
                  <UserRound className="h-3.5 w-3.5" /> Захиалагчийн бүртгэл
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Төлөв шинэчлэх" description="Гараар баталгаажуулна." />
            <CardContent className="space-y-4">
              <form action={updateOrderStatusAction} className="space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="back" value={back} />
                <Field label="Захиалгын төлөв" htmlFor="status">
                  <Select id="status" name="status" defaultValue={order.orderStatus}>
                    {Object.entries(ORDER_STATUS).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" size="md" variant="secondary" className="w-full">
                  <Truck className="h-4 w-4" /> Захиалгын төлөв хадгалах
                </Button>
              </form>

              <div className="axora-divider" />

              <form action={updatePaymentStatusAction} className="space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="back" value={back} />
                <Field label="Төлбөрийн төлөв" htmlFor="paymentStatus">
                  <Select
                    id="paymentStatus"
                    name="paymentStatus"
                    defaultValue={order.paymentStatus}
                  >
                    <option value="unpaid">Төлөгдөөгүй</option>
                    <option value="pending">Хүлээгдэж байгаа</option>
                    <option value="paid">Төлөгдсөн</option>
                    <option value="refunded">Буцаагдсан</option>
                  </Select>
                </Field>
                <Button type="submit" size="md" className="w-full">
                  <CreditCard className="h-4 w-4" /> Төлбөрийн төлөв хадгалах
                </Button>
              </form>
              <p className="text-2xs leading-relaxed text-ink-400">
                Төлбөрийн төлөвийг зөвхөн бодит гүйлгээ баталгаажсаны дараа
                «Төлөгдсөн» болгоно уу.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Дэлгүүр" description="Захиалга харьяалагдах дэлгүүр." />
            <CardContent>
              <Link
                href={`/admin/stores/${order.storeId}`}
                className="flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-ink-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
                  <StoreIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink-900">
                    {order.storeName}
                  </span>
                  <span className="block text-2xs text-ink-400">
                    Захиалга #{order.orderNumber}
                  </span>
                </span>
              </Link>
              <div className="mt-3 space-y-1 text-2xs text-ink-400">
                <p className="flex items-center gap-1.5">
                  <Package className="h-3 w-3" /> {order.items.length} төрөл бараа
                </p>
                <p>Үүссэн: {formatDateTime(order.createdAt)}</p>
                <p>Шинэчлэгдсэн: {formatDateTime(order.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
