import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import type { Store } from "@/lib/types";

export function StoreFooter({
  store,
  categories,
}: {
  store: Store;
  categories: Array<{ id: string; name: string; slug: string }>;
}) {
  const base = `/store/${store.slug}`;
  const social = store.settings.social;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-ink-100 bg-[#0B0D10] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logoUrl}
                alt={store.name}
                className="h-9 w-9 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--store-accent)] text-sm font-bold text-white">
                {store.name.trim().slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-base font-semibold tracking-tight">{store.name}</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
            {store.description || "AXORA платформ дээр ажилладаг онлайн дэлгүүр."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {social.facebook ? (
              <a
                href={social.facebook}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
            ) : null}
            {social.instagram ? (
              <a
                href={social.instagram}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Дэлгүүр
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            <li>
              <Link href={base} className="transition hover:text-white">
                Нүүр хуудас
              </Link>
            </li>
            <li>
              <Link href={`${base}/products`} className="transition hover:text-white">
                Бүх бараа
              </Link>
            </li>
            <li>
              <Link href={`${base}/cart`} className="transition hover:text-white">
                Миний сагс
              </Link>
            </li>
            {categories.slice(0, 3).map((category) => (
              <li key={category.id}>
                <Link
                  href={`${base}/products?category=${encodeURIComponent(category.slug)}`}
                  className="transition hover:text-white"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Холбоо барих
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/60">
            {store.phone ? (
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
                <a href={`tel:${store.phone.replace(/\s+/g, "")}`} className="hover:text-white">
                  {store.phone}
                </a>
              </li>
            ) : null}
            {store.email ? (
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
                <a href={`mailto:${store.email}`} className="break-all hover:text-white">
                  {store.email}
                </a>
              </li>
            ) : null}
            {store.address ? (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
                <span className="leading-relaxed">{store.address}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[11px] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} {store.name}. Бүх эрх хуулиар хамгаалагдсан.
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--store-accent)]" />
            AXORA платформ дээр ажилладаг
          </p>
        </div>
      </div>
    </footer>
  );
}
