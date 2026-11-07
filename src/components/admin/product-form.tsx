"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Layers,
  Package,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { Category, Product } from "@/lib/types";
import type { StoreOption } from "@/lib/data";
import { uploadProductImageAction } from "@/app/admin/actions/products";
import { Alert } from "@/components/admin/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

type ProductAction = (
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

export function ProductForm({
  action,
  mode,
  product,
  stores,
  categories,
  defaultStoreId,
}: {
  action: ProductAction;
  mode: "create" | "edit";
  product?: Product;
  stores: StoreOption[];
  categories: Category[];
  defaultStoreId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.errors ?? {};

  const [storeId, setStoreId] = useState(
    product?.storeId ?? defaultStoreId ?? stores[0]?.id ?? "",
  );
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [colors, setColors] = useState(
    product?.variants.find((v) => v.name === "Өнгө")?.values.join(", ") ?? "",
  );
  const [sizes, setSizes] = useState(
    product?.variants.find((v) => v.name === "Хэмжээ")?.values.join(", ") ?? "",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const storeCategories = categories.filter((category) => category.storeId === storeId);

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setUploadError("Эхлээд зураг сонгоно уу.");
      return;
    }
    if (!storeId) {
      setUploadError("Эхлээд дэлгүүрээ сонгоно уу.");
      return;
    }
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("storeId", storeId);
    startUpload(async () => {
      const result = await uploadProductImageAction(formData);
      if (!result.ok || !result.url) {
        setUploadError(result.message ?? "Зураг оруулахад алдаа гарлаа.");
        return;
      }
      setImages((current) => [...current, result.url!].slice(0, 12));
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <input type="hidden" name="images" value={images.join("\n")} />
      {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

      <Section
        icon={Package}
        title="Бүтээгдэхүүний мэдээлэл"
        description="Нэр, төрөл, үнэ болон тайлбар."
      >
        <Field label="Дэлгүүр" htmlFor="storeId" error={errors.storeId} required>
          {mode === "edit" ? (
            <>
              <input type="hidden" name="storeId" value={storeId} />
              <Input
                id="storeId"
                value={stores.find((store) => store.id === storeId)?.name ?? "Дэлгүүр"}
                disabled
              />
            </>
          ) : (
            <Select
              id="storeId"
              name="storeId"
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value);
                setCategoryId("");
              }}
              required
            >
              <option value="" disabled>
                Дэлгүүр сонгох
              </option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ангилал" htmlFor="categoryId" error={errors.categoryId}>
          <Select
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Ангилалгүй</option>
            {storeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Барааны нэр" htmlFor="name" error={errors.name} required>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="Нүүдэлчдийн цамц"
            required
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={errors.slug}
          hint="Public URL-д ашиглагдана."
        >
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder="nuudelchdiin-tsamts"
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
            defaultValue={product?.description ?? ""}
            placeholder="Бүтээгдэхүүний дэлгэрэнгүй тайлбар…"
          />
        </Field>
        <Field label="SKU" htmlFor="sku" error={errors.sku}>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} placeholder="NF-0001" />
        </Field>
        <Field label="Үлдэгдэл (ш)" htmlFor="stock" error={errors.stock} required>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.stock ?? 0}
            required
          />
        </Field>
        <Field label="Үнэ (₮)" htmlFor="price" error={errors.price} required>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1000}
            defaultValue={product?.price ?? 0}
            required
          />
        </Field>
        <Field
          label="Хямд үнэ (₮)"
          htmlFor="salePrice"
          error={errors.salePrice}
          hint="Хямдралгүй бол хоосон орхино."
        >
          <Input
            id="salePrice"
            name="salePrice"
            type="number"
            min={0}
            step={1000}
            defaultValue={product?.salePrice ?? ""}
          />
        </Field>
      </Section>

      <Section
        icon={Layers}
        title="Хувилбар"
        description="Өнгө болон хэмжээг таслалаар тусгаарлан оруулна."
      >
        <Field
          label="Өнгө"
          htmlFor="colors"
          hint="Жишээ: Хар, Цагаан, Хөх"
          error={errors.colors}
        >
          <Input
            id="colors"
            name="colors"
            value={colors}
            onChange={(event) => setColors(event.target.value)}
            placeholder="Хар, Цагаан"
          />
        </Field>
        <Field
          label="Хэмжээ"
          htmlFor="sizes"
          hint="Жишээ: S, M, L, XL"
          error={errors.sizes}
        >
          <Input
            id="sizes"
            name="sizes"
            value={sizes}
            onChange={(event) => setSizes(event.target.value)}
            placeholder="S, M, L"
          />
        </Field>
      </Section>

      <Section
        icon={ImagePlus}
        title="Зураг"
        description="JPG, PNG, WEBP эсвэл AVIF. 5MB хүртэл."
      >
        <div className="sm:col-span-2 space-y-3">
          {images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-ink-100 bg-surface-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Зураг ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((current) => current.filter((_, i) => i !== index))
                    }
                    className="absolute right-1 top-1 rounded-lg bg-ink-950/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Зураг хасах"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-surface-muted/50 py-8 text-center">
              <UploadCloud className="h-6 w-6 text-ink-300" />
              <p className="mt-1.5 text-xs text-ink-400">Одоогоор зураг байхгүй.</p>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="block w-full text-xs text-ink-500 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink-700 hover:file:bg-ink-200"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={uploading}
              onClick={handleUpload}
              className="shrink-0"
            >
              <UploadCloud className="h-4 w-4" /> Зураг оруулах
            </Button>
          </div>
          {uploadError ? <p className="text-xs text-danger-600">{uploadError}</p> : null}
          <p className="text-2xs leading-relaxed text-ink-400">
            Зургийг Supabase Storage-ийн <code>store-assets</code> bucket-д
            хадгална. Demo горимд зөвхөн тухайн session-д хадгалагдана.
          </p>
        </div>
      </Section>

      <Section
        icon={Sparkles}
        title="Харагдах байдал"
        description="Public storefront дээр харагдах нөхцөл."
      >
        <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
          <Switch
            name="isActive"
            checked={product?.isActive ?? true}
            label="Идэвхтэй"
            description="Зарагдах боломжтой."
          />
          <Switch
            name="isFeatured"
            checked={product?.isFeatured ?? false}
            label="Онцлох"
            description="Нүүр хуудсанд онцлоно."
          />
          <Switch
            name="isNew"
            checked={product?.isNew ?? false}
            label="Шинэ"
            description="«Шинэ» тэмдэг харуулна."
          />
        </div>
      </Section>

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={product ? `/admin/products/${product.id}` : "/admin/products"}
          className={buttonClasses("secondary", "md")}
        >
          <ArrowLeft className="h-4 w-4" /> Цуцлах
        </Link>
        <Button type="submit" size="md" loading={pending}>
          {mode === "create" ? "Бараа нэмэх" : "Өөрчлөлтийг хадгалах"}
        </Button>
      </div>
    </form>
  );
}
