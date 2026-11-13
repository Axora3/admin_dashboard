"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Globe,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/types";
import { logoutAction } from "@/app/admin/actions/auth";
import { BrandMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";

const NAV_GROUPS = [
  {
    label: "Удирдлага",
    items: [
      { href: "/admin/dashboard", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/admin/admins", label: "Admin Management", icon: Users },
      { href: "/admin/stores", label: "Дэлгүүрүүд", icon: Store },
    ],
  },
  {
    label: "Дэлгүүрийн удирдлага",
    items: [
      { href: "/admin/products", label: "Бараа бүтээгдэхүүн", icon: Package },
      { href: "/admin/categories", label: "Ангилал", icon: Tags },
      { href: "/admin/orders", label: "Захиалгууд", icon: ShoppingCart },
      { href: "/admin/inventory", label: "Барааны үлдэгдэл", icon: Boxes },
      { href: "/admin/customers", label: "Захиалагчид", icon: Users },
      { href: "/admin/deliveries", label: "Хүргэлт", icon: Truck },
    ],
  },
  {
    label: "Өгөгдөл ба хяналт",
    items: [
      { href: "/admin/system-health", label: "System Health", icon: Boxes },
      { href: "/admin/notifications", label: "Мэдэгдэл", icon: ScrollText },
      { href: "/admin/subscriptions", label: "Subscription", icon: Store },
      { href: "/admin/backups", label: "Backup & Recovery", icon: Boxes },
      { href: "/admin/analytics", label: "Статистик", icon: BarChart3 },
      { href: "/admin/domains", label: "Домэйн удирдлага", icon: Globe },
    ],
  },
  {
    label: "Систем",
    items: [
      { href: "/admin/settings", label: "Системийн тохиргоо", icon: Settings },
      { href: "/admin/audit-logs", label: "Аудит лог", icon: ScrollText },
    ],
  },
];

export function Sidebar({
  open,
  onClose,
  admin,
}: {
  open: boolean;
  onClose: () => void;
  admin: AdminUser;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Цэс хаах"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-ink-100 bg-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 lg:hidden"
            aria-label="Хаах"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors",
                          active
                            ? "bg-ink-950 text-white shadow-sm"
                            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-white" : "text-ink-400 group-hover:text-ink-600",
                          )}
                          strokeWidth={1.9}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
            <Avatar name={admin.fullName} src={admin.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink-900">
                {admin.fullName}
              </p>
              <p className="truncate text-2xs text-ink-400">Super Admin</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Гарах"
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
