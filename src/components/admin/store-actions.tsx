"use client";

import Link from "next/link";
import {
  Archive,
  Boxes,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Package,
  PauseCircle,
  PlayCircle,
  Settings,
  ShoppingCart,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import type { Store } from "@/lib/types";
import { Dropdown, DropdownDivider } from "@/components/ui/dropdown";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import {
  deleteStoreAction,
  setStoreStatusAction,
} from "@/app/admin/actions/stores";

const itemClass =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900";

export function StoreActions({ store, next }: { store: Store; next: string }) {
  return (
    <Dropdown
      align="end"
      menuClassName="w-56"
      trigger={
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-800">
          <MoreHorizontal className="h-4 w-4" />
        </span>
      }
    >
      <Link href={`/admin/stores/${store.id}`} className={itemClass}>
        <StoreIcon className="h-4 w-4 text-ink-400" /> Дэлгүүр нээх
      </Link>
      <Link href={`/admin/stores/${store.id}/edit`} className={itemClass}>
        <Settings className="h-4 w-4 text-ink-400" /> Мэдээлэл засах
      </Link>
      <Link href={`/store/${store.slug}`} target="_blank" className={itemClass}>
        <ExternalLink className="h-4 w-4 text-ink-400" /> Public website
      </Link>
      <DropdownDivider />
      <Link href={`/admin/products?storeId=${store.id}`} className={itemClass}>
        <Package className="h-4 w-4 text-ink-400" /> Бүтээгдэхүүн
      </Link>
      <Link href={`/admin/orders?storeId=${store.id}`} className={itemClass}>
        <ShoppingCart className="h-4 w-4 text-ink-400" /> Захиалга
      </Link>
      <Link href={`/admin/inventory?storeId=${store.id}`} className={itemClass}>
        <Boxes className="h-4 w-4 text-ink-400" /> Үлдэгдэл
      </Link>
      <Link href={`/admin/domains?storeId=${store.id}`} className={itemClass}>
        <Globe className="h-4 w-4 text-ink-400" /> Домэйн
      </Link>
      <Link href={`/admin/stores/${store.id}/settings`} className={itemClass}>
        <Settings className="h-4 w-4 text-ink-400" /> Дэлгүүрийн тохиргоо
      </Link>
      <DropdownDivider />
      {store.status === "active" ? (
        <form action={setStoreStatusAction}>
          <input type="hidden" name="storeId" value={store.id} />
          <input type="hidden" name="status" value="suspended" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={itemClass}>
            <PauseCircle className="h-4 w-4 text-warning-600" /> Түр хаах
          </button>
        </form>
      ) : (
        <form action={setStoreStatusAction}>
          <input type="hidden" name="storeId" value={store.id} />
          <input type="hidden" name="status" value="active" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={itemClass}>
            <PlayCircle className="h-4 w-4 text-success-600" /> Идэвхжүүлэх
          </button>
        </form>
      )}
      {store.status !== "archived" ? (
        <form action={setStoreStatusAction}>
          <input type="hidden" name="storeId" value={store.id} />
          <input type="hidden" name="status" value="archived" />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={itemClass}>
            <Archive className="h-4 w-4 text-ink-400" /> Архивлах
          </button>
        </form>
      ) : (
        <form action={deleteStoreAction}>
          <input type="hidden" name="storeId" value={store.id} />
          <ConfirmSubmit
            message={`"${store.name}" дэлгүүрийг бүр мөсөн устгах уу? Бүх бараа, захиалга, домэйн устана.`}
            variant="ghost"
            className="w-full justify-start px-2.5 py-2 text-[13px] font-normal text-danger-600 hover:bg-danger-50"
          >
            <Trash2 className="h-4 w-4" /> Бүр мөсөн устгах
          </ConfirmSubmit>
        </form>
      )}
    </Dropdown>
  );
}
