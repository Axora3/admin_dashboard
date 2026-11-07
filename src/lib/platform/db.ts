import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
export function platformEnabled() { return isSupabaseConfigured() && process.env.AXORA_PLATFORM_STORAGE !== "local"; }
export function platformDb() { return createSupabaseServiceClient(); }
export function checked<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(`Platform storage: ${result.error.message}`);
  return result;
}
