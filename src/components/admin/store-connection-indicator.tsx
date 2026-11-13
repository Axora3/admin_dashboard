import type { SheetsConnectionStatus } from "@/lib/google/types";

/**
 * Store Admin view of integration health. Deliberately shows only a status,
 * the last successful sync time and a plain warning — never spreadsheet IDs,
 * credentials, error internals or configuration.
 */
const STATES: Record<SheetsConnectionStatus, { label: string; dot: string; warning?: string }> = {
  provisioning: { label: "Тохируулж байна", dot: "bg-amber-500", warning: "Google Sheets холболтыг шалгаж байна." },
  connected: { label: "Холболт хэвийн", dot: "bg-emerald-500" },
  local: { label: "Туршилтын горим", dot: "bg-amber-500", warning: "Дэлгүүр туршилтын (local) өгөгдөл ашиглаж байна." },
  error: { label: "Холболтод алдаа гарсан", dot: "bg-red-600", warning: "Дэлгүүрийн өгөгдөлтэй холбогдоход алдаа гарлаа. Мэдээлэл түр шинэчлэгдэхгүй байж магадгүй. AXORA Super Admin-д автоматаар мэдэгдсэн." },
  unconfigured: { label: "Холбогдоогүй", dot: "bg-slate-400", warning: "Дэлгүүрийн өгөгдлийн холболт хараахан тохируулагдаагүй байна. AXORA Super Admin-д хандана уу." },
};

export function storeConnectionState(status: SheetsConnectionStatus) {
  return STATES[status] ?? STATES.error;
}

export function StoreConnectionIndicator({ status, lastSyncAt }: { status: SheetsConnectionStatus; lastSyncAt: string | null }) {
  const state = storeConnectionState(status);
  return <div className="flex items-center gap-2 text-xs" title={`Сүүлд амжилттай синк: ${lastSyncAt ? new Date(lastSyncAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "—"}`}>
    <span className={`h-2 w-2 rounded-full ${state.dot}`} aria-hidden />
    <span>{state.label}</span>
    <span className="hidden text-teal-200 sm:inline">· Синк: {lastSyncAt ? new Date(lastSyncAt).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" }) : "хийгдээгүй"}</span>
  </div>;
}

export function StoreConnectionWarning({ status }: { status: SheetsConnectionStatus }) {
  const warning = storeConnectionState(status).warning;
  return warning ? <p role="alert" className={`border-b px-6 py-3 text-sm ${status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}><span className="mx-auto block max-w-7xl">{warning}</span></p> : null;
}
