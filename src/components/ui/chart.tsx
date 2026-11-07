import type { SeriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const WIDTH = 600;
const HEIGHT = 200;
const PADDING_TOP = 12;

export function AreaChart({
  data,
  color = "#3562F5",
  height = 210,
  className,
  valueLabel,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  className?: string;
  valueLabel?: (value: number) => string;
}) {
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const n = data.length;
  const usableHeight = HEIGHT - PADDING_TOP;
  const points = data.map((point, index) => {
    const x = n <= 1 ? WIDTH / 2 : (index / (n - 1)) * WIDTH;
    const y = PADDING_TOP + usableHeight - (point.value / max) * usableHeight;
    return { x, y, ...point };
  });
  const line = points
    .map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;
  const gradientId = `area-${color.replace("#", "")}`;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Борлуулалтын график"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={WIDTH}
            y1={PADDING_TOP + usableHeight * ratio}
            y2={PADDING_TOP + usableHeight * ratio}
            stroke="#E6EAF0"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, index) => (
          <circle
            key={index}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#fff"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${p.label}: ${valueLabel ? valueLabel(p.value) : p.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-0.5 text-2xs text-ink-400">
        {data.map((point, index) => (
          <span key={index}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  color = "#3562F5",
  height = 160,
  className,
  valueLabel,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  className?: string;
  valueLabel?: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((point, index) => {
          const ratio = point.value / max;
          return (
            <div key={index} className="group flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80"
                style={{
                  height: `${Math.max(ratio * 100, point.value > 0 ? 6 : 2)}%`,
                  backgroundColor: point.value > 0 ? color : "#E6EAF0",
                }}
                title={`${point.label}: ${valueLabel ? valueLabel(point.value) : point.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-2xs text-ink-400">
        {data.map((point, index) => (
          <span key={index} className="flex-1 truncate text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  color = "#3562F5",
  className,
}: {
  data: number[];
  color?: string;
  className?: string;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const n = data.length;
  const points = data
    .map((value, index) => {
      const x = n <= 1 ? 50 : (index / (n - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ProgressBar({
  value,
  max,
  color = "#3562F5",
  className,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${ratio * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}
