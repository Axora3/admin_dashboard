import "server-only";
import { checked,platformDb,platformEnabled } from "./db";
import { assertEntitlement, type Plan,type Subscription } from "./subscription-rules";
export async function subscriptionFor(storeId:string) {
  if(!platformEnabled())return {subscription:null,plan:null};
  const sub=checked(await platformDb().from("platform_subscriptions").select("*").eq("store_id",storeId).maybeSingle());
  const plan=sub.data?checked(await platformDb().from("platform_plans").select("*").eq("id",sub.data.plan_id).single()).data:null;
  return {subscription:sub.data as Subscription|null,plan:plan as Plan|null};
}
export async function enforceLimit(storeId:string,kind:Parameters<typeof assertEntitlement>[2],usage=0,addition=0,feature?:string) {
  const {subscription,plan}=await subscriptionFor(storeId);assertEntitlement(subscription,plan,kind,usage,addition,feature);
}
export interface PaymentProviderAdapter { readonly provider:string; verifyWebhook(rawBody:string,signature:string):Promise<{eventId:string;externalReference:string;status:string}>; }
// No payment adapter is registered. Payment status remains not_integrated.
