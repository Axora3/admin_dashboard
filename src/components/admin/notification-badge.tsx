"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadCount } from "./use-unread-count";

export function NotificationBadge({ initial, href }: { initial: number; href: string }) {
  const unread = useUnreadCount(initial);
  return <Link href={href} className="relative inline-flex items-center gap-1.5" aria-label={`Мэдэгдэл, уншаагүй ${unread}`}>
    <Bell className="h-4 w-4" />
    {unread > 0 && <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-semibold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
