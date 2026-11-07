"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import { categorySchema, formObject, zodErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";

export async function saveCategoryAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/admin/categories");
  const parsed = categorySchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;

  try {
    const repository = getRepository();
    if (id) {
      await repository.updateCategory(id, values);
      await recordAudit(admin, {
        storeId: values.storeId,
        action: "category.updated",
        resourceType: "category",
        resourceId: id,
        metadata: { name: values.name },
      });
    } else {
      const category = await repository.createCategory(values);
      await recordAudit(admin, {
        storeId: values.storeId,
        action: "category.created",
        resourceType: "category",
        resourceId: category.id,
        metadata: { name: values.name },
      });
    }
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/stores/${values.storeId}`);
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/categories");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("categoryId") ?? "");
  const back = String(formData.get("back") ?? "/admin/categories");
  const category = await getRepository().getCategory(id);
  if (!category) redirect(back);
  await getRepository().deleteCategory(id);
  await recordAudit(admin, {
    storeId: category.storeId,
    action: "category.deleted",
    resourceType: "category",
    resourceId: id,
    metadata: { name: category.name },
  });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/categories");
}
