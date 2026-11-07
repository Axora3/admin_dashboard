"use client";

import Link from "next/link";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCart } from "./cart-context";
import { ProductImage } from "./product-image";

export function CartView({
  storeSlug,
  currency,
  shipping,
}: {
  storeSlug: string;
  currency: string;
  shipping: { enabled: boolean; flatRate: number; freeOver: number; note: string };
}) {
  const { items, ready, subtotal, setQuantity, removeItem, clear } = useCart();

  const shippingAmount =
    shipping.enabled && (shipping.freeOver <= 0 || subtotal < shipping.freeOver)
      ? shipping.flatRate
      : 0;
  const total = subtotal + shippingAmount;
  const remainingForFree =
    shipping.enabled && shipping.freeOver > 0 && subtotal < shipping.freeOver
      ? shipping.freeOver - subtotal
      : 0;

  if (!ready) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-50 text-ink-400">
          <ShoppingBag className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink-950">
          Таны сагс хоосон байна
        </h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
          Дэлгүүрийн бараануудаас сонгож сагсандаа нэмээрэй.
        </p>
        <Link
          href={`/store/${storeSlug}/products`}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--store-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Бараа үзэх
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="space-y-3">
        {items.map((line) => {
          const max = line.stock > 0 ? line.stock : 99;
          return (
            <div
              key={line.productId}
              className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4"
            >
              <Link
                href={`/store/${storeSlug}/products/${line.slug}`}
                className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-50"
              >
                <ProductImage src={line.image} alt={line.name} />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/store/${storeSlug}/products/${line.slug}`}
                      className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 hover:text-[var(--store-primary)]"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatCurrency(line.unitPrice, currency)} / ширхэг
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.productId)}
                    aria-label={`${line.name} сагснаас хасах`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="inline-flex h-9 items-center rounded-lg border border-ink-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity - 1)}
                      aria-label="Тоог багасгах"
                      className="flex h-9 w-8 items-center justify-center text-ink-500 hover:text-ink-900"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-ink-900">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      disabled={line.quantity >= max}
                      aria-label="Тоог нэмэх"
                      className="flex h-9 w-8 items-center justify-center text-ink-500 hover:text-ink-900 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-ink-950">
                    {formatCurrency(line.unitPrice * line.quantity, currency)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link
            href={`/store/${storeSlug}/products`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Худалдан авалтаа үргэлжлүүлэх
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Сагсыг бүрэн хоослох уу?")) clear();
            }}
            className="text-xs font-medium text-ink-400 underline underline-offset-2 transition hover:text-danger-600"
          >
            Сагс хоослох
          </button>
        </div>
      </div>

      <aside className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card lg:sticky lg:top-28">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
          Захиалгын дүн
        </h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-500">Барааны дүн</dt>
            <dd className="font-medium text-ink-900">
              {formatCurrency(subtotal, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-500">Хүргэлт</dt>
            <dd className="font-medium text-ink-900">
              {shipping.enabled
                ? shippingAmount === 0
                  ? "Үнэгүй"
                  : formatCurrency(shippingAmount, currency)
                : "Тохирохгүй"}
            </dd>
          </div>
          <div className="h-px bg-ink-100" />
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-ink-950">Нийт</dt>
            <dd className="text-base font-bold text-ink-950">
              {formatCurrency(total, currency)}
            </dd>
          </div>
        </dl>

        {remainingForFree > 0 ? (
          <p className="mt-3 rounded-xl bg-success-50 px-3 py-2 text-xs leading-relaxed text-success-700">
            {formatCurrency(remainingForFree, currency)} нэмж худалдан авалт хийвэл
            хүргэлт үнэгүй.
          </p>
        ) : null}

        {shipping.note ? (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {shipping.note}
          </p>
        ) : null}

        <Link
          href={`/store/${storeSlug}/checkout`}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--store-primary)] text-sm font-semibold text-white transition hover:opacity-90"
        >
          Захиалга үргэлжлүүлэх
        </Link>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-400">
          Онлайн төлбөр одоогоор идэвхгүй. Захиалга баталгаажсаны дараа
          дэлгүүрээс тантай холбогдоно.
        </p>
      </aside>
    </div>
  );
}
