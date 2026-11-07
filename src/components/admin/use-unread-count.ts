"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Unread notification count. The server (`/api/notifications`) is the source of
 * truth and applies store scoping. Supabase Realtime is only a wake-up signal:
 * it is subject to the RLS policies on platform_notifications, so a Store Admin
 * only receives events for their own store. Polling remains as a fallback when
 * Realtime is unavailable (no Supabase config, migration 0007 not applied).
 */
export function useUnreadCount(initial: number): number {
  const [unread, setUnread] = useState(initial);
  useEffect(() => {
    setUnread(initial);
    let cancelled = false;
    const refresh = () => {
      void fetch("/api/notifications", { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (!cancelled && data && typeof data.unread === "number") setUnread(data.unread); })
        .catch(() => {});
    };
    const timer = setInterval(refresh, 60_000);
    let cleanup: (() => void) | undefined;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const client = createSupabaseBrowserClient();
        const channel = client
          .channel("axora-notifications")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_notifications" }, refresh)
          .subscribe();
        cleanup = () => { void client.removeChannel(channel); };
      } catch {
        // Realtime is optional; polling continues.
      }
    }
    return () => { cancelled = true; clearInterval(timer); cleanup?.(); };
  }, [initial]);
  return unread;
}
