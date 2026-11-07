import { Badge } from "@/components/ui/badge";
import type { HealthStatus } from "@/lib/platform/health-rules";

const TONES: Record<HealthStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  healthy: "success",
  warning: "warning",
  error: "danger",
  disconnected: "neutral",
  unknown: "info",
};

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Error",
  disconnected: "Disconnected",
  unknown: "Unknown",
};

export function HealthBadge({ status, suffix }: { status: HealthStatus; suffix?: string }) {
  return <Badge tone={TONES[status]} dot>{HEALTH_LABELS[status]}{suffix ? ` · ${suffix}` : ""}</Badge>;
}
