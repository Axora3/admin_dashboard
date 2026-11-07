import "server-only";
import type { AdminUser } from "@/lib/types";
import { checked, platformDb, platformEnabled } from "./db";
import { NOTIFICATION_CATEGORIES } from "./notification-rules";

export { NOTIFICATION_CATEGORIES };

export interface PlatformNotification {
  id: string;
  title: string;
  category: string;
  store_id: string | null;
  audience: "store" | "platform";
  created_at: string;
  read: boolean;
}

export async function publishNotification(event: { key: string; storeId: string | null; category: string; title: string; audience: "store" | "platform" }) {
  if (!platformEnabled()) return;
  // A store-audience notification always needs a store; never broadcast store events to everyone.
  if (event.audience === "store" && !event.storeId) throw new Error("Store notification requires a store.");
  checked(await platformDb().from("platform_notifications").upsert(
    { event_key: event.key, store_id: event.storeId, category: event.category, title: event.title, audience: event.audience },
    { onConflict: "event_key", ignoreDuplicates: true },
  ));
}

/**
 * Server-side visibility: Super Admin sees every notification; a Store Admin
 * sees only store-audience notifications for the store assigned on the server.
 * RLS policies in 0006 enforce the same rule for direct authenticated reads.
 */
function scoped(admin: AdminUser) {
  let q = platformDb().from("platform_notifications").select("id,title,category,store_id,audience,created_at");
  if (!admin.isSuperAdmin) {
    if (!admin.storeId) throw new Error("No store assignment");
    q = q.eq("store_id", admin.storeId).eq("audience", "store");
  }
  return q;
}

/** Read state is keyed by Supabase auth user IDs; the local-auth session has none. */
const isAuthUserId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function notificationPage(admin: AdminUser, page = 1, options: { category?: string; unreadOnly?: boolean } = {}) {
  if (!platformEnabled() || !isAuthUserId(admin.id)) return { rows: [] as PlatformNotification[], unread: 0, total: 0, muted: [] as string[], available: false };
  const db = platformDb();
  const preference = checked(await db.from("platform_notification_preferences").select("muted_categories").eq("user_id", admin.id).maybeSingle());
  const muted: string[] = preference.data?.muted_categories ?? [];
  // Query all IDs in bounded pages so unread counts remain correct beyond the first UI page.
  const events: Omit<PlatformNotification, "read">[] = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = checked(await scoped(admin).order("created_at", { ascending: false }).range(offset, offset + 999));
    events.push(...(batch.data ?? []));
    if ((batch.data?.length ?? 0) < 1000) break;
  }
  const reads = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const batch = checked(await db.from("platform_notification_reads").select("notification_id").eq("user_id", admin.id).range(offset, offset + 999));
    for (const r of batch.data ?? []) reads.add(r.notification_id);
    if ((batch.data?.length ?? 0) < 1000) break;
  }
  const visible = events.filter(e => !muted.includes(e.category));
  const unread = visible.filter(e => !reads.has(e.id)).length;
  const filtered = visible.filter(e => (!options.category || e.category === options.category) && (!options.unreadOnly || !reads.has(e.id)));
  return {
    rows: filtered.slice((page - 1) * 20, page * 20).map(e => ({ ...e, read: reads.has(e.id) })),
    unread,
    total: filtered.length,
    muted,
    available: true,
  };
}

export async function markNotifications(admin: AdminUser, id?: string) {
  if (!isAuthUserId(admin.id)) throw new Error("Notification read state requires a Supabase account.");
  const db = platformDb();
  for (let offset = 0; ; offset += 500) {
    let q = scoped(admin);
    if (id) q = q.eq("id", id);
    const result = checked(await q.order("id").range(offset, offset + 499));
    if (result.data?.length) checked(await db.from("platform_notification_reads").upsert(result.data.map(n => ({ user_id: admin.id, notification_id: n.id })), { onConflict: "user_id,notification_id" }));
    if ((result.data?.length ?? 0) < 500) break;
  }
}
