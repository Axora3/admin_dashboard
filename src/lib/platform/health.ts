import "server-only";
import { checked,platformDb } from "./db";
import { getStoreRegistry } from "@/lib/registry";
import { createSheetBackend } from "@/lib/google/sheet-backend";
import { sheetsMode } from "@/lib/config";
import { REQUIRED_COLUMNS,DEFAULT_COLUMNS,type SheetResource } from "@/lib/google/types";
import { requiredMissing } from "@/lib/google/mapping";
import { publishNotification } from "./notifications";
export async function checkStoreHealth(storeId:string) {
  const store=await getStoreRegistry().get(storeId);if(!store)throw new Error("Store not found");
  const start=Date.now();const db=platformDb();let status="healthy",code="connection_verified";
  try{
    const backend=createSheetBackend({storeId,spreadsheetId:store.sheets.spreadsheetId,mode:sheetsMode()});
    const tabs=await backend.listTabs();
    for(const resource of ["products","categories","orders","customers","settings"] as SheetResource[]){
      const tab=store.sheets.tabs[resource];if(!tabs.includes(tab))throw new Error("missing_tab");
      const table=await backend.readTable(tab);
      if(requiredMissing(table.headers,store.sheets.columns[resource],resource).length)throw new Error("missing_columns");
    }
    if(sheetsMode()==="local"){status="warning";code="local_emulator";}
  }catch(error){status="error";code=error instanceof Error&&["missing_tab","missing_columns"].includes(error.message)?error.message:"connection_failed";}
  const previous=checked(await db.from("platform_health").select("status").eq("store_id",storeId).eq("component","sheets").order("checked_at",{ascending:false}).limit(1)).data?.[0];
  const checkedAt=new Date().toISOString();
  checked(await db.from("platform_health").insert({store_id:storeId,component:"sheets",status,code,latency_ms:Date.now()-start,checked_at:checkedAt}));
  await getStoreRegistry().updateSheets(storeId,{...store.sheets,connectionStatus:status==="error"?"error":sheetsMode()==="local"?"local":"connected",lastCheckedAt:checkedAt,lastSyncAt:status==="error"?store.sheets.lastSyncAt:checkedAt,lastError:status==="error"?code:null});
  if(previous?.status!==status)await publishNotification({key:`health:${storeId}:${checkedAt}`,storeId,category:"connection",title:status==="error"?"Дэлгүүрийн холболт алдаатай байна":"Дэлгүүрийн холболтын төлөв шинэчлэгдлээ",audience:"store"});
  return {storeId,status,code,checkedAt};
}
export async function platformHealth() {
  const db=platformDb(),start=Date.now();
  const result=await db.from("profiles").select("id").limit(1);
  const supabase={status:result.error?"error":"healthy",checkedAt:new Date().toISOString(),latencyMs:Date.now()-start};
  if(result.error)throw new Error("Supabase connection or platform schema is unavailable.");
  const [health,jobs,backups,restores]=await Promise.all([
    db.from("platform_health").select("*").order("checked_at",{ascending:false}).limit(200),
    db.from("platform_jobs").select("*").order("started_at",{ascending:false}).limit(10),
    db.from("platform_backups").select("*").order("created_at",{ascending:false}).limit(30),
    db.from("platform_restores").select("*").order("created_at",{ascending:false}).limit(20),
  ]);
  return {supabase,health:checked(health).data??[],jobs:checked(jobs).data??[],backups:checked(backups).data??[],restores:checked(restores).data??[]};
}
