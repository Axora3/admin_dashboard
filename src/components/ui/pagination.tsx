import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "./button";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  basePath,
  query,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function href(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value && value !== "all" && key !== "page") params.set(key, value);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

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
    <div className="flex flex-col gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-ink-500">
        <span className="font-medium text-ink-700">
          {start}–{end}
        </span>{" "}
        / {total} бичлэг
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={href(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            buttonClasses("secondary", "sm", "px-2"),
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pages.map((item, index) =>
          item === "…" ? (
            <span key={`gap-${index}`} className="px-1.5 text-xs text-ink-400">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={href(item)}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
                item === page
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-100",
              )}
            >
              {item}
            </Link>
          ),
        )}
        <Link
          href={href(Math.min(pageCount, page + 1))}
          aria-disabled={page >= pageCount}
          className={cn(
            buttonClasses("secondary", "sm", "px-2"),
            page >= pageCount && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
