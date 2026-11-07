"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Store as StoreIcon } from "lucide-react";
import { selectStoreAction } from "@/app/admin/actions/auth";
import type { StoreOption } from "@/lib/data";

export function StoreSwitcher({
  stores,
  selectedStoreId,
  selectedStoreName,
}: {
  stores: StoreOption[];
  selectedStoreId: string | null;
  selectedStoreName: string | null;
}) {
  const pathname = usePathname();
  const [value, setValue] = useState(selectedStoreId ?? "all");

  useEffect(() => {
    setValue(selectedStoreId ?? "all");
  }, [selectedStoreId]);

  return (
    <form action={selectStoreAction} className="relative">
      <input type="hidden" name="next" value={pathname} />
      <div className="flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white pl-2.5 pr-1 shadow-sm transition hover:border-ink-300">
        <StoreIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
        <select
          name="storeId"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            event.currentTarget.form?.requestSubmit();
          }}
          className="max-w-[150px] cursor-pointer appearance-none bg-transparent pr-4 text-[13px] font-medium text-ink-800 outline-none"
          aria-label="Дэлгүүр сонгох"
        >
          <option value="all">Бүх дэлгүүр</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="pointer-events-none -ml-3 h-3.5 w-3.5 text-ink-400" />
      </div>
      <span className="sr-only">Одоогийн контекст: {selectedStoreName ?? "Бүх дэлгүүр"}</span>
    </form>
  );
}
