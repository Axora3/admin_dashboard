import type { SubscriptionStatus } from "./subscription-rules";

export const NOTIFICATION_CATEGORIES = ["order", "connection", "backup", "restore", "domain", "admin", "subscription", "system", "store", "sheets"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  order: "Захиалга",
  connection: "Sheets холболт",
  sheets: "Sheets тохиргоо",
  backup: "Backup",
  restore: "Сэргээлт",
  domain: "Домэйн",
  admin: "Admin account",
  subscription: "Subscription",
  system: "Систем",
  store: "Дэлгүүр",
};

/** Audit actions that produce notifications. Everything else stays in the audit log only. */
export const NOTIFIABLE_AUDIT = /^(store\.created|store\.sheets_updated|admin\.|domain\.(created|verified|verification_failed)|subscription\.|backup\.(created|failed|verify_failed)|restore\.|sheets\.)/;

const TITLES: Record<string, string> = {
  "store.created": "Шинэ дэлгүүр бүртгэгдлээ",
  "store.sheets_updated": "Google Sheets тохиргоо өөрчлөгдлөө",
  "sheets.disconnected": "Google Sheets холболт салгагдлаа",
  "admin.create": "Store Admin account үүслээ",
  "admin.update": "Store Admin account шинэчлэгдлээ",
  "admin.reset": "Нууц үг сэргээх имэйл илгээлээ",
  "admin.revoke": "Store Admin эрх цуцлагдлаа",
  "domain.created": "Домэйн нэмэгдлээ",
  "domain.verified": "Домэйн баталгаажлаа",
  "domain.verification_failed": "Домэйн баталгаажуулалт амжилтгүй",
  "subscription.changed": "Subscription шинэчлэгдлээ",
  "subscription.extended": "Subscription сунгагдлаа",
  "subscription.suspended": "Subscription түдгэлзлээ",
  "subscription.reactivated": "Subscription сэргэлээ",
  "subscription.plan_updated": "Багцын тохиргоо өөрчлөгдлөө",
  "backup.created": "Backup амжилттай үүслээ",
  "backup.failed": "Backup амжилтгүй боллоо",
  "backup.verify_failed": "Backup бүрэн бүтэн байдлын шалгалт амжилтгүй",
  "restore.completed": "Restore амжилттай дууслаа",
  "restore.failed": "Restore амжилтгүй — pre-restore backup хадгалагдсан",
};

/** Store-relevant events that the assigned Store Admin may also see (no infrastructure details). */
const STORE_VISIBLE = new Set(["subscription.changed", "subscription.extended", "subscription.suspended", "subscription.reactivated"]);

export function auditNotification(action: string, metadata: Record<string, unknown> = {}): {
  title: string;
  category: string;
  storeVisible: boolean;
} | null {
  if (!NOTIFIABLE_AUDIT.test(action)) return null;
  const failed = metadata.status === "failed";
  let title = TITLES[action] ?? action;
  if (action === "admin.update") {
    const before = metadata.before as { active?: boolean } | null | undefined;
    const after = metadata.after as { active?: boolean } | null | undefined;
    if (before?.active === true && after?.active === false) title = "Store Admin account идэвхгүй боллоо";
    else if (before?.active === false && after?.active === true) title = "Store Admin account идэвхжлээ";
  }
  if (failed && !action.endsWith("failed")) title = `${title} — амжилтгүй`;
  const prefix = action.split(".")[0];
  const category = prefix === "store" && action === "store.sheets_updated" ? "sheets" : prefix;
  return { title, category, storeVisible: !failed && STORE_VISIBLE.has(action) };
}

export function subscriptionStateTitle(state: SubscriptionStatus): string {
  if (state === "expired") return "Subscription-ий хугацаа дууссан";
  if (state === "expiring") return "Subscription-ий хугацаа 7 хоногийн дотор дуусна";
  if (state === "suspended") return "Subscription түдгэлзсэн байна";
  if (state === "cancelled") return "Subscription цуцлагдсан";
  return "Subscription идэвхтэй";
}
