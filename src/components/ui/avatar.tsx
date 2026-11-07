import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

const PALETTE = [
  "bg-brand-50 text-brand-700",
  "bg-success-50 text-success-700",
  "bg-warning-50 text-warning-700",
  "bg-danger-50 text-danger-700",
  "bg-info-50 text-info-700",
  "bg-ink-100 text-ink-700",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % PALETTE.length;

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        PALETTE[hash],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
