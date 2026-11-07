"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, Building2, Globe, Settings2, UserRound } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { Store } from "@/lib/types";
import { BUSINESS_TYPES } from "@/lib/labels";
import { slugify } from "@/lib/utils";
import { Alert } from "@/components/admin/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

type StoreAction = (
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

export function StoreForm({
  action,
  mode,
  store,
}: {
  action: StoreAction;
  mode: "create" | "edit";
  store?: Store;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [slug, setSlug] = useState(store?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(store));
  const [name, setName] = useState(store?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(store?.logoUrl ?? "");
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {store ? <input type="hidden" name="storeId" value={store.id} /> : null}
      {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

      <Section
        icon={Building2}
        title="Бизнесийн мэдээлэл"
        description="Дэлгүүрийн нэр, төрөл, холбоо барих мэдээлэл."
      >
        <Field label="Дэлгүүрийн нэр" htmlFor="name" error={errors.name} required>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="Nomad Fashion"
            required
          />
        </Field>
        <Field
          label="Store slug"
          htmlFor="slug"
          hint="URL болон subdomain-д ашиглагдана. Жишээ: nomad-fashion"
          error={errors.slug}
        >
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder="nomad-fashion"
          />
        </Field>
        <Field label="Бизнесийн төрөл" htmlFor="businessType" error={errors.businessType} required>
          <Select
            id="businessType"
            name="businessType"
            defaultValue={store?.businessType ?? BUSINESS_TYPES[0]}
            required
          >
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Утас" htmlFor="phone" error={errors.phone} required>
          <Input
            id="phone"
            name="phone"
            defaultValue={store?.phone ?? ""}
            placeholder="70112233"
            required
          />
        </Field>
        <Field label="Имэйл" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={store?.email ?? ""}
            placeholder="hello@store.mn"
            required
          />
        </Field>
        <Field label="Logo URL" htmlFor="logoUrl" error={errors.logoUrl}>
          <div className="flex items-center gap-2">
            <Avatar name={name || "Store"} src={logoUrl || null} size="md" />
            <Input
              id="logoUrl"
              name="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…/logo.png"
            />
          </div>
        </Field>
        <Field label="Хаяг" htmlFor="address" error={errors.address} className="sm:col-span-2">
          <Input
            id="address"
            name="address"
            defaultValue={store?.address ?? ""}
            placeholder="Улаанбаатар, Сүхбаатар дүүрэг…"
          />
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
            defaultValue={store?.description ?? ""}
            placeholder="Дэлгүүрийн товч танилцуулга…"
          />
        </Field>
      </Section>

      <Section
        icon={UserRound}
        title="Эзэмшигчийн мэдээлэл"
        description="Store Owner-ийн бүртгэл. Нууц үгийг хэзээ ч гараар хадгалахгүй."
      >
        <Field label="Эзэмшигчийн нэр" htmlFor="ownerName" error={errors.ownerName} required>
          <Input
            id="ownerName"
            name="ownerName"
            defaultValue={store?.ownerName ?? ""}
            placeholder="Тэмүүлэн Батбаяр"
            required
          />
        </Field>
        <Field label="Эзэмшигчийн имэйл" htmlFor="ownerEmail" error={errors.ownerEmail} required>
          <Input
            id="ownerEmail"
            name="ownerEmail"
            type="email"
            defaultValue={store?.ownerEmail ?? ""}
            placeholder="owner@store.mn"
            required
          />
        </Field>
        <Field label="Эзэмшигчийн утас" htmlFor="ownerPhone" error={errors.ownerPhone} required>
          <Input
            id="ownerPhone"
            name="ownerPhone"
            defaultValue={store?.ownerPhone ?? ""}
            placeholder="99112233"
            required
          />
        </Field>
        <div className="flex items-end">
          <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-2xs leading-relaxed text-ink-500">
            Дэлгүүр үүссэний дараа эзэмшигчид аюулгүй урилгын холбоос илгээх боломжтой.
            Нэвтрэх эрх нь store_members бүртгэлээр олгогдоно.
          </p>
        </div>
      </Section>

      <Section
        icon={Globe}
        title="Домэйн мэдээлэл"
        description="Custom domain бүртгэх. DNS болон SSL-ийг бодитоор шалгана."
      >
        <Field
          label="Custom domain"
          htmlFor="domain"
          hint="Жишээ: nomadfashion.mn. www-гүйгээр оруулна уу."
          error={errors.domain}
        >
          <Input
            id="domain"
            name="domain"
            defaultValue={store?.primaryDomain ?? ""}
            placeholder="nomadfashion.mn"
          />
        </Field>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="domainIsPrimary"
              defaultChecked
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Үндсэн домэйн болгох
          </label>
        </div>
      </Section>

      <Section
        icon={Settings2}
        title="Дэлгүүрийн тохиргоо"
        description="Валют, хэл, төлөв болон website theme."
      >
        <Field label="Валют" htmlFor="currency" error={errors.currency}>
          <Select id="currency" name="currency" defaultValue={store?.currency ?? "MNT"}>
            <option value="MNT">MNT — Монгол төгрөг</option>
          </Select>
        </Field>
        <Field label="Хэл" htmlFor="language" error={errors.language}>
          <Select id="language" name="language" defaultValue={store?.language ?? "mn"}>
            <option value="mn">Монгол</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label="Дэлгүүрийн төлөв" htmlFor="status" error={errors.status}>
          <Select id="status" name="status" defaultValue={store?.status ?? "active"}>
            <option value="active">Идэвхтэй</option>
            <option value="suspended">Түр хаасан</option>
            <option value="archived">Архивласан</option>
          </Select>
        </Field>
        <Field label="Website theme" htmlFor="theme" error={errors.theme}>
          <Select
            id="theme"
            name="theme"
            defaultValue={store?.settings.theme.style ?? "minimal"}
          >
            <option value="minimal">Minimal — цэвэр, энгийн</option>
            <option value="editorial">Editorial — сэтгүүл хэв маяг</option>
            <option value="bold">Bold — тод, эрч хүчтэй</option>
          </Select>
        </Field>
      </Section>

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={store ? `/admin/stores/${store.id}` : "/admin/stores"}
          className={buttonClasses("secondary", "md")}
        >
          <ArrowLeft className="h-4 w-4" /> Цуцлах
        </Link>
        <Button type="submit" size="md" loading={pending}>
          {mode === "create" ? "Дэлгүүр үүсгэх" : "Өөрчлөлтийг хадгалах"}
        </Button>
      </div>
    </form>
  );
}
