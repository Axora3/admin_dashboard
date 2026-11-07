import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function DemoStoreBar() {
  return (
    <div className="border-b border-warning-100 bg-warning-50 text-warning-700">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide">
          <FlaskConical className="h-3 w-3" /> Demo дэлгүүр
        </span>
        <span>
          Бүх бараа, захиалга түр санах ойд хадгалагдана. Бодит төлбөр авагдахгүй.
        </span>
        <Link
          href="/admin/dashboard"
          className="ml-auto font-semibold underline underline-offset-2 hover:text-warning-800"
        >
          Admin руу →
        </Link>
      </div>
    </div>
  );
}
