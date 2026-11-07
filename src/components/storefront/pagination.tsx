import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StorefrontPagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  if (total === 0 || pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: Array<number | "…"> = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < pageCount - 2) pages.push("…");
    pages.push(pageCount);
  }

  return (
    <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-6 sm:flex-row">
      <p className="text-xs text-ink-500">
        <span className="font-medium text-ink-800">
          {start}–{end}
        </span>{" "}
        / {total} бараа
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={hrefFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pages.map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-ink-400">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition",
                item === page
                  ? "bg-[var(--store-primary)] text-white"
                  : "text-ink-600 hover:bg-ink-100",
              )}
            >
              {item}
            </Link>
          ),
        )}
        <Link
          href={hrefFor(Math.min(pageCount, page + 1))}
          aria-disabled={page >= pageCount}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50",
            page >= pageCount && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
