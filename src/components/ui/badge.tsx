import { cn } from "@/lib/utils";
import { TONE_STYLES } from "@/lib/labels";

type Tone = keyof typeof TONE_STYLES;

export function Badge({
  tone = "neutral",
  children,
  dot,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset",
        TONE_STYLES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

export function BadgeGroup({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex flex-wrap gap-1.5">{children}</span>;
}
