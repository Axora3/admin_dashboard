"use client";

import Link from "next/link";
import {
  Bell,
  Boxes,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  UserRound,
} from "lucide-react";
import type { AdminUser, AuditLog } from "@/lib/types";
import type { StoreOption } from "@/lib/data";
import { auditActionLabel } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import { logoutAction } from "@/app/admin/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownDivider } from "@/components/ui/dropdown";
import { StoreSwitcher } from "./store-switcher";

function NotificationIcon({ action }: { action: string }) {
  const className = "h-3.5 w-3.5";
  if (action.startsWith("order")) return <ShoppingCart className={className} />;
  if (action.startsWith("product")) return <Package className={className} />;
  if (action.startsWith("domain")) return <Globe className={className} />;
  if (action.startsWith("inventory")) return <Boxes className={className} />;
  if (action.startsWith("store")) return <Store className={className} />;
  return <ShieldCheck className={className} />;
}

export function AdminHeader({
  admin,
  stores,
  selectedStoreId,
  selectedStoreName,
  notifications,
  onMenu,
}: {
  admin: AdminUser;
  stores: StoreOption[];
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  notifications: AuditLog[];
  onMenu: () => void;
}) {
  return (
    <header className="border-b border-ink-100 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 lg:hidden"
          aria-label="Цэс нээх"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            Одоогийн контекст
          </p>
          <p className="truncate text-[13px] font-semibold text-ink-900">
            {selectedStoreName ?? "Бүх дэлгүүр"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <form
            action="/admin/stores"
            className="relative hidden md:block"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              name="search"
              placeholder="Дэлгүүр хайх…"
              className="h-9 w-48 rounded-xl border border-ink-200 bg-surface-muted/70 pl-8 pr-3 text-[13px] text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 lg:w-56"
            />
          </form>

          <StoreSwitcher
            stores={stores}
            selectedStoreId={selectedStoreId}
            selectedStoreName={selectedStoreName}
          />

          <Dropdown
            trigger={
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-500 shadow-sm transition hover:border-ink-300 hover:text-ink-800">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 ? (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-600 ring-2 ring-white" />
                ) : null}
              </span>
            }
            menuClassName="w-[330px]"
          >
            <div className="flex items-center justify-between px-2.5 py-2">
              <p className="text-xs font-semibold text-ink-900">Сүүлийн үйл ажиллагаа</p>
              <Link
                href="/admin/audit-logs"
                className="text-2xs font-medium text-brand-600 hover:underline"
              >
                Бүгдийг харах
              </Link>
            </div>
            <DropdownDivider />
            {notifications.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-xs text-ink-400">
                Одоогоор үйл ажиллагаа бүртгэгдээгүй.
              </p>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href="/admin/audit-logs"
                  className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-ink-50"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <NotificationIcon action={item.action} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-ink-800">
                      {auditActionLabel(item.action)}
                    </span>
                    <span className="block truncate text-2xs text-ink-400">
                      {item.storeName ? `${item.storeName} · ` : ""}
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </Dropdown>

          <Dropdown
            trigger={
              <span className="flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white pl-1 pr-2 shadow-sm transition hover:border-ink-300">
                <Avatar name={admin.fullName} src={admin.avatarUrl} size="xs" />
                <span className="hidden max-w-[110px] truncate text-xs font-medium text-ink-800 sm:block">
                  {admin.fullName.split(" ")[0]}
                </span>
                <ChevronDown className="h-3 w-3 text-ink-400" />
              </span>
            }
            menuClassName="w-60"
          >
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar name={admin.fullName} src={admin.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink-900">
                  {admin.fullName}
                </p>
                <p className="truncate text-2xs text-ink-400">{admin.email}</p>
              </div>
            </div>
            <DropdownDivider />
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-700 transition hover:bg-ink-50"
            >
              <UserRound className="h-4 w-4 text-ink-400" /> Профайл
            </Link>
            <Link
              href="/admin/settings#security"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-700 transition hover:bg-ink-50"
            >
              <Settings className="h-4 w-4 text-ink-400" /> Тохиргоо
            </Link>
            <DropdownDivider />
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-danger-600 transition hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" /> Гарах
              </button>
            </form>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
