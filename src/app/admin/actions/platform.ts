"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin, requireStoreAdmin, requireSuperAdmin } from "@/lib/auth/server";
import { checked, platformDb } from "@/lib/platform/db";
import { getStoreRegistry } from "@/lib/registry";
import { markNotifications } from "@/lib/platform/notifications";
import { NOTIFICATION_CATEGORIES } from "@/lib/platform/notification-rules";
import { checkStoreHealth } from "@/lib/platform/health";
import { runPlatformJobs } from "@/lib/platform/jobs";
import { createBackup, restoreBackup, verifyBackup } from "@/lib/backup/service";
import { withPlatformLock } from "@/lib/platform/locks";
import { FEATURE_CATALOG, PLAN_IDS, extendExpiry } from "@/lib/platform/subscription-rules";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";

/** Errors whose message is safe and useful to show (no secrets, IDs or provider internals). */
class PublicError extends Error {}

const nullableLimit = z.preprocess(v => (v === "" || v === null ? null : v), z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable());
const SAFE_MESSAGE = /Restore|backup|Backup|Багц|огноо|Store ID|дэлгүүрийн job|Дэлгүүр|Admin хязгаар|хугацаа|checksum|ашиглалтын хязгаар|Subscription/;

export async function platformAction(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const operation = String(form.get("operation"));
  let actor = await getCurrentAdmin();
  if (!actor) return { ok: false, message: "Дахин нэвтэрнэ үү." };
  if (!actor.isSuperAdmin) actor = await requireStoreAdmin();
  if (!rateLimit(`platform:${actor.id}`, 30, 60_000).allowed) return { ok: false, message: "Түр хүлээгээд дахин оролдоно уу." };
  let message = "Амжилттай.";
  try {
    const db = platformDb();
    if (operation === "notification.read" || operation === "notification.read_all") {
      // Scoped server-side: a Store Admin can only mark their own store's notifications.
      await markNotifications(actor, operation === "notification.read" ? z.string().uuid().parse(form.get("id")) : undefined);
    } else if (operation === "notification.preferences") {
      const muted = form.getAll("muted").map(String).filter((c): c is (typeof NOTIFICATION_CATEGORIES)[number] => (NOTIFICATION_CATEGORIES as readonly string[]).includes(c));
      checked(await db.from("platform_notification_preferences").upsert({ user_id: actor.id, muted_categories: muted }));
    } else {
      // Everything below is platform management: Super Admin only.
      const admin = await requireSuperAdmin();
      actor = admin;
      if (operation === "plan.save") {
        const plan = z.object({ id: z.enum(PLAN_IDS), name: z.string().trim().min(1).max(80), description: z.string().max(1000), monthly_price: nullableLimit, yearly_price: nullableLimit, max_products: nullableLimit, max_orders: nullableLimit, max_admins: nullableLimit, storage_bytes: nullableLimit, duration_days: z.coerce.number().int().min(1).max(3660), support_level: z.string().min(1).max(100) }).parse(Object.fromEntries(form));
        if (plan.max_admins === 0) throw new PublicError("Admin хязгаар хамгийн багадаа 1 байна.");
        const features = form.getAll("features").map(String).filter(f => FEATURE_CATALOG.some(c => c.id === f));
        checked(await db.from("platform_plans").upsert({ ...plan, features, updated_at: new Date().toISOString() }));
        await recordAudit(admin, { action: "subscription.plan_updated", resourceType: "plan", resourceId: plan.id, metadata: { after: plan, features } });
      } else if (operation === "jobs.run") {
        const result = await runPlatformJobs();
        if (result.failures) throw new PublicError(`${result.failures} дэлгүүрийн job амжилтгүй. System Health-ийг шалгана уу.`);
      } else if (operation === "health.check_all") {
        const stores = (await getStoreRegistry().list()).filter(s => s.status !== "archived");
        const results = [];
        for (const store of stores) results.push(await checkStoreHealth(store.id).catch(() => ({ status: "error" })));
        const bad = results.filter(r => r.status === "error").length;
        message = `${stores.length} дэлгүүр шалгалаа. Алдаатай: ${bad}.`;
      } else {
        const storeId = z.string().min(1).parse(form.get("storeId"));
        if (!await getStoreRegistry().get(storeId)) throw new PublicError("Дэлгүүр олдсонгүй.");
        if (operation === "subscription.save") {
          const plan = z.enum(PLAN_IDS).parse(form.get("planId"));
          const state = z.enum(["trial", "active", "suspended", "cancelled"]).parse(form.get("status"));
          const expires = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(form.get("expires"));
          const expiry = new Date(`${expires}T23:59:59+08:00`).toISOString();
          if (Date.parse(expiry) <= Date.now()) throw new PublicError("Дуусах огноо ирээдүйд байх ёстой.");
          await withPlatformLock(`store:${storeId}`, async () => { checked(await db.rpc("axora_subscription_change", { s: storeId, p: plan, state, expiry, actor: admin.id })); });
          await recordAudit(admin, { storeId, action: "subscription.changed", resourceType: "subscription", resourceId: storeId, metadata: { after: { plan, state, expiry } } });
        } else if (operation === "subscription.extend" || operation === "subscription.suspend" || operation === "subscription.reactivate") {
          await withPlatformLock(`store:${storeId}`, async () => {
            const current = checked(await db.from("platform_subscriptions").select("*").eq("store_id", storeId).maybeSingle()).data;
            if (!current) throw new PublicError("Subscription оноогоогүй байна. Эхлээд багц онооно уу.");
            let state = current.status as string;
            let expiry = current.expires_at as string;
            if (operation === "subscription.extend") {
              const days = z.coerce.number().int().min(1).max(3660).parse(form.get("days"));
              expiry = extendExpiry(current.expires_at, days);
            } else if (operation === "subscription.suspend") {
              state = "suspended";
            } else {
              if (Date.parse(current.expires_at) <= Date.now()) throw new PublicError("Subscription-ий хугацаа дууссан байна. Эхлээд хугацааг сунгана уу.");
              state = "active";
            }
            checked(await db.rpc("axora_subscription_change", { s: storeId, p: current.plan_id, state, expiry, actor: admin.id }));
            const action = { "subscription.extend": "subscription.extended", "subscription.suspend": "subscription.suspended", "subscription.reactivate": "subscription.reactivated" }[operation];
            await recordAudit(admin, { storeId, action, resourceType: "subscription", resourceId: storeId, metadata: { before: { state: current.status, expiry: current.expires_at }, after: { state, expiry } } });
          });
        } else if (operation === "health.check") {
          const result = await checkStoreHealth(storeId);
          message = `Холболтын шалгалт: ${result.status} (${result.code}).`;
        } else if (operation === "sheets.disconnect") {
          if (form.get("confirmation") !== storeId) throw new PublicError("Store ID тохирохгүй байна.");
          await withPlatformLock(`store:${storeId}`, async () => { const registry = getStoreRegistry(); const store = await registry.get(storeId); if (!store) throw new Error("Store not found"); await registry.updateSheets(storeId, { ...store.sheets, spreadsheetId: "", spreadsheetUrl: "", spreadsheetName: null, connectionStatus: "unconfigured", lastError: null, lastCheckedAt: null, lastSyncAt: null }); });
          await recordAudit(admin, { storeId, action: "sheets.disconnected", resourceType: "integration", resourceId: storeId });
        } else if (operation === "backup.create") {
          await createBackup(storeId, "manual", admin.id);
          message = "Backup үүсэж, checksum баталгаажлаа.";
        } else if (operation === "backup.verify") {
          const result = await verifyBackup(z.string().uuid().parse(form.get("id")), storeId, admin.id);
          message = `Backup бүрэн бүтэн: checksum таарсан, ${result.tabs} tab, дэлгүүрийн эзэмшил баталгаажсан.`;
        } else if (operation === "backup.schedule") {
          const interval = z.coerce.number().int().min(1).max(8760).parse(form.get("interval"));
          checked(await db.from("platform_backup_schedules").upsert({ store_id: storeId, enabled: form.get("enabled") === "on", interval_hours: interval, next_run_at: new Date(Date.now() + interval * 3600000).toISOString() }));
          await recordAudit(admin, { storeId, action: "backup.schedule_updated", resourceType: "backup_schedule", resourceId: storeId, metadata: { interval } });
        } else if (operation === "backup.restore") {
          if (form.get("confirmation") !== storeId) throw new PublicError("Баталгаажуулахын тулд Store ID-г яг хэвээр оруулна уу.");
          await restoreBackup(z.string().uuid().parse(form.get("id")), storeId, admin.id, z.string().length(64).parse(form.get("checksum")));
          message = "Restore амжилттай. Сэргээсэн өгөгдлийг шалгаж баталгаажуулсан.";
        } else throw new Error("Unknown operation");
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (error) {
    const text = error instanceof z.ZodError
      ? error.issues.map(i => i.message).join(" · ")
      : error instanceof PublicError || (error instanceof Error && SAFE_MESSAGE.test(error.message))
        ? error.message
        : "Үйлдэл амжилтгүй. Тохиргоо болон System Health-ийг шалгана уу.";
    return { ok: false, message: text };
  }
}
