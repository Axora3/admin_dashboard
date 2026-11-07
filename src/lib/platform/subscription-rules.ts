export type SubscriptionStatus = "trial"|"active"|"suspended"|"cancelled"|"expiring"|"expired";
export interface Plan {id:string;name:string;description:string;monthly_price:number|null;yearly_price:number|null;currency:string;max_products:number|null;max_orders:number|null;max_admins:number|null;storage_bytes:number|null;features:string[];support_level:string;duration_days:number;}
export interface Subscription {store_id:string;plan_id:string;status:SubscriptionStatus;starts_at:string;expires_at:string;}
export function effectiveStatus(s:Subscription,now=Date.now()):SubscriptionStatus {
  if(s.status==="suspended"||s.status==="cancelled")return s.status;
  if(Date.parse(s.expires_at)<=now)return "expired";
  if(Date.parse(s.starts_at)>now)return "suspended";
  if(Date.parse(s.expires_at)-now<=7*86400000)return "expiring";
  return s.status;
}
export function assertEntitlement(s:Subscription|null,p:Plan|null,kind:"products"|"orders"|"admins"|"storage"|"write",usage=0,addition=0,feature?:string) {
  if(!s)return; // Existing unassigned stores retain access; UI explicitly shows Unassigned.
  if(!p)throw new Error("Subscription plan is unavailable.");
  if(["expired","suspended","cancelled"].includes(effectiveStatus(s)))throw new Error("Багцын хугацаа дууссан эсвэл эрх түдгэлзсэн. Super Admin-тай холбогдоно уу.");
  const limit=kind==="products"?p.max_products:kind==="orders"?p.max_orders:kind==="admins"?p.max_admins:kind==="storage"?p.storage_bytes:null;
  if(limit!==null&&usage+addition>limit)throw new Error("Багцын ашиглалтын хязгаарт хүрсэн. Super Admin-тай холбогдоно уу.");
  if(feature&&!p.features.includes(feature))throw new Error("Энэ боломж одоогийн багцад байхгүй.");
}
