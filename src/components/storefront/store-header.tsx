"use client";

import Link from "next/link";
import { Menu, Phone, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-context";

export interface StoreHeaderProps {
  slug: string;
  name: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  shippingNote: string;
  categories: Array<{ id: string; name: string; slug: string }>;
}

export function StoreHeader({
  slug,
  name,
  logoUrl,
  phone,
  shippingNote,
  categories,
}: StoreHeaderProps) {
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);
  const base = `/store/${slug}`;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="bg-[var(--store-primary)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
          <p className="truncate">
            {shippingNote || "Албан ёсны онлайн дэлгүүр · AXORA платформ"}
          </p>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="hidden shrink-0 items-center gap-1.5 font-medium text-white/90 hover:text-white sm:inline-flex"
            >
              <Phone className="h-3 w-3" /> {phone}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={base} className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={name}
              className="h-9 w-9 rounded-xl border border-ink-100 object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--store-primary)] text-sm font-bold text-white">
              {name.trim().slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink-950">
            {name}
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <Link
            href={base}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-950"
          >
            Нүүр
          </Link>
          <Link
            href={`${base}/products`}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-950"
          >
            Бараа
          </Link>
          {categories.slice(0, 4).map((category) => (
            <Link
              key={category.id}
              href={`${base}/products?category=${encodeURIComponent(category.slug)}`}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-950"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={`${base}/products`}
            aria-label="Бараа хайх"
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-50 hover:text-ink-900 sm:flex"
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            href={`${base}/cart`}
            className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-800 shadow-sm transition hover:bg-ink-50"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Сагс</span>
            {ready && count > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--store-accent)] px-1 text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Цэс"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-50 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-ink-100 bg-white md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
          <Link
            href={base}
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Нүүр
          </Link>
          <Link
            href={`${base}/products`}
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Бүх бараа
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`${base}/products?category=${encodeURIComponent(category.slug)}`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
