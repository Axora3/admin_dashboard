// Additive, explicit import. Existing local files remain intact for rollback.
require('@next/env').loadEnvConfig(process.cwd());
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(process.env.AXORA_DATA_DIR||'.data');
const read=name=>{try{return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const check=r=>{if(r.error)throw Error(r.error.message);return r.data;};
function sanitize(v){if(Array.isArray(v))return v.slice(0,100).map(sanitize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/password|token|credential|private.?key|service.?account|spreadsheet|email|phone|address|bank|customer|items|images/i.test(k)).map(([k,x])=>[k,sanitize(x)]));return v;}
(async()=>{
 const local=read('registry.json'),audit=read('audit-logs.json');
 console.log(JSON.stringify({localStores:local?.stores?.length??0,localAuditEntries:audit?.logs?.length??0,apply:process.argv.includes('--apply')}));
 if(!process.argv.includes('--apply'))return;
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const remote=check(await db.from('platform_registry').select('*').eq('id',true).single());
 if(local?.stores?.length){if(remote.payload.stores.length)throw Error('Remote registry is not empty. Reconcile manually; nothing overwritten.');const stores=local.stores.map(({settings,...metadata})=>metadata);check(await db.rpc('axora_save_registry',{expected_revision:remote.revision,next_payload:{version:1,stores}}));}
 for(const log of audit?.logs??[]){const h=crypto.createHash('sha256').update(`axora-legacy:${log.id}`).digest('hex');const id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;check(await db.from('platform_audit').upsert({id,actor_id:log.actorUserId,actor_name:log.actorName,store_id:log.storeId,action:log.action,resource_type:log.resourceType,resource_id:log.resourceId,metadata:sanitize(log.metadata??{}),created_at:log.createdAt},{onConflict:'id',ignoreDuplicates:true}));}
 console.log('Platform metadata imported. Original local files preserved; business data untouched.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
