"use client";

import { useActionState, useState } from "react";
import {
  FolderTree,
  Pencil,
  Plus,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { Category } from "@/lib/types";
import type { StoreOption } from "@/lib/data";
import {
  deleteCategoryAction,
  saveCategoryAction,
} from "@/app/admin/actions/categories";
import { Alert } from "@/components/admin/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/utils";

type CategoryAction = (
  state: ActionResult | undefined,
  formData: FormData,
) => Promise<ActionResult>;

function CategoryForm({
  action,
  category,
  stores,
  defaultStoreId,
  back,
  onDone,
}: {
  action: CategoryAction;
  category?: Category;
  stores: StoreOption[];
  defaultStoreId?: string;
  back: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [storeId, setStoreId] = useState(category?.storeId ?? defaultStoreId ?? stores[0]?.id ?? "");
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <input type="hidden" name="back" value={back} />
      {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

      <Field label="Дэлгүүр" htmlFor="category-store" error={errors.storeId} required>
        {category ? (
          <>
            <input type="hidden" name="storeId" value={storeId} />
            <Input
              id="category-store"
              value={stores.find((store) => store.id === storeId)?.name ?? "Дэлгүүр"}
              disabled
            />
          </>
        ) : (
          <Select
            id="category-store"
            name="storeId"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            required
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ангиллын нэр" htmlFor="category-name" error={errors.name} required>
          <Input
            id="category-name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="Цамц"
            required
          />
        </Field>
        <Field label="Slug" htmlFor="category-slug" error={errors.slug}>
          <Input
            id="category-slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            placeholder="tsamts"
          />
        </Field>
        <Field label="Эрэмбэ" htmlFor="category-sort" error={errors.sortOrder}>
          <Input
            id="category-sort"
            name="sortOrder"
            type="number"
            min={0}
            step={1}
            defaultValue={category?.sortOrder ?? 0}
          />
        </Field>
        <Field label="Зургийн URL" htmlFor="category-image" error={errors.imageUrl}>
          <Input
            id="category-image"
            name="imageUrl"
            defaultValue={category?.imageUrl ?? ""}
            placeholder="https://…/category.jpg"
          />
        </Field>
        <Field
          label="Тайлбар"
          htmlFor="category-description"
          error={errors.description}
          className="sm:col-span-2"
        >
          <Textarea
            id="category-description"
            name="description"
            defaultValue={category?.description ?? ""}
            placeholder="Ангиллын товч тайлбар…"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={onDone}
          className={buttonClasses("secondary", "md")}
        >
          Цуцлах
        </button>
        <Button type="submit" size="md" loading={pending}>
          {category ? "Хадгалах" : "Ангилал нэмэх"}
        </Button>
      </div>
    </form>
  );
}

export function CategoryManager({
  categories,
  stores,
  storeId,
  back,
}: {
  categories: Category[];
  stores: StoreOption[];
  storeId?: string;
  back: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          {categories.length} ангилал · Барааг ангилалаар бүлэглэж storefront дээр
          харуулна.
        </p>
        <Button
          type="button"
          size="md"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Ангилал нэмэх
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderTree}
            title="Ангилал байхгүй"
            description="Бараагаа бүлэглэхийн тулд эхний ангилалаа үүсгэнэ үү."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Ангилал нэмэх
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {category.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="h-10 w-10 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <FolderTree className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink-900">
                      {category.name}
                    </p>
                    <p className="truncate text-2xs text-ink-400">/{category.slug}</p>
                  </div>
                </div>
                <Badge tone="neutral">{category.productCount} бараа</Badge>
              </div>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-500">
                {category.description || "Тайлбаргүй"}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                <span className="flex items-center gap-1 truncate text-2xs text-ink-400">
                  <StoreIcon className="h-3 w-3" />
                  {storeNames.get(category.storeId) ?? "Дэлгүүр"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(category);
                      setOpen(true);
                    }}
                    className={buttonClasses("ghost", "icon", "h-8 w-8")}
                    title="Засах"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="back" value={back} />
                    <ConfirmSubmit
                      message={`"${category.name}" ангиллыг устгах уу? Бараанууд ангилалгүй болно.`}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Ангилал засах" : "Шинэ ангилал"}
        description={
          editing
            ? "Ангиллын мэдээллийг шинэчилнэ."
            : "Бараагаа бүлэглэх шинэ ангилал үүсгэнэ."
        }
        size="md"
      >
        {open ? (
          <CategoryForm
            action={saveCategoryAction}
            category={editing ?? undefined}
            stores={stores}
            defaultStoreId={storeId}
            back={back}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  );
}
