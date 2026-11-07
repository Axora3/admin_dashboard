"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  name: string;
  label: string;
  options: FilterOption[];
}

export function FilterBar({
  basePath,
  searchPlaceholder = "Хайх…",
  filters = [],
  current,
  dateRange = false,
  right,
}: {
  basePath: string;
  searchPlaceholder?: string;
  filters?: FilterDefinition[];
  current: Record<string, string | undefined>;
  dateRange?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(current.search ?? "");

  function apply(patch: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      ...current,
      search: search || undefined,
      ...patch,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (!value || value === "all" || key === "page") continue;
      params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${basePath}?${query}` : basePath);
    });
  }

  const hasFilters =
    Boolean(current.search) ||
    Boolean(current.from) ||
    Boolean(current.to) ||
    filters.some((filter) => {
      const value = current[filter.name];
      return value && value !== "all";
    });

  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between",
        pending && "opacity-70",
      )}
    >
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search });
          }}
          className="relative w-full sm:max-w-xs"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-9"
            aria-label={searchPlaceholder}
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <Select
              key={filter.name}
              value={current[filter.name] ?? "all"}
              onChange={(event) => apply({ [filter.name]: event.target.value })}
              className="h-9 w-auto min-w-[150px] text-[13px]"
              aria-label={filter.label}
            >
              <option value="all">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ))}

          {dateRange ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2 py-1 shadow-sm">
              <input
                type="date"
                value={current.from ?? ""}
                onChange={(event) => apply({ from: event.target.value || undefined })}
                className="h-7 rounded-md border-0 bg-transparent text-xs text-ink-700 outline-none"
                aria-label="Эхлэх огноо"
              />
              <span className="text-ink-300">—</span>
              <input
                type="date"
                value={current.to ?? ""}
                onChange={(event) => apply({ to: event.target.value || undefined })}
                className="h-7 rounded-md border-0 bg-transparent text-xs text-ink-700 outline-none"
                aria-label="Дуусах огноо"
              />
            </div>
          ) : null}

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                startTransition(() => router.push(basePath));
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Цэвэрлэх
            </button>
          ) : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
