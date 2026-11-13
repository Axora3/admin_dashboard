"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { submitCheckoutAction } from "@/app/store/actions/checkout";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";
import { ProductImage } from "./product-image";
import { LocationPicker } from "@/components/delivery/location-picker";

export function CheckoutForm({
  storeSlug,
  currency,
  shipping,
  payment,
}: {
  storeSlug: string;
  currency: string;
  shipping: { enabled: boolean; flatRate: number; freeOver: number; note: string };
  payment: {
    codEnabled: boolean;
    bankTransferEnabled: boolean;
    bankAccount: string;
    note: string;
  };
}) {
  const { items, ready, subtotal, clear } = useCart();
  const [state, formAction, pending] = useActionState(
    submitCheckoutAction,
    undefined,
  );
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!state?.ok || !state.orderId || redirected.current) return;
    redirected.current = true;
    clear();
    const params = new URLSearchParams({ order: state.orderId });
    if (state.orderNumber) params.set("number", state.orderNumber);
    router.replace(`/store/${storeSlug}/checkout/success?${params.toString()}`);
  }, [state, clear, router, storeSlug]);

  const shippingAmount =
    shipping.enabled && (shipping.freeOver <= 0 || subtotal < shipping.freeOver)
      ? shipping.flatRate
      : 0;
  const total = subtotal + shippingAmount;
  const defaultPayment = payment.codEnabled
    ? "cod"
    : payment.bankTransferEnabled
      ? "bank"
      : "none";

  if (!ready) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="skeleton h-[520px] rounded-3xl" />
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-20 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-ink-950">
          Захиалга үүсгэх боломжгүй
        </h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">
          Таны сагс хоосон байна. Эхлээд бараа сонгоно уу.
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
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
    >
      <input type="hidden" name="storeSlug" value={storeSlug} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        )}
      />

      <div className="space-y-5">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--store-primary)]/10 text-[11px] font-bold text-[var(--store-primary)]">
              1
            </span>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
              Хүргэлтийн мэдээлэл
            </h2>
          </div>

          {state?.message && !state.ok ? (
            <div className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-2.5 text-xs leading-relaxed text-danger-700">
              {state.message}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customerName" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Нэр <span className="text-danger-600">*</span>
              </label>
              <Input
                id="customerName"
                name="customerName"
                autoComplete="name"
                required
                placeholder="Батбаяр Ганбат"
                className="h-11"
                aria-invalid={Boolean(state?.errors?.customerName)}
              />
              {state?.errors?.customerName ? (
                <p className="mt-1.5 text-xs text-danger-600">
                  {state.errors.customerName}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="customerPhone" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Утасны дугаар <span className="text-danger-600">*</span>
              </label>
              <Input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="9911 2233"
                className="h-11"
                aria-invalid={Boolean(state?.errors?.customerPhone)}
              />
              {state?.errors?.customerPhone ? (
                <p className="mt-1.5 text-xs text-danger-600">
                  {state.errors.customerPhone}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="customerEmail" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Имэйл <span className="text-ink-400">(заавал биш)</span>
              </label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                autoComplete="email"
                placeholder="you@example.mn"
                className="h-11"
                aria-invalid={Boolean(state?.errors?.customerEmail)}
              />
              {state?.errors?.customerEmail ? (
                <p className="mt-1.5 text-xs text-danger-600">
                  {state.errors.customerEmail}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="customerAddress" className="mb-1.5 block text-[13px] font-medium text-ink-700">
                Хүргэлтийн хаяг <span className="text-danger-600">*</span>
              </label>
              <Input
                id="customerAddress"
                name="customerAddress"
                autoComplete="street-address"
                required
                placeholder="Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо…"
                className="h-11"
                aria-invalid={Boolean(state?.errors?.customerAddress)}
              />
              {state?.errors?.customerAddress ? (
                <p className="mt-1.5 text-xs text-danger-600">
                  {state.errors.customerAddress}
                </p>
              ) : null}
            </div>
          </div>

          {shipping.enabled ? <div className="mt-5 border-t border-ink-100 pt-5">
            <LocationPicker />
            <p className="mt-2 text-xs text-ink-400">Заавал биш. Сонгосон байршлыг дэлгүүр таны хүргэлтэд ашиглана.</p>
            {state?.errors?.delivery ? <p className="mt-1.5 text-xs text-danger-600">{state.errors.delivery}</p> : null}
          </div> : null}

          <div className="mt-4">
            <label htmlFor="note" className="mb-1.5 block text-[13px] font-medium text-ink-700">
              Нэмэлт тэмдэглэл
            </label>
            <Textarea
              id="note"
              name="note"
              placeholder="Хүргэлтийн цаг, хувилбар (өнгө/хэмжээ) болон бусад хүсэлт…"
              className="min-h-[88px]"
            />
            {state?.errors?.note ? (
              <p className="mt-1.5 text-xs text-danger-600">{state.errors.note}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--store-primary)]/10 text-[11px] font-bold text-[var(--store-primary)]">
              2
            </span>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
              Төлбөрийн хэлбэр
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
            Онлайн картын төлбөр одоогоор холбогдоогүй. Захиалга баталгаажсаны
            дараа дэлгүүрээс тантай холбогдоно.
          </p>

          <div className="mt-4 space-y-2">
            {payment.codEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5 transition hover:border-ink-200">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  defaultChecked={defaultPayment === "cod"}
                  className="mt-0.5 h-4 w-4 border-ink-300 text-[var(--store-primary)] focus:ring-[var(--store-primary)]"
                />
                <span>
                  <span className="block text-sm font-medium text-ink-800">
                    Бэлэн мөнгөөр төлөх
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    Хүргэлтийн үед шууд төлнө.
                  </span>
                </span>
              </label>
            ) : null}

            {payment.bankTransferEnabled ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5 transition hover:border-ink-200">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  defaultChecked={defaultPayment === "bank"}
                  className="mt-0.5 h-4 w-4 border-ink-300 text-[var(--store-primary)] focus:ring-[var(--store-primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-800">
                    Банкны шилжүүлэг
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                    {payment.bankAccount
                      ? `Данс: ${payment.bankAccount}`
                      : "Дансны мэдээллийг дэлгүүрээс авна уу."}
                  </span>
                </span>
              </label>
            ) : null}

            {!payment.codEnabled && !payment.bankTransferEnabled ? (
              <input type="hidden" name="paymentMethod" value="none" />
            ) : null}
          </div>

          {payment.note ? (
            <p className="mt-3 rounded-xl bg-info-50 px-3 py-2 text-xs leading-relaxed text-info-700">
              {payment.note}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card lg:sticky lg:top-28">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
          Таны захиалга
        </h2>

        <ul className="mt-4 space-y-3">
          {items.map((line) => (
            <li key={line.productId} className="flex gap-3">
              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                <ProductImage src={line.image} alt={line.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-ink-800">
                  {line.name}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                </p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-ink-900">
                {formatCurrency(line.unitPrice * line.quantity, currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 h-px bg-ink-100" />

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
            <dt className="font-semibold text-ink-950">Нийт төлөх</dt>
            <dd className="text-base font-bold text-ink-950">
              {formatCurrency(total, currency)}
            </dd>
          </div>
        </dl>

        <button
          type="submit"
          disabled={pending}
          className={cn(
            "mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition",
            "bg-[var(--store-primary)] hover:opacity-90 active:opacity-95",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {pending ? (
            "Захиалга илгээж байна…"
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Захиалга баталгаажуулах
            </>
          )}
        </button>

        <Link
          href={`/store/${storeSlug}/cart`}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Сагс руу буцах
        </Link>

        <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-[11px] leading-relaxed text-ink-400">
          <p className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Таны мэдээллийг зөвхөн энэ захиалгыг гүйцэтгэхэд ашиглана.
          </p>
          <p className="flex items-start gap-1.5">
            <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Төлбөрийн мэдээлэл (картын дугаар) хэзээ ч хадгалагдахгүй.
          </p>
        </div>
      </aside>
    </form>
  );
}
