"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentAdmin,requireStoreAdmin,requireSuperAdmin } from "@/lib/auth/server";
import { checked,platformDb } from "@/lib/platform/db";
import { getStoreRegistry } from "@/lib/registry";
import { markNotifications,NOTIFICATION_CATEGORIES } from "@/lib/platform/notifications";
import { checkStoreHealth } from "@/lib/platform/health";
import { runPlatformJobs } from "@/lib/platform/jobs";
import { createBackup,restoreBackup } from "@/lib/backup/service";
import { withPlatformLock } from "@/lib/platform/locks";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";
const nullableLimit=z.preprocess(v=>v===""||v===null?null:v,z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable());
export async function platformAction(_:ActionResult|undefined,form:FormData):Promise<ActionResult> {
  const operation=String(form.get("operation"));
  let actor=await getCurrentAdmin();if(!actor)return {ok:false,message:"Дахин нэвтэрнэ үү."};
  if(!actor.isSuperAdmin)actor=await requireStoreAdmin();
  if(!rateLimit(`platform:${actor.id}`,30,60_000).allowed)return {ok:false,message:"Түр хүлээгээд дахин оролдоно уу."};
  try{
    const db=platformDb();
    if(operation==="notification.read"||operation==="notification.read_all")await markNotifications(actor,operation==="notification.read"?z.string().uuid().parse(form.get("id")):undefined);
    else if(operation==="notification.preferences"){
      const muted=form.getAll("muted").map(String).filter(c=>NOTIFICATION_CATEGORIES.includes(c));
      checked(await db.from("platform_notification_preferences").upsert({user_id:actor.id,muted_categories:muted}));
    }else{
      actor=await requireSuperAdmin();
      if(operation==="plan.save"){
        const plan=z.object({id:z.enum(["basic","pro","business"]),name:z.string().trim().min(1).max(80),description:z.string().max(1000),monthly_price:nullableLimit,yearly_price:nullableLimit,max_products:nullableLimit,max_orders:nullableLimit,max_admins:nullableLimit,storage_bytes:nullableLimit,duration_days:z.coerce.number().int().min(1).max(3660),support_level:z.string().min(1).max(100)}).parse(Object.fromEntries(form));
        if(plan.max_admins===0)throw new Error("Admin хязгаар хамгийн багадаа 1 байна.");
        const features=form.getAll("features").map(String).filter(f=>["scheduled_backup","reports"].includes(f));
        checked(await db.from("platform_plans").upsert({...plan,features,updated_at:new Date().toISOString()}));
        await recordAudit(actor,{action:"subscription.plan_updated",resourceType:"plan",resourceId:plan.id,metadata:{after:plan,features}});
      }else if(operation==="jobs.run"){
        const result=await runPlatformJobs();if(result.failures)throw new Error(`${result.failures} дэлгүүрийн job амжилтгүй. System Health-ийг шалгана уу.`);
      }else{
        const storeId=z.string().min(1).parse(form.get("storeId"));if(!await getStoreRegistry().get(storeId))throw new Error("Дэлгүүр олдсонгүй.");
        if(operation==="subscription.save"){
          const plan=z.enum(["basic","pro","business"]).parse(form.get("planId"));
          const state=z.enum(["trial","active","suspended","cancelled"]).parse(form.get("status"));
          const expires=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(form.get("expires"));
          const expiry=new Date(`${expires}T23:59:59+08:00`).toISOString();if(Date.parse(expiry)<=Date.now())throw new Error("Дуусах огноо ирээдүйд байх ёстой.");
          await withPlatformLock(`store:${storeId}`,async()=>{checked(await db.rpc("axora_subscription_change",{s:storeId,p:plan,state,expiry,actor:actor!.id}));});
          await recordAudit(actor,{storeId,action:"subscription.changed",resourceType:"subscription",resourceId:storeId,metadata:{after:{plan,state,expiry}}});
        }else if(operation==="health.check")await checkStoreHealth(storeId);
        else if(operation==="sheets.disconnect"){
          if(form.get("confirmation")!==storeId)throw new Error("Store ID тохирохгүй байна.");
          await withPlatformLock(`store:${storeId}`,async()=>{const registry=getStoreRegistry();const store=await registry.get(storeId);if(!store)throw new Error("Store not found");await registry.updateSheets(storeId,{...store.sheets,spreadsheetId:"",spreadsheetUrl:"",spreadsheetName:null,connectionStatus:"unconfigured",lastError:null,lastCheckedAt:null,lastSyncAt:null});});
          await recordAudit(actor,{storeId,action:"sheets.disconnected",resourceType:"integration",resourceId:storeId});
        }
        else if(operation==="backup.create")await createBackup(storeId,"manual",actor.id);
        else if(operation==="backup.schedule"){
          const interval=z.coerce.number().int().min(1).max(8760).parse(form.get("interval"));
          checked(await db.from("platform_backup_schedules").upsert({store_id:storeId,enabled:form.get("enabled")==="on",interval_hours:interval,next_run_at:new Date(Date.now()+interval*3600000).toISOString()}));
          await recordAudit(actor,{storeId,action:"backup.schedule_updated",resourceType:"backup_schedule",resourceId:storeId,metadata:{interval}});
        }else if(operation==="backup.restore"){
          if(form.get("confirmation")!==storeId)throw new Error("Баталгаажуулахын тулд Store ID-г яг хэвээр оруулна уу.");
          await restoreBackup(z.string().uuid().parse(form.get("id")),storeId,actor.id,z.string().length(64).parse(form.get("checksum")));
        }else throw new Error("Unknown operation");
      }
    }
    revalidatePath("/", "layout");return {ok:true,message:"Амжилттай."};
  }catch(error){return {ok:false,message:error instanceof z.ZodError?error.issues.map(i=>i.message).join(" · "):error instanceof Error&&/Restore|backup|Багц|огноо|Store ID|дэлгүүрийн job|Дэлгүүр|Admin хязгаар/.test(error.message)?error.message:"Үйлдэл амжилтгүй. Тохиргоо болон System Health-ийг шалгана уу."};}
}
