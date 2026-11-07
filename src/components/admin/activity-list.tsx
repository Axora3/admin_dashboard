import Link from "next/link";
import {
  Boxes,
  Globe,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
} from "lucide-react";
import type { AuditLog } from "@/lib/types";
import { auditActionLabel } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

function iconFor(action: string) {
  if (action.startsWith("order")) return ShoppingCart;
  if (action.startsWith("product")) return Package;
  if (action.startsWith("domain")) return Globe;
  if (action.startsWith("inventory")) return Boxes;
  if (action.startsWith("store")) return Store;
  return ShieldCheck;
}

export function ActivityList({
  items,
  className,
}: {
  items: AuditLog[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Үйл ажиллагаа бүртгэгдээгүй"
        description="Дэлгүүр, бараа эсвэл захиалга дээр хийсэн үйлдэл энд харагдана."
      />
    );
  }
  return (
    <ul className={cn("divide-y divide-ink-50", className)}>
      {items.map((item) => {
        const Icon = iconFor(item.action);
        return (
          <li key={item.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink-800">
                {auditActionLabel(item.action)}
              </p>
              <p className="mt-0.5 truncate text-2xs text-ink-400">
                {item.storeName ? (
                  <Link
                    href={`/admin/stores/${item.storeId}`}
                    className="font-medium text-ink-500 hover:text-brand-600 hover:underline"
                  >
                    {item.storeName}
                  </Link>
                ) : (
                  "Платформ"
                )}
                {" · "}
                {item.actorName}
                {" · "}
                {relativeTime(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
