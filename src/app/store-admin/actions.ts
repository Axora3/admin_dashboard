"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { rateLimit } from "@/lib/rate-limit";
import { getStoreRegistry } from "@/lib/registry";
import { siteIntegrationConfig } from "@/lib/google/site-config";
import { getRepository } from "@/lib/data";
import { recordAudit } from "@/lib/audit";
import { productSchema, categorySchema, formObject } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { assertPermission, type Permission } from "@/lib/platform/permissions";

export async function storeMutation(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  return withStoreAdmin(async admin => {
    const repo = getRepository();
    const operation = String(form.get("operation"));
    const permission:Permission=operation.startsWith("product.")?"products.manage":operation.startsWith("category.")?"products.manage":operation.startsWith("order.")?"orders.manage":"settings.manage";
    assertPermission(admin,permission,admin.storeId);
    if (!rateLimit("legacy-customer:" + admin.id, 40, 60000).allowed) return { ok:false,message:"Түр хүлээгээд дахин оролдоно уу." };
    const site = await getStoreRegistry().get(admin.storeId);
    const resourceName = operation.startsWith("product.") ? "products" : operation.startsWith("category.") ? "categories" : operation.startsWith("order.") ? "orders" : null;
    if (!site || (resourceName && !siteIntegrationConfig(site).enabled_modules.includes(resourceName))) return { ok:false,message:"Энэ боломж сайтад идэвхгүй байна." };
    const id = String(form.get("id") ?? "");
    let before: unknown = null;
    let after: unknown = null;
    try {
      if (operation === "product.save" || operation === "product.delete") {
        const existing = id ? await repo.getProduct(id) : null;
        if (id && (!existing || existing.storeId !== admin.storeId)) throw new Error("Бараа олдсонгүй.");
        before = existing;
        if (operation === "product.delete") { if (!id) throw new Error("Бараа сонгоно уу."); await repo.deleteProduct(id); }
        else {
          const data = productSchema.parse({ ...formObject(form), storeId: admin.storeId, isActive: form.get("isActive") === "on" });
          if (data.categoryId) {
            const category = await repo.getCategory(data.categoryId);
            if (!category || category.storeId !== admin.storeId) throw new Error("Ангилал олдсонгүй.");
          }
          const images = String(form.get("images") ?? "").split(/\r?\n/).map(v => v.trim()).filter(Boolean).slice(0,12);
          for (const image of images) if (!/^https?:\/\//.test(image)) throw new Error("Зургийн URL http(s)://-ээр эхэлнэ.");
          const input = { ...data, categoryId: data.categoryId || null, images, variants: existing?.variants ?? [] };
          after = id ? await repo.updateProduct(id, input) : await repo.createProduct(input);
        }
      } else if (operation === "category.save" || operation === "category.delete") {
        const existing = id ? await repo.getCategory(id) : null;
        if (id && (!existing || existing.storeId !== admin.storeId)) throw new Error("Ангилал олдсонгүй.");
        before = existing;
        if (operation === "category.delete") { if (!id) throw new Error("Ангилал сонгоно уу."); await repo.deleteCategory(id); }
        else {
          const input = categorySchema.parse({ ...formObject(form), storeId: admin.storeId });
          after = id ? await repo.updateCategory(id, input) : await repo.createCategory(input);
        }
      } else if (operation === "order.status") {
        const order = await repo.getOrder(id);
        if (!order || order.storeId !== admin.storeId) throw new Error("Захиалга олдсонгүй.");
        const status = z.enum(["new","confirmed","processing","shipped","delivered","cancelled"]).parse(form.get("status"));
        before = { status: order.orderStatus }; after = { status };
        await repo.updateOrderStatus(id, status);
      } else if (operation === "settings.save") {
        const data = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(2000), phone: z.string().max(30), email: z.string().email(), address: z.string().max(500) }).parse(formObject(form));
        const store = await repo.getStore(admin.storeId);
        before = store && { name: store.name, description: store.description, phone: store.phone, email: store.email, address: store.address };
        await repo.updateStore(admin.storeId, data); after = data;
      } else throw new Error("Зөвшөөрөгдөөгүй үйлдэл.");
      await recordAudit(admin, { storeId: admin.storeId, action: operation, resourceType: operation.split(".")[0], resourceId: id || null, metadata: { before, after, status: "success", role: admin.role } });
      revalidatePath("/", "layout");
      return { ok: true, message: "Амжилттай хадгаллаа." };
    } catch (error) {
      await recordAudit(admin, { storeId: admin.storeId, action: operation, resourceType: operation.split(".")[0], resourceId: null, metadata: { status: "failed", role: admin.role } });
      return { ok: false, message: error instanceof z.ZodError ? error.issues.map(i => i.message).join(" · ") : "Үйлдэл амжилтгүй. Өгөгдөл болон дэлгүүрийн холболтыг шалгана уу." };
    }
  });
}
