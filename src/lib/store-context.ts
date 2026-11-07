import { cookies } from "next/headers";
import { getRepository } from "@/lib/data";
import type { Store } from "@/lib/types";

export const STORE_COOKIE = "axora_store_context";
export const ALL_STORES = "all";

export interface StoreContext {
  storeId: string | null;
  store: Store | null;
}

export async function getStoreContext(): Promise<StoreContext> {
  const value = (await cookies()).get(STORE_COOKIE)?.value;
  if (!value || value === ALL_STORES) {
    return { storeId: null, store: null };
  }
  const store = await getRepository().getStore(value);
  if (!store) return { storeId: null, store: null };
  return { storeId: store.id, store };
}
