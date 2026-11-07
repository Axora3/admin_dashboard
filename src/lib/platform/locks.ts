import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { checked, platformDb, platformEnabled } from "./db";
const held = new AsyncLocalStorage<{ key: string; assert: () => void }>();
const local = new Set<string>();
export async function withPlatformLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  if (held.getStore()?.key === key) { held.getStore()!.assert(); return work(); }
  const owner = randomUUID();
  let lost = false;
  const assert = () => { if (lost) throw new Error("Operation lock expired; retry safely."); };
  if (platformEnabled()) {
    const lock = checked(await platformDb().rpc("axora_lock", { lock_key: key, lock_owner: owner }));
    if (!lock.data) throw new Error("Дэлгүүрт өөр үйлдэл ажиллаж байна. Дахин оролдоно уу.");
  } else {
    if (local.has(key)) throw new Error("Store operation is already running.");
    local.add(key);
  }
  const heartbeat = platformEnabled() ? setInterval(() => {
    void platformDb().rpc("axora_lock", { lock_key: key, lock_owner: owner }).then(result => { if (result.error || !result.data) lost = true; });
  }, 60_000) : null;
  try { return await held.run({ key, assert }, work); }
  finally {
    if (heartbeat) clearInterval(heartbeat);
    if (platformEnabled()) checked(await platformDb().from("platform_locks").delete().eq("key", key).eq("owner", owner));
    else local.delete(key);
  }
}
export function assertOperationLock() { held.getStore()?.assert(); }
