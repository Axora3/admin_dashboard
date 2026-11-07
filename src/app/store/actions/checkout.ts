"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { getRepository } from "@/lib/data";
import { messageOf } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { formObject, zodErrors } from "@/lib/validation";
import type { CheckoutInput } from "@/lib/types";

export interface CheckoutActionResult extends ActionResult {
  orderId?: string;
  orderNumber?: string;
}

const itemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
});

const checkoutSchema = z.object({
  storeSlug: z.string().trim().min(1, "Дэлгүүр олдсонгүй."),
  customerName: z
    .string()
    .trim()
    .min(2, "Нэрээ бүтэн оруулна уу.")
    .max(120, "Нэр хэт урт байна."),
  customerPhone: z
    .string()
    .trim()
    .min(6, "Утасны дугаараа оруулна уу.")
    .max(30, "Утасны дугаар хэт урт байна.")
    .refine(
      (value) => value.replace(/\D/g, "").length >= 6,
      "Утасны дугаар буруу байна.",
    ),
  customerEmail: z
    .string()
    .trim()
    .max(160)
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Имэйл хаяг буруу байна.",
    ),
  customerAddress: z
    .string()
    .trim()
    .min(4, "Хүргэлтийн хаягаа оруулна уу.")
    .max(500, "Хаяг хэт урт байна."),
  note: z.string().trim().max(1000, "Тэмдэглэл хэт урт байна.").optional().default(""),
  paymentMethod: z.enum(["cod", "bank", "none"]).optional().default("none"),
  items: z
    .array(itemSchema)
    .min(1, "Сагс хоосон байна.")
    .max(50, "Нэг захиалгад хэт олон төрлийн бараа байна."),
});

const PAYMENT_LABELS: Record<"cod" | "bank" | "none", string> = {
  cod: "Бэлэн мөнгө (хүргэлтийн үед)",
  bank: "Банкны шилжүүлэг",
  none: "Дэлгүүртэй тохирно",
};

export async function submitCheckoutAction(
  _previous: CheckoutActionResult | undefined,
  formData: FormData,
): Promise<CheckoutActionResult> {
  const ip = await clientIp();
  const limit = rateLimit(`checkout:${ip}`, 8, 10 * 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Хэт олон захиалга илгээгдлээ. ${limit.retryAfterSeconds} секундын дараа дахин оролдоно уу.`,
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "Сагсны мэдээлэл буруу байна. Хуудсаа сэргээнэ үү." };
  }

  const parsed = checkoutSchema.safeParse({
    ...formObject(formData),
    paymentMethod: formData.get("paymentMethod") ?? "none",
    items: rawItems,
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }

  const values = parsed.data;
  const note = [values.note, `Төлбөрийн хэлбэр: ${PAYMENT_LABELS[values.paymentMethod]}`]
    .filter(Boolean)
    .join("\n");

  const input: CheckoutInput = {
    storeSlug: values.storeSlug,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    customerEmail: values.customerEmail ?? "",
    customerAddress: values.customerAddress,
    note,
    items: values.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };

  try {
    const order = await getRepository().createOrder(input);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/customers");
    revalidatePath(`/store/${values.storeSlug}`, "layout");
    return {
      ok: true,
      message: "Захиалга амжилттай бүртгэгдлээ.",
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
