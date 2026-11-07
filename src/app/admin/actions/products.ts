"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import { isDemoMode } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formObject, productSchema, zodErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";
import type { ProductInput, ProductVariant } from "@/lib/types";

function variantsFrom(formData: FormData): ProductVariant[] {
  const colors = String(formData.get("colors") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const sizes = String(formData.get("sizes") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const variants: ProductVariant[] = [];
  if (colors.length > 0) variants.push({ name: "Өнгө", values: colors });
  if (sizes.length > 0) variants.push({ name: "Хэмжээ", values: sizes });
  return variants;
}

function imagesFrom(formData: FormData): string[] {
  return String(formData.get("images") ?? "")
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter((value) =>
      /^(https?:\/\/|data:image\/|\/)/i.test(value),
    )
    .slice(0, 12);
}

export async function saveProductAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse({
    ...formObject(formData),
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    isNew: formData.get("isNew") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;
  const input: ProductInput = {
    storeId: values.storeId,
    name: values.name,
    slug: values.slug,
    description: values.description,
    price: values.price,
    salePrice: values.salePrice,
    stock: values.stock,
    sku: values.sku,
    categoryId: values.categoryId || null,
    images: imagesFrom(formData),
    variants: variantsFrom(formData),
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    isNew: values.isNew,
  };

  let productId: string;
  try {
    const repository = getRepository();
    if (id) {
      const product = await repository.updateProduct(id, input);
      productId = product.id;
      await recordAudit(admin, {
        storeId: input.storeId,
        action: "product.updated",
        resourceType: "product",
        resourceId: productId,
        metadata: { name: input.name, price: input.price },
      });
    } else {
      const product = await repository.createProduct(input);
      productId = product.id;
      await recordAudit(admin, {
        storeId: input.storeId,
        action: "product.created",
        resourceType: "product",
        resourceId: productId,
        metadata: { name: input.name, price: input.price },
      });
    }
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/dashboard");
  revalidatePath(`/admin/stores/${input.storeId}`);
  revalidatePath("/", "layout");
  redirect(`/admin/products/${productId}?saved=1`);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("productId") ?? "");
  const back = String(formData.get("back") ?? "/admin/products");
  const product = await getRepository().getProduct(id);
  if (!product) redirect(back);
  await getRepository().deleteProduct(id);
  await recordAudit(admin, {
    storeId: product.storeId,
    action: "product.deleted",
    resourceType: "product",
    resourceId: id,
    metadata: { name: product.name },
  });
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/products");
}

export async function bulkProductAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const operation = String(formData.get("operation") ?? "");
  const back = String(formData.get("back") ?? "/admin/products");
  if (ids.length === 0) redirect(back);

  const repository = getRepository();
  if (operation === "activate") {
    await repository.bulkUpdateProducts(ids, { isActive: true });
  } else if (operation === "deactivate") {
    await repository.bulkUpdateProducts(ids, { isActive: false });
  } else if (operation === "delete") {
    await repository.bulkUpdateProducts(ids, { delete: true });
  } else {
    redirect(back);
  }

  await recordAudit(admin, {
    storeId: null,
    action: `product.bulk_${operation}`,
    resourceType: "product",
    resourceId: null,
    metadata: { ids, count: ids.length },
  });
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/products");
}

export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("productId") ?? "");
  const back = String(formData.get("back") ?? "/admin/products");
  const product = await getRepository().getProduct(id);
  if (!product) redirect(back);
  await getRepository().updateProduct(id, {
    storeId: product.storeId,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    stock: product.stock,
    sku: product.sku,
    categoryId: product.categoryId,
    images: product.images,
    variants: product.variants,
    isActive: !product.isActive,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
  });
  await recordAudit(admin, {
    storeId: product.storeId,
    action: product.isActive ? "product.deactivated" : "product.activated",
    resourceType: "product",
    resourceId: id,
    metadata: { name: product.name },
  });
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/products");
}

export interface UploadResult extends ActionResult {
  url?: string;
}

export async function uploadProductImageAction(
  formData: FormData,
): Promise<UploadResult> {
  const admin = await requireSuperAdmin();
  const file = formData.get("file");
  const storeId = String(formData.get("storeId") ?? "");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Зураг сонгоно уу." };
  }
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
    return { ok: false, message: "Зөвхөн JPG, PNG, WEBP, AVIF зураг зөвшөөрөгдөнө." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "Зургийн хэмжээ 5MB-аас бага байх ёстой." };
  }
  if (!storeId) {
    return { ok: false, message: "Эхлээд дэлгүүрээ сонгоно уу." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.type.split("/")[1].replace("jpeg", "jpg");

  if (isDemoMode()) {
    if (file.size > 700 * 1024) {
      return {
        ok: false,
        message: "Demo горимд 700KB-аас бага зураг оруулна уу (production-д 5MB).",
      };
    }
    const base64 = Buffer.from(bytes).toString("base64");
    await recordAudit(admin, {
      storeId,
      action: "product.image_uploaded",
      resourceType: "storage",
      resourceId: null,
      metadata: { size: file.size, mode: "demo" },
    });
    return { ok: true, url: `data:${file.type};base64,${base64}` };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const path = `${storeId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("store-assets")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
    await recordAudit(admin, {
      storeId,
      action: "product.image_uploaded",
      resourceType: "storage",
      resourceId: path,
      metadata: { size: file.size },
    });
    return { ok: true, url: data.publicUrl };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
