import "server-only";
import type { AdminUser } from "@/lib/types";
import { checked, platformDb, platformEnabled } from "./db";
export const NOTIFICATION_CATEGORIES = ["order","connection","backup","domain","admin","subscription","system","store"];
export interface PlatformNotification { id:string; title:string; category:string; store_id:string|null; created_at:string; read:boolean; }
export async function publishNotification(event: { key:string;storeId:string|null;category:string;title:string;audience:"store"|"platform" }) {
  if (!platformEnabled()) return;
  checked(await platformDb().from("platform_notifications").upsert({event_key:event.key,store_id:event.storeId,category:event.category,title:event.title,audience:event.audience},{onConflict:"event_key",ignoreDuplicates:true}));
}
export async function notificationPage(admin: AdminUser,page=1) {
  if (!platformEnabled()) return {rows:[] as PlatformNotification[],unread:0,total:0,muted:[] as string[]};
  const db=platformDb();
  const preference=checked(await db.from("platform_notification_preferences").select("muted_categories").eq("user_id",admin.id).maybeSingle());
  const muted: string[]=preference.data?.muted_categories??[];
  let q=db.from("platform_notifications").select("*");
  if (!admin.isSuperAdmin) { if (!admin.storeId) throw new Error("No store assignment"); q=q.eq("store_id",admin.storeId).eq("audience","store"); }
  // Query all IDs in bounded pages so unread counts remain correct beyond the first UI page.
  const events: Array<{id:string;title:string;category:string;store_id:string|null;created_at:string}>=[];
  for(let offset=0; ;offset+=1000){const batch=checked(await q.order("created_at",{ascending:false}).range(offset,offset+999));events.push(...(batch.data??[]));if((batch.data?.length??0)<1000)break;}
  const reads=new Set<string>();
  for(let offset=0; ;offset+=1000){const batch=checked(await db.from("platform_notification_reads").select("notification_id").eq("user_id",admin.id).range(offset,offset+999));for(const r of batch.data??[])reads.add(r.notification_id);if((batch.data?.length??0)<1000)break;}
  const visible=events.filter(e=>!muted.includes(e.category));
  return {rows:visible.slice((page-1)*20,page*20).map(e=>({...e,read:reads.has(e.id)})),unread:visible.filter(e=>!reads.has(e.id)).length,total:visible.length,muted};
}
export async function markNotifications(admin:AdminUser,id?:string) {
  const db=platformDb();
  let q=db.from("platform_notifications").select("id");
  if(!admin.isSuperAdmin){if(!admin.storeId)throw new Error("No store assignment");q=q.eq("store_id",admin.storeId).eq("audience","store");}
  if(id)q=q.eq("id",id);
  for(let offset=0; ;offset+=500){const result=checked(await q.order("id").range(offset,offset+499));if(result.data?.length)checked(await db.from("platform_notification_reads").upsert(result.data.map(n=>({user_id:admin.id,notification_id:n.id})),{onConflict:"user_id,notification_id"}));if((result.data?.length??0)<500)break;}
}
