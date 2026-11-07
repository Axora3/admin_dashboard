import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { requireStoreAdmin } from "./server";
import type { AdminUser } from "@/lib/types";

export const storeScope = new AsyncLocalStorage<string>();
export async function withStoreAdmin<T>(work: (admin: AdminUser & { storeId: string }) => Promise<T>): Promise<T> {
  const admin = await requireStoreAdmin();
  return storeScope.run(admin.storeId, () => work(admin));
}
