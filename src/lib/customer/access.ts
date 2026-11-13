import "server-only";
import { getCurrentAdmin } from "@/lib/auth/server";
import { getStoreRegistry } from "@/lib/registry";
import { assertPermission } from "@/lib/platform/permissions";
import { siteIntegrationConfig } from "@/lib/google/site-config";
import { rateLimit } from "@/lib/rate-limit";
import { modulePermission } from "./modules";

export class CustomerError extends Error { constructor(public code: string, public status: number) { super(code); } }
export async function authorizeCustomer(request: Request, module: string | null, write = false) {
  const actor = await getCurrentAdmin();
  if (!actor) throw new CustomerError("unauthorized", 401);
  const url = new URL(request.url);
  const supplied = url.searchParams.get("siteId");
  const siteId = actor.isSuperAdmin ? supplied : actor.storeId;
  if (!siteId || (!actor.isSuperAdmin && supplied && supplied !== actor.storeId)) throw new CustomerError("site_forbidden", 403);
  const store = await getStoreRegistry().get(siteId);
  if (!store || (!actor.isSuperAdmin && store.status !== "active")) throw new CustomerError("site_forbidden", 403);
  if (write) {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== url.origin) throw new CustomerError("origin_forbidden", 403);
  }
  const config = siteIntegrationConfig(store);
  if (module && !config.enabled_modules.includes(module as never)) throw new CustomerError("module_disabled", 403);
  try { assertPermission(actor, module ? modulePermission(module, write) : write ? "settings.manage" : "products.read", store.id); }
  catch { throw new CustomerError("permission_denied", 403); }
  if (!rateLimit(`customer:${actor.id}:${write ? "write" : "read"}`, write ? 40 : 120, 60000).allowed) throw new CustomerError("rate_limited", 429);
  return { actor, store, config };
}

export async function customerJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CustomerError("invalid_json", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CustomerError("invalid_json", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 120000) { await reader.cancel(); throw new CustomerError("payload_too_large", 413); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; } catch { throw new CustomerError("invalid_json", 400); }
}

export function customerFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const code = error instanceof CustomerError ? error.code : name === "ZodError" ? "invalid_input" : /Conflict/.test(name) ? "record_conflict" : /SchemaMismatch|TabMissing/.test(name) ? "schema_not_ready" : name === "RecordNotFoundError" ? "record_not_found" : "integration_unavailable";
  const googleStatus = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
  const status = error instanceof CustomerError ? error.status : code === "invalid_input" ? 422 : code === "record_conflict" ? 409 : code === "record_not_found" ? 404 : googleStatus === 429 ? 429 : 503;
  const messages: Record<string, string> = { unauthorized: "Дахин нэвтэрнэ үү.", site_forbidden: "Энэ сайтад хандах эрхгүй эсвэл идэвхтэй сайт өөрчлөгдсөн байна.", module_disabled: "Энэ боломж сайтад идэвхгүй байна.", permission_denied: "Энэ үйлдэлд эрх хүрэлцэхгүй.", origin_forbidden: "Хүсэлтийн эх үүсвэр зөвшөөрөгдөөгүй.", rate_limited: "Түр хүлээгээд дахин оролдоно уу.", invalid_input: "Оруулсан мэдээллийн форматыг шалгана уу.", record_conflict: "Бүртгэл өөрчлөгдсөн байна. Дахин ачаалаад шалгана уу.", schema_not_ready: "Sheets-ийн бүтэц бэлэн биш байна. Тохиргооноос бүтэц шалгах үйлдлийг ажиллуулна уу.", record_not_found: "Бүртгэл олдсонгүй.", integration_unavailable: "Өгөгдлийн эх үүсвэртэй холбогдож чадсангүй. Тохиргоо, сүлжээ болон API хязгаарыг шалгана уу." };
  return Response.json({ ok: false, code, message: messages[code] ?? "Хүсэлт амжилтгүй боллоо." }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
