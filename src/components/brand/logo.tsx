import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  dark = false,
  compact = false,
  href = "/admin/dashboard",
}: {
  dark?: boolean;
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <span
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold tracking-tight shadow-sm",
          dark ? "bg-white text-ink-950" : "bg-ink-950 text-white",
        )}
      >
        A
        <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-brand-400" />
      </span>
      {!compact ? (
        <span className="leading-none">
          <span
            className={cn(
              "block text-[13px] font-semibold tracking-[0.22em]",
              dark ? "text-white" : "text-ink-950",
            )}
          >
            AXORA
          </span>
          <span
            className={cn(
              "mt-1 block text-[9px] font-medium uppercase tracking-[0.24em]",
              dark ? "text-white/50" : "text-ink-400",
            )}
          >
            Admin Panel
          </span>
        </span>
      ) : null}
    </Link>
  );
}
