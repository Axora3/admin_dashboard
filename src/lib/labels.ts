import type {
  DomainStatus,
  OrderStatus,
  PaymentStatus,
  StoreStatus,
  ThemeStyle,
} from "./types";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export const STORE_STATUS: Record<StoreStatus, { label: string; tone: Tone }> = {
  active: { label: "Идэвхтэй", tone: "success" },
  suspended: { label: "Түр хаасан", tone: "warning" },
  archived: { label: "Архивласан", tone: "neutral" },
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  new: { label: "Шинэ", tone: "info" },
  confirmed: { label: "Баталгаажсан", tone: "brand" },
  processing: { label: "Бэлтгэж байгаа", tone: "warning" },
  shipped: { label: "Хүргэлтэд гарсан", tone: "info" },
  delivered: { label: "Хүргэгдсэн", tone: "success" },
  cancelled: { label: "Цуцлагдсан", tone: "danger" },
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Төлөгдөөгүй", tone: "neutral" },
  pending: { label: "Хүлээгдэж байгаа", tone: "warning" },
  paid: { label: "Төлөгдсөн", tone: "success" },
  refunded: { label: "Буцаагдсан", tone: "danger" },
};

export const DOMAIN_STATUS: Record<DomainStatus, { label: string; tone: Tone }> = {
  unconnected: { label: "Холбогдоогүй", tone: "neutral" },
  pending: { label: "Баталгаажуулалт хүлээж байна", tone: "warning" },
  verified: { label: "Баталгаажсан", tone: "info" },
  ssl_pending: { label: "SSL тохируулж байна", tone: "warning" },
  active: { label: "Идэвхтэй", tone: "success" },
  error: { label: "Алдаа гарсан", tone: "danger" },
};

export const VERIFICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  unconnected: { label: "Холбогдоогүй", tone: "neutral" },
  pending: { label: "Хүлээгдэж байна", tone: "warning" },
  verified: { label: "Баталгаажсан", tone: "success" },
  failed: { label: "Амжилтгүй", tone: "danger" },
};

export const SSL_STATUS: Record<string, { label: string; tone: Tone }> = {
  none: { label: "Тохируулаагүй", tone: "neutral" },
  provisioning: { label: "Тохируулж байна", tone: "warning" },
  active: { label: "Идэвхтэй", tone: "success" },
  error: { label: "Алдаатай", tone: "danger" },
};

export const THEME_STYLE: Record<ThemeStyle, string> = {
  minimal: "Минимал",
  editorial: "Editorial",
  bold: "Bold",
};

export const BUSINESS_TYPES = [
  "Онлайн дэлгүүр",
  "Restaurant / Coffee shop",
  "Үйлчилгээний бизнес",
  "Бизнес профайл",
    "Портфолио",
  "Хувцас",
  "Электроник",
  "Гоо сайхан",
  "Хүнс & Кофе",
  "Гэр ахуй",
  "Спорт",
  "Хүүхдийн бараа",
  "Бусад",
];

export const INVENTORY_REASONS = [
  "Шинэ бараа нэмэгдэл",
  "Гар аргаар засвар",
  "Буцаалт",
  "Гэмтэл / хасалт",
  "Тооллого",
];

export function storeStatusLabel(status: StoreStatus) {
  return STORE_STATUS[status]?.label ?? status;
}

export function orderStatusLabel(status: OrderStatus) {
  return ORDER_STATUS[status]?.label ?? status;
}

export function paymentStatusLabel(status: PaymentStatus) {
  return PAYMENT_STATUS[status]?.label ?? status;
}

export function domainStatusLabel(status: DomainStatus) {
  return DOMAIN_STATUS[status]?.label ?? status;
}

export const AUDIT_ACTIONS: Array<{ value: string; label: string }> = [
  { value: "store.created", label: "Дэлгүүр үүссэн" },
  { value: "store.updated", label: "Дэлгүүр засагдсан" },
  { value: "store.activated", label: "Дэлгүүр идэвхжсэн" },
  { value: "store.suspended", label: "Дэлгүүр түр хаагдсан" },
  { value: "store.archived", label: "Дэлгүүр архивлагдсан" },
  { value: "store.deleted", label: "Дэлгүүр устсан" },
  { value: "store.settings_updated", label: "Дэлгүүрийн тохиргоо өөрчлөгдсөн" },
  { value: "store.owner_invited", label: "Эзэмшигч уригдсан" },
  { value: "product.created", label: "Бараа нэмэгдсэн" },
  { value: "product.updated", label: "Бараа засагдсан" },
  { value: "product.deleted", label: "Бараа устсан" },
  { value: "product.activated", label: "Бараа идэвхжсэн" },
  { value: "product.deactivated", label: "Бараа идэвхгүй болсон" },
  { value: "category.created", label: "Ангилал нэмэгдсэн" },
  { value: "category.updated", label: "Ангилал засагдсан" },
  { value: "category.deleted", label: "Ангилал устсан" },
  { value: "order.created", label: "Захиалга ирсэн" },
  { value: "order.status_updated", label: "Захиалгын төлөв өөрчлөгдсөн" },
  { value: "order.payment_updated", label: "Төлбөрийн төлөв өөрчлөгдсөн" },
  { value: "inventory.adjusted", label: "Үлдэгдэл өөрчлөгдсөн" },
  { value: "domain.created", label: "Домэйн бүртгэгдсэн" },
  { value: "domain.connected", label: "Домэйн холбогдсон" },
  { value: "domain.verified", label: "Домэйн баталгаажсан" },
  { value: "domain.verification_failed", label: "Домэйн шалгалт амжилтгүй" },
  { value: "domain.primary_changed", label: "Үндсэн домэйн солигдсон" },
  { value: "domain.deleted", label: "Домэйн устсан" },
  { value: "auth.login", label: "Системд нэвтэрсэн" },
  { value: "admin.profile_updated", label: "Профайл шинэчлэгдсэн" },
  { value: "admin.password_changed", label: "Нууц үг солигдсон" },
];

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS.find((item) => item.value === action)?.label ?? action;
}

export const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600 ring-ink-200/70",
  success: "bg-success-50 text-success-700 ring-success-100",
  warning: "bg-warning-50 text-warning-700 ring-warning-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  info: "bg-info-50 text-info-700 ring-info-100",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
};
