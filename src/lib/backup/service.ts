import "server-only";
import { createHash,randomUUID } from "node:crypto";
import { checked,platformDb } from "@/lib/platform/db";
import { getStoreRegistry } from "@/lib/registry";
import { sheetsMode } from "@/lib/config";
import { createSheetBackend } from "@/lib/google/sheet-backend";
import { readWorkbookGrid,restoreWorkbookGrid } from "@/lib/google/sheets-client";
import { withPlatformLock,assertOperationLock } from "@/lib/platform/locks";
import { enforceLimit } from "@/lib/platform/subscriptions";
import { publishNotification } from "@/lib/platform/notifications";
import { invalidateStoreCache } from "@/lib/data/google-repository";
import { recordPlatformAudit } from "@/lib/registry/audit-store";
import { snapshotSchema,normalizedGrid,assertSnapshotOwnership,type Grid } from "./validation";
import type { StoreRecord } from "@/lib/registry/types";
const BUCKET="axora-backups";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
const sourceRef=(s:StoreRecord)=>hash(`${s.id}:${s.sheets.spreadsheetId}:${sheetsMode()}:${JSON.stringify(s.sheets.tabs)}:${JSON.stringify(s.sheets.columns)}`);
async function readGrid(store:StoreRecord):Promise<Grid> {
  if(sheetsMode()==="google")return readWorkbookGrid(store.sheets.spreadsheetId);
  const backend=createSheetBackend({storeId:store.id,spreadsheetId:"",mode:"local"});
  const tabs=await backend.listTabs();
  return Promise.all(tabs.map(async name=>{const table=await backend.readTable(name);return {name,rows:[table.headers.map(h=>({stringValue:h})),...table.rows.map(r=>table.headers.map(h=>({stringValue:r.values[h]??""})))]};}));
}
async function restoreGrid(store:StoreRecord,grid:Grid) {
  assertOperationLock();
  if(sheetsMode()==="google")return restoreWorkbookGrid(store.sheets.spreadsheetId,grid);
  const backend=createSheetBackend({storeId:store.id,spreadsheetId:"",mode:"local"});
  for(const tab of grid){
    const old=await backend.readTable(tab.name);
    const headers=tab.rows[0]?.map(c=>c.stringValue??"")??[];
    if(JSON.stringify(old.headers)!==JSON.stringify(headers))throw new Error("Local recovery requires matching column headers.");
    for(let i=old.rows.length+1;i>=2;i--)await backend.deleteRow(tab.name,i);
    for(const row of tab.rows.slice(1))await backend.writeRow(tab.name,headers,Object.fromEntries(headers.map((h,i)=>[h,String(row[i]?.stringValue??row[i]?.numberValue??row[i]?.boolValue??"")])));
  }
}
async function audit(storeId:string,action:string,id:string,status:string,actor:string|null) {
  await recordPlatformAudit({actorUserId:actor,actorName:actor?"Admin":"Scheduler",storeId,action,resourceType:"backup",resourceId:id,metadata:{status}});
}
export async function createBackup(storeId:string,kind:"manual"|"scheduled"|"pre_restore",actor:string|null) {
  return withPlatformLock(`store:${storeId}`,async()=>{
    const db=platformDb();const store=await getStoreRegistry().get(storeId);if(!store)throw new Error("Store not found.");
    const id=randomUUID();checked(await db.from("platform_backups").insert({id,store_id:storeId,kind,status:"running"}));
    try{
      const grid=await readGrid(store);if(!grid.length)throw new Error("Empty workbook cannot be backed up.");
      const snapshot=snapshotSchema.parse({version:1,storeId,sourceRef:sourceRef(store),mode:sheetsMode(),createdAt:new Date().toISOString(),configuration:{name:store.name,slug:store.slug,status:store.status,tabs:store.sheets.tabs,columns:store.sheets.columns,domains:store.domains.map(d=>({domain:d.domain,isPrimary:d.isPrimary}))},grid});
      const raw=JSON.stringify(snapshot);const size=Buffer.byteLength(raw);if(size>50*1024*1024)throw new Error("Backup exceeds the configured 50MB object limit.");
      const old=checked(await db.from("platform_backups").select("size_bytes").eq("store_id",storeId).eq("status","success"));
      await enforceLimit(storeId,"storage",(old.data??[]).reduce((sum,r)=>sum+(r.size_bytes??0),0),size,kind==="scheduled"?"scheduled_backup":undefined);
      const bucket=checked(await db.storage.getBucket(BUCKET));if(bucket.data!.public)throw new Error("Backup bucket must be private.");
      const objectPath=`${encodeURIComponent(storeId)}/${id}.json`;
      checked(await db.storage.from(BUCKET).upload(objectPath,Buffer.from(raw),{contentType:"application/json",upsert:false}));
      const downloaded=checked(await db.storage.from(BUCKET).download(objectPath));if(hash(await downloaded.data!.text())!==hash(raw))throw new Error("Uploaded backup verification failed.");
      checked(await db.from("platform_backups").update({status:"success",object_path:objectPath,checksum:hash(raw),size_bytes:size,row_count:grid.reduce((n,t)=>n+Math.max(0,t.rows.length-1),0),tab_count:grid.length,completed_at:new Date().toISOString()}).eq("id",id));
      await audit(storeId,"backup.created",id,"success",actor);
      await publishNotification({key:`backup:${id}`,storeId,category:"backup",title:"Backup амжилттай үүслээ",audience:"platform"});
      return id;
    }catch(error){checked(await db.from("platform_backups").update({status:"failed",failure_code:"backup_failed",completed_at:new Date().toISOString()}).eq("id",id));await audit(storeId,"backup.failed",id,"failed",actor);throw error;}
  });
}
export async function backupPreview(id:string,storeId:string) {
  const db=platformDb();const row=checked(await db.from("platform_backups").select("*").eq("id",id).eq("store_id",storeId).eq("status","success").single()).data;
  if(!row.object_path?.startsWith(`${encodeURIComponent(storeId)}/`))throw new Error("Backup namespace mismatch.");
  const blob=checked(await db.storage.from(BUCKET).download(row.object_path)).data;const raw=await blob!.text();if(hash(raw)!==row.checksum)throw new Error("Backup checksum mismatch.");
  const snapshot=snapshotSchema.parse(JSON.parse(raw));const store=await getStoreRegistry().get(storeId);if(!store)throw new Error("Store not found.");
  assertSnapshotOwnership(snapshot,storeId,sourceRef(store));
  return {row,snapshot,store};
}
export async function restoreBackup(id:string,storeId:string,actor:string,confirmedChecksum:string) {
  return withPlatformLock(`store:${storeId}`,async()=>{
    const {row,snapshot,store}=await backupPreview(id,storeId);
    if(row.checksum!==confirmedChecksum)throw new Error("Restore preview has changed. Preview again.");
    const before=await readGrid(store);
    const preBackupId=await createBackup(storeId,"pre_restore",actor);
    const db=platformDb(),restoreId=randomUUID();
    checked(await db.from("platform_restores").insert({id:restoreId,store_id:storeId,backup_id:id,pre_backup_id:preBackupId,status:"running"}));
    let writeStarted=false;
    try{
      if(normalizedGrid(await readGrid(store))!==normalizedGrid(before))throw new Error("Store changed during restore preparation. Retry with a fresh preview.");
      assertOperationLock();writeStarted=true;await restoreGrid(store,snapshot.grid);
      const actual=await readGrid(store);const names=new Set(snapshot.grid.map(t=>t.name));
      if(normalizedGrid(actual.filter(t=>names.has(t.name)))!==normalizedGrid(snapshot.grid))throw new Error("Restored values did not pass verification.");
      checked(await db.from("platform_restores").update({status:"success",completed_at:new Date().toISOString()}).eq("id",restoreId));
      await audit(storeId,"restore.completed",restoreId,"success",actor);
      return restoreId;
    }catch(error){checked(await db.from("platform_restores").update({status:writeStarted?"partial_failure":"failed",failure_code:writeStarted?"verification_or_write_failed":"precondition_failed",completed_at:new Date().toISOString()}).eq("id",restoreId));await audit(storeId,"restore.failed",restoreId,"failed",actor);throw new Error(`Restore амжилтгүй. Pre-restore backup: ${preBackupId}. Restore history-оос сэргээх snapshot-ийг сонгоно уу.`);}
    finally{invalidateStoreCache(storeId);}
  });
}
