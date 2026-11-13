"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin, requireStoreAdmin, requireSuperAdmin } from "@/lib/auth/server";
import { storeScope } from "@/lib/auth/store-scope";
import { getRepository } from "@/lib/data";
import { invalidateStoreCache } from "@/lib/data/google-repository";
import { deliverySchema } from "@/lib/delivery/validation";
import { assertPermission } from "@/lib/platform/permissions";
import { withPlatformLock } from "@/lib/platform/locks";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";
import type { Order } from "@/lib/types";

// Audit metadata describes the change; customer coordinates and driver details
// stay exclusively in the store's business sheet.
function auditSummary(order: Order) {
  return { method: order.delivery?.method ?? null, orderStatus: order.orderStatus,
    hasLocation: order.delivery?.latitude != null && order.delivery?.longitude != null,
    driverAssigned: Boolean(order.delivery?.driverName) };
}

export async function deliveryAction(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const current = await getCurrentAdmin();
  if (!current) return { ok: false, message: "Дахин нэвтэрнэ үү." };
  const admin = current.isSuperAdmin ? await requireSuperAdmin() : await requireStoreAdmin();
  const requestedStore = String(form.get("storeId") ?? "");
  const storeId = admin.isSuperAdmin ? requestedStore : admin.storeId!;
  if (!storeId || (requestedStore && requestedStore !== storeId)) return { ok: false, message: "Дэлгүүрийн эрх хүрэлцэхгүй." };
  assertPermission(admin, "orders.manage", storeId);
  if (!rateLimit(`delivery:${admin.id}`, 40, 60_000).allowed) return { ok: false, message: "Түр хүлээгээд дахин оролдоно уу." };
  const orderId = String(form.get("orderId") ?? "");
  if (!orderId || orderId.length > 200) return { ok: false, message: "Захиалга сонгоно уу." };

  return storeScope.run(storeId, async () => {
    try {
      return await withPlatformLock(`store:${storeId}`, async () => {
        invalidateStoreCache(storeId);
        const repo = getRepository();
        const order = await repo.getOrder(orderId, storeId);
        if (!order || order.storeId !== storeId) return { ok: false, message: "Захиалга олдсонгүй." };
        const before = auditSummary(order);
        const operation = form.get("operation");
        let updated: Order;
        if (operation === "details") {
          const coordinate = (key: string) => { const value = String(form.get(key) ?? "").trim(); return value === "" ? null : Number(value); };
          const input = deliverySchema.parse({ method: form.get("method"), latitude: coordinate("latitude"), longitude: coordinate("longitude"),
            driverName: String(form.get("driverName") ?? ""), driverPhone: String(form.get("driverPhone") ?? ""), note: String(form.get("note") ?? "") });
          await repo.updateOrderDelivery(orderId, input, storeId);
          updated = { ...order, delivery: input };
        } else if (operation === "status") {
          const status = z.enum(["shipped", "delivered"]).parse(form.get("status"));
          if (!order.delivery || order.delivery.method === "pickup") return { ok: false, message: "Эхлээд хүргэлтийн төрлийг тохируулна уу." };
          if (order.orderStatus === "cancelled" || order.orderStatus === "delivered") return { ok: false, message: "Дууссан эсвэл цуцлагдсан захиалгын төлөвийг энд өөрчлөхгүй." };
          if (status === "delivered" && order.orderStatus !== "shipped") return { ok: false, message: "Эхлээд хүргэлтэд гарсныг бүртгэнэ үү." };
          await repo.updateOrderStatus(orderId, status);
          updated = { ...order, orderStatus: status };
        } else return { ok: false, message: "Үйлдэл буруу байна." };
        await recordAudit(admin, { storeId, action: operation === "details" ? "order.delivery_updated" : "order.delivery_status_updated",
          resourceType: "order", resourceId: order.id, metadata: { before, after: auditSummary(updated) } });
        revalidatePath("/", "layout");
        return { ok: true, message: "Хүргэлтийн мэдээлэл хадгалагдлаа." };
      });
    } catch (error) {
      return { ok: false, message: error instanceof z.ZodError ? error.issues.map(i => i.message).join(" · ") : "Хадгалах боломжгүй байна. Холболт, багцын эрхээ шалгаад мэдээллээ дахин ачаална уу." };
    }
  });
}
