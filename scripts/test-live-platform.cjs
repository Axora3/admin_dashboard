// Explicit disposable integration fixtures. No Google Sheets or existing store records are modified.
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const {randomUUID,randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const prefix=`__security_test_${randomUUID()}`;
const storeIds=[`${prefix}_a`,`${prefix}_b`],users=[],notificationIds=[];
function check(r){if(r.error)throw Error(r.error.message);return r.data;}
async function registryChange(transform){for(let i=0;i<3;i++){const row=check(await service.from('platform_registry').select('*').eq('id',true).single());const next=transform(row.payload);const result=await service.rpc('axora_save_registry',{expected_revision:row.revision,next_payload:next});if(!result.error)return; if(i===2)throw Error('Registry changed concurrently; retry test later.');}}
async function main(){
  let passed=0;
  try{
    const fixture=id=>({id,name:'Disposable security fixture',slug:id,businessType:'test',description:'',logoUrl:null,status:'active',currency:'MNT',language:'mn',phone:'',email:'',address:'',ownerName:'',ownerEmail:'',ownerPhone:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),domains:[],sheets:{spreadsheetId:'',spreadsheetUrl:'',spreadsheetName:null,tabs:{products:'Products',categories:'Categories',orders:'Orders',customers:'Customers',settings:'Settings',inventory:'Inventory'},columns:{products:{},categories:{},orders:{},customers:{},settings:{},inventory:{}},connectionStatus:'unconfigured',lastSyncAt:null,lastCheckedAt:null,lastError:null}});
    await registryChange(p=>({...p,stores:[...p.stores,...storeIds.map(fixture)]}));
    const clients=[];
    for(const [index,id] of storeIds.entries()){
      const email=`${prefix}-${index}@example.invalid`,password=randomBytes(32).toString('base64url');
      const u=check(await service.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(u.id);
      check(await service.from('profiles').update({role:'store_admin',is_super_admin:false,is_active:true}).eq('id',u.id));
      check(await service.from('admin_assignments').insert({user_id:u.id,store_id:id}));
      const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});check(await client.auth.signInWithPassword({email,password}));clients.push(client);
      const n=check(await service.from('platform_notifications').insert({event_key:`${prefix}:${index}`,store_id:id,category:'order',title:'Disposable test notification',audience:'store'}).select('id').single());notificationIds.push(n.id);
      check(await service.from('platform_subscriptions').insert({store_id:id,plan_id:'basic',status:'active',expires_at:new Date(Date.now()+86400000).toISOString()}));
    }
    const visible=check(await clients[0].from('platform_notifications').select('id').in('id',notificationIds));assert.deepEqual(visible.map(n=>n.id),[notificationIds[0]]);passed++;
    const registry=check(await clients[0].from('platform_registry').select('id'));assert.equal(registry.length,0);passed++;
    const subscriptions=check(await clients[0].from('platform_subscriptions').select('store_id').in('store_id',storeIds));assert.deepEqual(subscriptions.map(s=>s.store_id),[storeIds[0]]);passed++;
    for(const table of ['platform_backups','platform_audit','platform_jobs']){const r=check(await clients[0].from(table).select('id').limit(1));assert.equal(r.length,0);}passed++;
    const mutation=await clients[0].from('platform_subscriptions').update({status:'active'}).eq('store_id',storeIds[1]);assert.ok(mutation.error);passed++;
    const privilege=await clients[0].rpc('axora_lock',{lock_key:'forged',lock_owner:randomUUID()});assert.ok(privilege.error);passed++;
    const escalate=await clients[0].from('profiles').update({is_super_admin:true,role:'super_admin'}).eq('id',users[0]);assert.ok(escalate.error);passed++;
    check(await service.from('profiles').update({is_active:false}).eq('id',users[0]));const revoked=check(await clients[0].from('platform_notifications').select('id').in('id',notificationIds));assert.equal(revoked.length,0);passed++;
    const bucket=check(await service.storage.getBucket('axora-backups'));assert.equal(bucket.public,false);passed++;
    console.log(JSON.stringify({liveRlsChecksPassed:passed,scope:'two disposable Store Admins, no business data'}));
  }finally{
    if(notificationIds.length)check(await service.from('platform_notifications').delete().in('id',notificationIds));
    check(await service.from('platform_subscriptions').delete().in('store_id',storeIds));
    for(const id of users)check(await service.auth.admin.deleteUser(id));
    await registryChange(p=>({...p,stores:p.stores.filter(s=>!storeIds.includes(s.id))}));
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
