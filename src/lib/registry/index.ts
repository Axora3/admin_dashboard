import "server-only";

import { fileStoreRegistry } from "./file-registry";
import type { StoreRegistry } from "./types";
import { storeScope } from "@/lib/auth/store-scope";

/**
 * The store registry is configuration only (identity, domains, settings and
 * Google Sheets connection). It is deliberately separate from store business
 * data, which always lives in each store's own spreadsheet.
 *
 * A Supabase/Postgres registry adapter can be added behind this interface for
 * multi-instance deployments without changing the repository or UI.
 */
export function getStoreRegistry(): StoreRegistry {
  const storeId = storeScope.getStore();
  if (storeId) return new Proxy(fileStoreRegistry, {
    get(target, key: keyof StoreRegistry) {
      if (key === "kind") return target.kind;
      if (key === "list") return async () => {
        const store = await target.get(storeId);
        return store ? [store] : [];
      };
      if (key === "get") return async (id: string) => {
        const store = await target.get(storeId);
        return store && (id === store.id || id === store.slug) ? store : null;
      };
      if (["update", "updateSettings", "updateSheets"].includes(key)) return async (id: string, value: never) => {
        if (id !== storeId) throw new Error("Дэлгүүрийн эрх хүрэлцэхгүй.");
        return (target[key] as (id: string, value: never) => unknown)(id, value);
      };
      return () => { throw new Error("Энэ үйлдэлд Super Admin эрх шаардлагатай."); };
    },
  });
  return fileStoreRegistry;
}

export { fileStoreRegistry };
export type { StoreRecord, StoreDomainRecord, StoreRegistry } from "./types";
