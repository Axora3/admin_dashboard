import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  info: {
    wrap: "border-info-100 bg-info-50/70 text-info-700",
    icon: Info,
  },
  success: {
    wrap: "border-success-100 bg-success-50/70 text-success-700",
    icon: CheckCircle2,
  },
  warning: {
    wrap: "border-warning-100 bg-warning-50/70 text-warning-700",
    icon: TriangleAlert,
  },
  danger: {
    wrap: "border-danger-100 bg-danger-50/70 text-danger-700",
    icon: AlertCircle,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  action,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const config = VARIANTS[variant];
  const Icon = config.icon;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed",
        config.wrap,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
