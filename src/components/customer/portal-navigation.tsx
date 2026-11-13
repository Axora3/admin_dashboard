"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity, Bell, Boxes, ChevronLeft, ChevronRight, CircleHelp, ClipboardList,
  CreditCard, ExternalLink, Gauge, Globe2, Image, LayoutDashboard, Menu,
  Package, Settings2, ShoppingBag, Tags, Truck, Users, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavigationItem = { id: string; label: string; href: string };

const icons: Record<string, LucideIcon> = {
  overview: LayoutDashboard, products: Package, categories: Boxes, orders: ShoppingBag,
  customers: Users, inventory: ClipboardList, discounts: Tags, menu: ClipboardList,
  reservations: ClipboardList, openingHours: Activity, services: Boxes, appointments: ClipboardList,
  staff: Users, availability: Activity, pages: LayoutDashboard, gallery: Image,
  articles: ClipboardList, contactInquiries: CircleHelp, projects: ClipboardList,
  projectCategories: Tags, deliveries: Truck, analytics: Gauge, subscription: CreditCard,
  settings: Settings2, notifications: Bell, "audit-logs": Activity,
};

export function CustomerPortalNavigation({ items, brandName }: { items: NavigationItem[]; brandName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.querySelector(".portal-shell")?.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  const isActive = (href: string) => href === "/store-admin"
    ? pathname === href || pathname === `${href}/`
    : pathname === href || pathname.startsWith(`${href}/`);

  const links = (mobile = false) => items.map(item => {
    const Icon = icons[item.id] ?? CircleHelp;
    const active = isActive(item.href);
    return <Link key={item.id} href={item.href} title={collapsed && !mobile ? item.label : undefined}
      aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}
      className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition ${active ? "bg-[#F16B65] text-white shadow-sm" : "text-[#B7BAC3] hover:bg-white/10 hover:text-white"} ${collapsed && !mobile ? "justify-center px-2" : ""}`}>
      <Icon size={17} strokeWidth={1.8} className="shrink-0" />
      {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
    </Link>;
  });

  return <>
    <aside className={`portal-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#17191F] text-white transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-[244px]"}`}>
      <div className={`flex h-[76px] items-center border-b border-white/10 ${collapsed ? "justify-center px-3" : "justify-between px-5"}`}>
        <Link href="/store-admin" className="flex min-w-0 items-center gap-3" aria-label="AXORA тойм">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F16B65] text-sm font-black tracking-tight">A</span>
          {!collapsed && <span className="min-w-0"><span className="block text-sm font-bold tracking-[0.16em]">AXORA</span><span className="block max-w-36 truncate text-[10px] text-[#9296A2]">{brandName}</span></span>}
        </Link>
        {!collapsed && <button type="button" onClick={() => setCollapsed(true)} aria-label="Цэс хураах" className="rounded-md p-1.5 text-[#9296A2] hover:bg-white/10 hover:text-white"><ChevronLeft size={16} /></button>}
        {collapsed && <button type="button" onClick={() => setCollapsed(false)} aria-label="Цэс дэлгэх" className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-[#252831] text-white shadow"><ChevronRight size={14} /></button>}
      </div>
      <p className={`px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#777B85] ${collapsed ? "sr-only" : ""}`}>Сайтын удирдлага</p>
      <nav aria-label="Сайтын удирдлагын цэс" className={`flex-1 space-y-1 overflow-y-auto px-3 pb-4 ${collapsed ? "pt-5" : ""}`}>{links()}</nav>
      <a href="https://axora.mn" target="_blank" rel="noreferrer" title={collapsed ? "AXORA вэбсайт" : undefined} className={`mx-3 mb-4 flex min-h-10 items-center gap-3 rounded-lg px-3 text-xs text-[#9296A2] transition hover:bg-white/10 hover:text-white ${collapsed ? "justify-center px-2" : ""}`}>
        <Globe2 size={16} />{!collapsed && <><span>AXORA вэбсайт</span><ExternalLink size={13} className="ml-auto" /></>}
      </a>
    </aside>

    <div className="portal-mobile-nav relative z-40 border-b border-[#282B33] bg-[#17191F] text-white lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/store-admin" className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F16B65] text-xs font-black">A</span><span className="text-sm font-bold tracking-[0.15em]">AXORA</span><span className="max-w-36 truncate text-xs text-[#9296A2]">{brandName}</span></Link>
        <button type="button" aria-expanded={mobileOpen} aria-controls="mobile-customer-nav" aria-label={mobileOpen ? "Цэс хаах" : "Цэс нээх"} onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 hover:bg-white/10">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
      {mobileOpen && <nav id="mobile-customer-nav" aria-label="Сайтын удирдлагын цэс" className="grid max-h-[70vh] grid-cols-2 gap-1 overflow-y-auto border-t border-white/10 p-3 sm:grid-cols-3">{links(true)}</nav>}
    </div>
  </>;
}
