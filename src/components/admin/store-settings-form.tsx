"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  ArrowLeft,
  CreditCard,
  Eye,
  Globe2,
  Share2,
  Store as StoreIcon,
  Truck,
} from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { Store } from "@/lib/types";
import { updateStoreSettingsAction } from "@/app/admin/actions/settings";
import { Alert } from "@/components/admin/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";

type SettingsAction = (
  state: ActionResult | undefined,
  formData: FormData,
) => Promise<ActionResult>;

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function StoreSettingsForm({
  action = updateStoreSettingsAction,
  store,
}: {
  action?: SettingsAction;
  store: Store;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.errors ?? {};
  const settings = store.settings;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="storeId" value={store.id} />
      {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

      <Section
        icon={StoreIcon}
        title="Брэнд ба үндсэн мэдээлэл"
        description="Public website дээр харагдах нэр, logo, тайлбар."
      >
        <Field label="Дэлгүүрийн нэр" htmlFor="name" error={errors.name} required>
          <Input id="name" name="name" defaultValue={store.name} required />
        </Field>
        <Field label="Logo URL" htmlFor="logoUrl" error={errors.logoUrl}>
          <div className="flex items-center gap-2">
            <Avatar name={store.name} src={store.logoUrl} size="md" />
            <Input
              id="logoUrl"
              name="logoUrl"
              defaultValue={store.logoUrl ?? ""}
              placeholder="https://…/logo.png"
            />
          </div>
        </Field>
        <Field
          label="Тайлбар"
          htmlFor="description"
          error={errors.description}
          className="sm:col-span-2"
        >
          <Textarea
            id="description"
            name="description"
            defaultValue={store.description}
            placeholder="Дэлгүүрийн танилцуулга…"
          />
        </Field>
        <Field label="Утас" htmlFor="phone" error={errors.phone} required>
          <Input id="phone" name="phone" defaultValue={store.phone} required />
        </Field>
        <Field label="Имэйл" htmlFor="email" error={errors.email} required>
          <Input id="email" name="email" type="email" defaultValue={store.email} required />
        </Field>
        <Field label="Хаяг" htmlFor="address" error={errors.address} className="sm:col-span-2">
          <Input id="address" name="address" defaultValue={store.address} />
        </Field>
      </Section>

      <Section
        icon={Globe2}
        title="Хэл, валют ба theme"
        description="Дэлгүүрийн public website-ийн хэв маяг."
      >
        <Field label="Валют" htmlFor="currency" error={errors.currency}>
          <Select id="currency" name="currency" defaultValue={store.currency}>
            <option value="MNT">MNT — Монгол төгрөг</option>
          </Select>
        </Field>
        <Field label="Хэл" htmlFor="language" error={errors.language}>
          <Select id="language" name="language" defaultValue={store.language}>
            <option value="mn">Монгол</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label="Theme" htmlFor="theme" error={errors.theme} className="sm:col-span-2">
          <Select id="theme" name="theme" defaultValue={settings.theme.style}>
            <option value="minimal">Minimal — цэвэр, энгийн</option>
            <option value="editorial">Editorial — сэтгүүл хэв маяг</option>
            <option value="bold">Bold — тод, эрч хүчтэй</option>
          </Select>
        </Field>
      </Section>

      <Section
        icon={Truck}
        title="Хүргэлт"
        description="Хүргэлтийн төлбөр болон үнэгүй хүргэлтийн босго."
      >
        <div className="sm:col-span-2">
          <Switch
            name="shippingEnabled"
            checked={settings.shipping.enabled}
            label="Хүргэлт идэвхтэй"
            description="Захиалгад хүргэлтийн төлбөр тооцогдоно."
          />
        </div>
        <Field
          label="Хүргэлтийн төлбөр (₮)"
          htmlFor="shippingFlatRate"
          error={errors.shippingFlatRate}
        >
          <Input
            id="shippingFlatRate"
            name="shippingFlatRate"
            type="number"
            min={0}
            step={1000}
            defaultValue={settings.shipping.flatRate}
          />
        </Field>
        <Field
          label="Үнэгүй хүргэлтийн босго (₮)"
          htmlFor="shippingFreeOver"
          error={errors.shippingFreeOver}
          hint="0 гэвэл үнэгүй хүргэлт идэвхгүй."
        >
          <Input
            id="shippingFreeOver"
            name="shippingFreeOver"
            type="number"
            min={0}
            step={10000}
            defaultValue={settings.shipping.freeOver}
          />
        </Field>
        <Field
          label="Хүргэлтийн тэмдэглэл"
          htmlFor="shippingNote"
          error={errors.shippingNote}
          className="sm:col-span-2"
        >
          <Textarea
            id="shippingNote"
            name="shippingNote"
            defaultValue={settings.shipping.note}
            placeholder="Хүргэлтийн нөхцөл…"
          />
        </Field>
      </Section>

      <Section
        icon={CreditCard}
        title="Төлбөр"
        description="Бэлнээр болон банкны шилжүүлэг авах тохиргоо."
      >
        <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
          <Switch
            name="codEnabled"
            checked={settings.payment.codEnabled}
            label="Бэлнээр төлөх"
            description="Хүргэлтийн үед бэлнээр."
          />
          <Switch
            name="bankTransferEnabled"
            checked={settings.payment.bankTransferEnabled}
            label="Банкны шилжүүлэг"
            description="Дансаар шилжүүлэх."
          />
        </div>
        <Field
          label="Банкны данс"
          htmlFor="bankAccount"
          error={errors.bankAccount}
          className="sm:col-span-2"
        >
          <Input
            id="bankAccount"
            name="bankAccount"
            defaultValue={settings.payment.bankAccount}
            placeholder="Хаан банк 5011223344"
          />
        </Field>
        <Field
          label="Төлбөрийн тэмдэглэл"
          htmlFor="paymentNote"
          error={errors.paymentNote}
          className="sm:col-span-2"
        >
          <Textarea
            id="paymentNote"
            name="paymentNote"
            defaultValue={settings.payment.note}
            placeholder="Төлбөрийн нөхцөл…"
          />
        </Field>
      </Section>

      <Section
        icon={Share2}
        title="Сошиал хаяг"
        description="Public website-ийн footer-т харагдана."
      >
        <Field label="Facebook" htmlFor="facebook" error={errors.facebook}>
          <Input
            id="facebook"
            name="facebook"
            defaultValue={settings.social.facebook}
            placeholder="https://facebook.com/…"
          />
        </Field>
        <Field label="Instagram" htmlFor="instagram" error={errors.instagram}>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={settings.social.instagram}
            placeholder="https://instagram.com/…"
          />
        </Field>
      </Section>

      <Section
        icon={Eye}
        title="Харагдах байдал"
        description="Website нийтэд нээлттэй эсэх."
      >
        <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
          <Switch
            name="published"
            checked={settings.visibility.published}
            label="Website нийтэд нээлттэй"
            description="Унтраавал public storefront хаагдана."
          />
          <Switch
            name="showOutOfStock"
            checked={settings.visibility.showOutOfStock}
            label="Дууссан барааг харуулах"
            description="Үлдэгдэл 0 барааг жагсаалтад үлдээнэ."
          />
        </div>
      </Section>

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={`/admin/stores/${store.id}`}
          className={buttonClasses("secondary", "md")}
        >
          <ArrowLeft className="h-4 w-4" /> Дэлгүүр рүү
        </Link>
        <Button type="submit" size="md" loading={pending}>
          Тохиргоог хадгалах
        </Button>
      </div>
    </form>
  );
}
