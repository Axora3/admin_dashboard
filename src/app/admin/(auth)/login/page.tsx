import type { Metadata } from "next";
import {
  Boxes,
  Globe,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  isDemoMode,
} from "@/lib/config";
import { BrandMark } from "@/components/brand/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Нэвтрэх",
};

const STORES = [
  { name: "Nomad Fashion", type: "Хувцас", color: "bg-[#C9A227]" },
  { name: "Tech Store", type: "Электроник", color: "bg-brand-500" },
  { name: "Beauty Shop", type: "Гоо сайхан", color: "bg-[#DB2777]" },
  { name: "Coffee Store", type: "Кофе", color: "bg-[#B45309]" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next =
    nextParam.startsWith("/admin") && !nextParam.startsWith("//")
      ? nextParam
      : "/admin/dashboard";
  const demo = isDemoMode();

  const notice =
    params.forgot === "1"
      ? "Store Admin нууц үг сэргээх холбоос авахын тулд Super Admin-тай холбогдоно уу. Super Admin нь платформын хариуцсан инженертэй холбогдоно."
      : params.error === "forbidden"
        ? "Энэ аккаунтад Admin эрх байхгүй байна."
        : null;

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col px-6 py-7 sm:px-10 lg:px-16">
          <BrandMark />
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[380px] py-10">
              <div className="mb-7">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.12em] text-brand-700 ring-1 ring-inset ring-brand-100">
                  <ShieldCheck className="h-3 w-3" /> AXORA Admin
                </span>
                <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink-950">
                  AXORA Admin-д тавтай морил
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Super Admin эсвэл Store Admin эрхээр нэвтэрнэ үү.
                </p>
              </div>

              <LoginForm
                next={next}
                demoEmail={DEMO_ADMIN_EMAIL}
                demoPassword={DEMO_ADMIN_PASSWORD}
                isDemo={demo}
                notice={notice}
              />

              <p className="mt-8 flex items-start gap-2 text-2xs leading-relaxed text-ink-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Нэвтрэх оролдлого хязгаарлагдсан, бүх үйлдэл аудит лог-д бүртгэгдэнэ.
                Нууц мэдээлэл лог-д хэзээ ч бичигдэхгүй.
              </p>
            </div>
          </div>
          <p className="text-2xs text-ink-300">
            © {new Date().getFullYear()} AXORA Platform · admin.axora.mn
          </p>
        </div>

        <div className="relative hidden overflow-hidden bg-ink-950 p-4 lg:block">
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-950 to-[#091426] p-10 text-white">
            <div className="bg-grid absolute inset-0 opacity-[0.35]" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#C9A227]/10 blur-3xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-2xs font-medium uppercase tracking-[0.14em] text-white/70">
                <Sparkles className="h-3 w-3" /> One account · all stores
              </span>
              <h2 className="mt-6 max-w-md text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
                Бүх дэлгүүр.
                <br />
                Нэг хяналт.
                <br />
                <span className="text-white/40">Бүрэн эрх.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
                Бараа, захиалга, хэрэглэгч, үлдэгдэл, домэйн болон public website —
                бүгдийг нэг premium admin платформаас.
              </p>
            </div>

            <div className="relative grid grid-cols-3 gap-2.5">
              {[
                { icon: ShoppingBag, label: "Захиалга", value: "Нэгдсэн" },
                { icon: Boxes, label: "Үлдэгдэл", value: "Бодит цаг" },
                { icon: Globe, label: "Домэйн", value: "Олон" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur"
                >
                  <item.icon className="h-4 w-4 text-white/50" />
                  <p className="mt-2 text-[11px] font-semibold text-white/90">
                    {item.value}
                  </p>
                  <p className="text-[10px] text-white/40">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="relative">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Удирдаж буй дэлгүүрүүд
              </p>
              <div className="space-y-1.5">
                {STORES.map((store) => (
                  <div
                    key={store.name}
                    className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white ${store.color}`}
                    >
                      {store.name.slice(0, 1)}
                    </span>
                    <span className="text-xs font-medium text-white/80">{store.name}</span>
                    <span className="ml-auto text-[10px] text-white/35">{store.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
