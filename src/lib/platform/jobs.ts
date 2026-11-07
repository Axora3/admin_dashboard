import "server-only";
import { checked,platformDb } from "./db";
import { withPlatformLock } from "./locks";
import { getStoreRegistry } from "@/lib/registry";
import { googleSheetsRepository,invalidateStoreCache } from "@/lib/data/google-repository";
import { createBackup } from "@/lib/backup/service";
import { checkStoreHealth } from "./health";
import { publishNotification } from "./notifications";
import { effectiveStatus } from "./subscription-rules";
import { subscriptionStateTitle } from "./notification-rules";
export async function runPlatformJobs() {
  return withPlatformLock("scheduler",async()=>{
    const db=platformDb();const job=checked(await db.from("platform_jobs").insert({status:"running"}).select("id").single()).data!;
    let failures=0;const results:Array<{storeId:string;status:string}>=[];
    try{
      const stores=await getStoreRegistry().list();
      for(const store of stores.filter(s=>s.status==="active")){
        try{
          let skipped=false;
          await withPlatformLock(`store:${store.id}`,async()=>{
            invalidateStoreCache(store.id);
            const health=await checkStoreHealth(store.id);
            if(health.status==="disconnected"){skipped=true;return;}
            if(health.status==="error")throw new Error("connection_failed");
            const cursor=checked(await db.from("platform_poll_cursors").select("*").eq("store_id",store.id).maybeSingle()).data;
            const orders=await googleSheetsRepository.listOrders({storeId:store.id,pageSize:100000});
            if(orders.total>orders.rows.length)throw new Error("Order polling capacity exceeded; adjust cursor strategy.");
            if(cursor?.initialized){const old=new Set(cursor.order_ids);for(const order of orders.rows)if(!old.has(order.id))await publishNotification({key:`order:${store.id}:${order.id}`,storeId:store.id,category:"order",title:`Шинэ захиалга: ${order.orderNumber}`,audience:"store"});}
            checked(await db.from("platform_poll_cursors").upsert({store_id:store.id,order_ids:orders.rows.map(o=>o.id),initialized:true,last_checked_at:new Date().toISOString()}));
          });
          if(skipped){results.push({storeId:store.id,status:"skipped_disconnected"});continue;}
          checked(await db.from("platform_backup_schedules").upsert({store_id:store.id},{onConflict:"store_id",ignoreDuplicates:true}));
          const schedule=checked(await db.from("platform_backup_schedules").select("*").eq("store_id",store.id).single()).data;
          if(schedule.enabled&&Date.parse(schedule.next_run_at)<=Date.now()){
            await createBackup(store.id,"scheduled",null);
            checked(await db.from("platform_backup_schedules").update({next_run_at:new Date(Date.now()+schedule.interval_hours*3600000).toISOString()}).eq("store_id",store.id));
          }
          const sub=checked(await db.from("platform_subscriptions").select("*").eq("store_id",store.id).maybeSingle()).data;
          if(sub&&["expired","expiring","suspended"].includes(effectiveStatus(sub)))await publishNotification({key:`subscription:${store.id}:${sub.updated_at}:${effectiveStatus(sub)}`,storeId:store.id,category:"subscription",title:subscriptionStateTitle(effectiveStatus(sub)),audience:"store"});
          results.push({storeId:store.id,status:"success"});
        }catch{failures++;results.push({storeId:store.id,status:"failed"});await publishNotification({key:`job:${job.id}:${store.id}`,storeId:store.id,category:"system",title:"Scheduled check эсвэл backup амжилтгүй. System Health-ийг шалгана уу.",audience:"platform"});}
      }
    }catch(error){failures++;throw error;}finally{checked(await db.from("platform_jobs").update({status:failures?"failed":"success",failures,completed_at:new Date().toISOString()}).eq("id",job.id));}
    return {jobId:job.id,failures,results};
  });
}
