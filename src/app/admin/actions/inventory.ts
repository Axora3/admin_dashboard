"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import { formObject, inventorySchema, zodErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";

export async function adjustStockAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const back = String(formData.get("back") ?? "/admin/inventory");
  const parsed = inventorySchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;

  try {
    const product = await getRepository().getProduct(values.productId);
    if (!product) throw new Error("Бараа олдсонгүй.");
    await getRepository().adjustStock(
      values.productId,
      values.changeAmount,
      values.reason,
      values.note,
      admin.fullName || admin.email,
    );
    await recordAudit(admin, {
      storeId: product.storeId,
      action: "inventory.adjusted",
      resourceType: "inventory",
      resourceId: values.productId,
      metadata: {
        product: product.name,
        change: values.changeAmount,
        reason: values.reason,
      },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(back.startsWith("/admin") ? back : "/admin/inventory");
}
