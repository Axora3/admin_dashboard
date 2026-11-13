import type { SheetModule, BusinessType } from "@/lib/google/data-contracts";
import type { Permission } from "@/lib/platform/permissions";

export const BUSINESS_LABELS: Record<BusinessType, string> = { online_store: "Онлайн дэлгүүр", restaurant: "Ресторан / Кофе шоп", service_business: "Үйлчилгээний бизнес", business_profile: "Бизнес танилцуулга", portfolio: "Портфолио" };
export const MODULE_LABELS: Partial<Record<SheetModule, string>> = {
  products: "Бүтээгдэхүүн", categories: "Ангилал", orders: "Захиалга", customers: "Хэрэглэгчид", inventory: "Нөөц", discounts: "Хөнгөлөлт",
  menu: "Цэс", reservations: "Ширээний захиалга", openingHours: "Ажиллах цаг", services: "Үйлчилгээ", appointments: "Цаг захиалга", staff: "Ажилтнууд", availability: "Боломжит цаг",
  pages: "Хуудас", gallery: "Зургийн цомог", articles: "Нийтлэл", contactInquiries: "Ирсэн хүсэлт", projects: "Төслүүд", projectCategories: "Төслийн ангилал",
};
export function modulePermission(module: string, write = false): Permission {
  if (["orders", "reservations", "appointments", "contactInquiries"].includes(module)) return write ? "orders.manage" : "orders.read";
  if (module === "customers") return write ? "customers.manage" : "customers.read";
  if (module === "settings") return "settings.manage";
  return write ? "products.manage" : "products.read";
}

export interface FieldDescriptor { key: string; label: string; kind: "text" | "number" | "boolean" | "json" | "datetime" | "select"; required: boolean; nullable: boolean; options?: string[]; defaultValue?: unknown }
export const FIELD_LABELS: Record<string, string> = {
  name: "Нэр", title: "Гарчиг", slug: "URL нэр", description: "Тайлбар", body: "Агуулга", summary: "Товч тайлбар", price: "Үнэ (₮)", salePrice: "Хямдарсан үнэ", stock: "Үлдэгдэл", sku: "SKU", categoryId: "Ангиллын ID", images: "Зургийн HTTPS холбоосууд (JSON)", variants: "Сонголтууд (JSON)", isActive: "Идэвхтэй", isAvailable: "Боломжтой", isFeatured: "Онцлох",
  status: "Төлөв", sortOrder: "Дараалал", orderNumber: "Захиалгын дугаар", items: "Бүтээгдэхүүн (JSON)", totalAmount: "Нийт дүн", deliveryFee: "Хүргэлтийн төлбөр", shipping: "Хүргэлтийн мэдээлэл (JSON)", paymentMethod: "Төлбөрийн хэлбэр", paymentStatus: "Төлбөрийн төлөв", customerId: "Хэрэглэгчийн ID", customerName: "Хэрэглэгчийн нэр", customerPhone: "Хэрэглэгчийн утас", customerEmail: "Хэрэглэгчийн имэйл", phone: "Утас", email: "Имэйл", note: "Тэмдэглэл", productId: "Бүтээгдэхүүний ID", changeAmount: "Өөрчлөлтийн тоо", reason: "Шалтгаан", balanceAfter: "Дараах үлдэгдэл",
  code: "Код", type: "Төрөл", value: "Утга", minimumAmount: "Доод дүн", startsAt: "Эхлэх цаг", endsAt: "Дуусах цаг", allergens: "Харшил үүсгэгч (JSON)", options: "Нэмэлт сонголт (JSON)", fulfillmentType: "Захиалгын төрөл", requestedAt: "Хүссэн огноо", partySize: "Хүний тоо", reservedAt: "Захиалсан цаг", weekday: "Гараг (0=Ням, 6=Бямба)", opensAt: "Нээх цаг (HH:mm)", closesAt: "Хаах цаг (HH:mm)", isClosed: "Амарна", timezone: "Цагийн бүс", durationMinutes: "Үргэлжлэх минут", currency: "Валют", serviceId: "Үйлчилгээний ID", staffId: "Ажилтны ID", serviceIds: "Үйлчилгээний ID-ууд (JSON)", availability: "Хуваарь (JSON)", seo: "SEO (JSON)", publishedAt: "Нийтлэх цаг", mediaUrl: "Зургийн HTTPS холбоос", linkUrl: "Гадаад HTTPS холбоос", alt: "Зургийн тайлбар", caption: "Зургийн доорх тайлбар", category: "Ангилал", author: "Зохиогч", subject: "Сэдэв", message: "Мессеж", key: "Түлхүүр",
};
