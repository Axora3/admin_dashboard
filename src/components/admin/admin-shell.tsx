"use client";

import { useState } from "react";
import type { AdminUser, AuditLog } from "@/lib/types";
import type { StoreOption } from "@/lib/data";
import { Sidebar } from "./sidebar";
import { AdminHeader } from "./admin-header";

export function AdminShell({
  admin,
  stores,
  selectedStoreId,
  selectedStoreName,
  notifications,
  unreadCount,
  banner,
  children,
}: {
  admin: AdminUser;
  stores: StoreOption[];
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  notifications: AuditLog[];
  unreadCount: number;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} admin={admin} />
      <div className="lg:pl-[248px]">
        <div className="sticky top-0 z-30">
          {banner}
          <AdminHeader
            admin={admin}
            stores={stores}
            selectedStoreId={selectedStoreId}
            selectedStoreName={selectedStoreName}
            notifications={notifications}
            unreadCount={unreadCount}
            onMenu={() => setMenuOpen(true)}
          />
        </div>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
