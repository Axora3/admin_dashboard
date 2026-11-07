import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Truck,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { loadStorefront } from "@/lib/storefront-data";
import { themeClasses } from "@/lib/storefront-theme";
import { cn } from "@/lib/utils";

function str(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { store } = data;
  const orderId = str(query.order);
  const fallbackNumber = str(query.number);
  const order = orderId ? await getRepository().getOrder(orderId) : null;
  const classes = themeClasses(store.settings.theme.style);
  const base = `/store/${slug}`;

  if (!order && !fallbackNumber) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <PackageCheck className="h-10 w-10 text-ink-300" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-950">
          Захиалга олдсонгүй
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Захиалгын дугаар эсвэл холбоос буруу байна. Хэрэв та захиалга
          баталгаажуулсан бол дэлгүүртэй холбогдоно уу.
        </p>
        <Link
          href={base}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--store-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Дэлгүүр рүү буцах <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const orderNumber = order?.orderNumber ?? fallbackNumber;
  const status = order ? ORDER_STATUS[order.orderStatus] : null;
  const payment = order ? PAYMENT_STATUS[order.paymentStatus] : null;
  const items = order?.items ?? [];
  const paid = order?.paymentStatus === "paid";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success-50 text-success-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className={classes.eyebrow}>Баярлалаа</p>
              <h1 className={cn("mt-1 text-2xl sm:text-3xl", classes.heading)}>
                Захиалга бүртгэгдлээ
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                {store.name} таны захиалгыг хүлээн авлаа. Удахгүй холбогдох болно.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-surface-muted px-4 py-3 text-left sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Захиалгын дугаар
            </p>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-ink-950">
              {orderNumber}
            </p>
            {order ? (
              <p className="mt-0.5 text-[11px] text-ink-400">
                {formatDateTime(order.createdAt)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {status ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-50 px-2.5 py-1 text-xs font-medium text-info-700">
              <Clock className="h-3.5 w-3.5" /> {status.label}
            </span>
          ) : null}
          {payment ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                paid
                  ? "bg-success-50 text-success-700"
                  : "bg-warning-50 text-warning-700",
              )}
            >
              <CreditCard className="h-3.5 w-3.5" /> {payment.label}
            </span>
          ) : null}
        </div>

        {order && items.length > 0 ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-ink-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-[10px] uppercase tracking-[0.14em] text-ink-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Бараа</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Тоо</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-ink-100">
                    <td className="px-4 py-3 text-ink-800">{item.productName}</td>
                    <td className="px-4 py-3 text-right text-ink-600">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">
                      {formatCurrency(item.unitPrice * item.quantity, store.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-2 border-t border-ink-100 bg-surface-muted px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">Барааны дүн</dt>
                <dd className="font-medium text-ink-900">
                  {formatCurrency(order.subtotal, store.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-500">Хүргэлт</dt>
                <dd className="font-medium text-ink-900">
                  {order.shippingAmount > 0
                    ? formatCurrency(order.shippingAmount, store.currency)
                    : "Үнэгүй"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-2">
                <dt className="font-semibold text-ink-950">Нийт</dt>
                <dd className="text-base font-bold text-ink-950">
                  {formatCurrency(order.totalAmount, store.currency)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Хүргэлт
            </p>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-600">
              {order?.customerName ? (
                <li className="font-medium text-ink-800">{order.customerName}</li>
              ) : null}
              {order?.customerPhone ? (
                <li className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-ink-400" /> {order.customerPhone}
                </li>
              ) : null}
              {order?.customerEmail ? (
                <li className="flex items-center gap-1.5 break-all">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {order.customerEmail}
                </li>
              ) : null}
              {order?.customerAddress ? (
                <li className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {order.customerAddress}
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Төлбөр
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              {paid
                ? "Төлбөр баталгаажсан."
                : "Онлайн төлбөр авагдаагүй. Төлбөрийг хүргэлтийн үед эсвэл банкны шилжүүлгээр төлнө."}
            </p>
            {!paid && store.settings.payment.bankTransferEnabled ? (
              <p className="mt-2 rounded-lg bg-info-50 px-2.5 py-2 text-[11px] leading-relaxed text-info-700">
                Данс:{" "}
                {store.settings.payment.bankAccount || "дэлгүүрээс лавлана уу"}
              </p>
            ) : null}
            {store.settings.shipping.note ? (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {store.settings.shipping.note}
              </p>
            ) : null}
          </div>
        </div>

        {order?.note ? (
          <div className="mt-4 rounded-2xl bg-surface-muted px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Тэмдэглэл
            </p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-600">
              {order.note}
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-5">
          <Link
            href={`${base}/products`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--store-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Үргэлжлүүлэн худалдан авах <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={base}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            Дэлгүүр рүү буцах
          </Link>
        </div>
      </div>
    </div>
  );
}
