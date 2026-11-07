import { googleSheetsRepository } from "./google-repository";
import type { Repository } from "./repository";
import { withPlatformLock } from "@/lib/platform/locks";
import { enforceLimit } from "@/lib/platform/subscriptions";
import { invalidateStoreCache } from "./google-repository";
import { getStoreRegistry } from "@/lib/registry";
const WRITES = new Set(["createProduct","updateProduct","deleteProduct","bulkUpdateProducts","createCategory","updateCategory","deleteCategory","updateOrderStatus","updatePaymentStatus","createOrder","adjustStock","updateStoreSettings","updateStoreSheets","updateStore","setStoreStatus","deleteStore"]);
const guarded = new Proxy(googleSheetsRepository, {
  get(target,key:keyof Repository) {
    const method=target[key];
    if(typeof method!=="function"||!WRITES.has(key))return method;
    return async (...args: unknown[])=>{
      const input=args[0] as Record<string,unknown>;
      let storeIds:string[]=[];
      if(["createProduct","createCategory"].includes(key))storeIds=[String(input.storeId)];
      else if(key==="createOrder"){const store=await getStoreRegistry().get(String(input.storeSlug));if(!store)throw new Error("Store not found");storeIds=[store.id];}
      else if(["updateProduct","updateCategory"].includes(key))storeIds=[String((args[1] as Record<string,unknown>).storeId)];
      else if(["deleteProduct","adjustStock"].includes(key)){const row=await target.getProduct(String(args[0]));if(!row)throw new Error("Product not found");storeIds=[row.storeId];}
      else if(key==="deleteCategory"){const row=await target.getCategory(String(args[0]));if(!row)throw new Error("Category not found");storeIds=[row.storeId];}
      else if(["updateOrderStatus","updatePaymentStatus"].includes(key)){const row=await target.getOrder(String(args[0]));if(!row)throw new Error("Order not found");storeIds=[row.storeId];}
      else if(key==="bulkUpdateProducts"){for(const id of args[0] as string[]){const row=await target.getProduct(id);if(!row)throw new Error("Product not found");storeIds.push(row.storeId);}}
      else storeIds=[String(args[0])];
      const ids=[...new Set(storeIds)].sort();
      async function run(index:number):Promise<unknown>{
        if(index<ids.length)return withPlatformLock(`store:${ids[index]}`,async()=>{invalidateStoreCache(ids[index]);return run(index+1);});
        for(const id of ids){
          if(!["deleteStore","setStoreStatus","updateStoreSheets"].includes(key))await enforceLimit(id,"write");
          if(key==="createProduct")await enforceLimit(id,"products",(await target.listProducts({storeId:id,pageSize:1})).total,1);
          if(key==="createOrder"||key==="updateOrderStatus"){
            const from=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ulaanbaatar"}).slice(0,7)+"-01";
            await enforceLimit(id,"orders",(await target.listOrders({storeId:id,from,pageSize:1})).total,key==="createOrder"?1:0);
          }
        }
        return (method as (...values:unknown[])=>Promise<unknown>).apply(target,args);
      }
      return run(0);
    };
  },
}) as Repository;

/**
 * Store business data always lives in each store's own Google Spreadsheet
 * (or the clearly-labelled local file emulator during development). There is
 * no central business database.
 */
export function getRepository(): Repository {
  return guarded;
}

export type { Repository, StoreOption, AuditInput } from "./repository";
