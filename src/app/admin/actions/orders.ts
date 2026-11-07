"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "pending", "paid", "refunded"];

function backPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/admin") && !path.startsWith("//")
    ? path
    : "/admin/orders";
}

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const back = backPath(formData.get("back"));
  if (!orderId || !ORDER_STATUSES.includes(status)) redirect(back);

  const order = await getRepository().getOrder(orderId);
  if (!order) redirect(back);

  await getRepository().updateOrderStatus(orderId, status);
  await recordAudit(admin, {
    storeId: order.storeId,
    action: "order.status_updated",
    resourceType: "order",
    resourceId: orderId,
    metadata: { orderNumber: order.orderNumber, from: order.orderStatus, to: status },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/inventory");
  revalidatePath("/", "layout");
  redirect(back);
}

export async function updatePaymentStatusAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  const back = backPath(formData.get("back"));
  if (!orderId || !PAYMENT_STATUSES.includes(status)) redirect(back);

  const order = await getRepository().getOrder(orderId);
  if (!order) redirect(back);

  await getRepository().updatePaymentStatus(orderId, status);
  await recordAudit(admin, {
    storeId: order.storeId,
    action: "order.payment_updated",
    resourceType: "order",
    resourceId: orderId,
    metadata: {
      orderNumber: order.orderNumber,
      from: order.paymentStatus,
      to: status,
    },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(back);
}
