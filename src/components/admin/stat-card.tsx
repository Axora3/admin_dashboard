import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

const ACCENTS = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-600",
  neutral: "bg-ink-100 text-ink-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  accent = "brand",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  trend?: number;
  accent?: keyof typeof ACCENTS;
  className?: string;
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition-shadow hover:shadow-raised",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              ACCENTS[accent],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink-950">
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-2xs font-semibold",
              positive ? "text-success-600" : "text-danger-600",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {formatPercent(trend)}
          </span>
        ) : null}
        {hint ? <span className="text-2xs text-ink-400">{hint}</span> : null}
      </div>
    </div>
  );
}
