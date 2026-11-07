import { FlaskConical } from "lucide-react";
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, isDemoMode } from "@/lib/config";

export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div className="border-b border-warning-100 bg-warning-50/80">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2 text-2xs text-warning-700 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide">
          <FlaskConical className="h-3 w-3" /> Demo горим
        </span>
        <span className="leading-relaxed">
          Supabase тохируулаагүй тул бүх өгөгдөл түр санах ойд хадгалагдаж байна —
          production өгөгдөл биш. Нэвтрэх: <b>{DEMO_ADMIN_EMAIL}</b> · нууц үг{" "}
          <code className="rounded bg-white/70 px-1">{DEMO_ADMIN_PASSWORD}</code>{" "}
          (өөрчилж болно).
        </span>
        <a
          href="/admin/settings"
          className="font-semibold underline underline-offset-2 hover:text-warning-800"
        >
          Тохиргоо →
        </a>
      </div>
    </div>
  );
}
