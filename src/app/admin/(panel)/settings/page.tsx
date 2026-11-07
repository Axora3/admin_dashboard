import { cookies } from "next/headers";
import {
  BellRing,
  Database,
  FlaskConical,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/server";
import {
  ADMIN_HOST,
  PLATFORM_BASE_DOMAIN,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/config";
import { resetDemoDataAction } from "@/app/admin/actions/stores";
import { updateNotificationPreferencesAction } from "@/app/admin/actions/settings";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { ProfileForm, PasswordForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Switch } from "@/components/ui/input";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Системийн тохиргоо" };

const DEFAULT_PREFERENCES = {
  newOrders: true,
  newStores: true,
  domainIssues: true,
  lowStock: true,
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireSuperAdmin();
  const query = await searchParams;
  const demo = isDemoMode();

  const cookieValue = (await cookies()).get("axora_notifications")?.value;
  let preferences = DEFAULT_PREFERENCES;
  if (cookieValue) {
    try {
      const parsed = JSON.parse(cookieValue) as Partial<typeof DEFAULT_PREFERENCES>;
      preferences = { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      preferences = DEFAULT_PREFERENCES;
    }
  }

  return (
    <>
      <PageHeader
        title="Системийн тохиргоо"
        description="Super Admin профайл, нууц үг, мэдэгдэл болон платформын төлөв."
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={demo ? "warning" : "success"} dot>
              {demo ? "Demo горим" : "Production (Supabase)"}
            </Badge>
            <Badge tone="neutral">{ADMIN_HOST}</Badge>
          </div>
        }
      />

      {str(query.notifications) === "1" ? (
        <Alert variant="success" className="mb-4">
          Мэдэгдлийн тохиргоо хадгалагдлаа.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Super Admin профайл"
            description="Нэр болон бүртгэлийн мэдээлэл."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <UserRound className="h-4 w-4" />
              </span>
            }
          />
          <CardContent>
            <ProfileForm admin={admin} />
          </CardContent>
        </Card>

        <Card id="security">
          <CardHeader
            title="Нууц үг солих"
            description="Аюулгүй байдлын шаардлага хангасан нууц үг."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
                <KeyRound className="h-4 w-4" />
              </span>
            }
          />
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Мэдэгдэл"
            description="Admin header-ийн мэдэгдлийн сонголт."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-info-50 text-info-600">
                <BellRing className="h-4 w-4" />
              </span>
            }
          />
          <CardContent>
            <form action={updateNotificationPreferencesAction} className="space-y-2">
              <Switch
                name="newOrders"
                checked={preferences.newOrders}
                label="Шинэ захиалга"
                description="Шинэ захиалга ирэхэд мэдэгдэнэ."
              />
              <Switch
                name="newStores"
                checked={preferences.newStores}
                label="Шинэ дэлгүүр"
                description="Шинэ дэлгүүр бүртгэгдэхэд мэдэгдэнэ."
              />
              <Switch
                name="domainIssues"
                checked={preferences.domainIssues}
                label="Домэйны асуудал"
                description="DNS эсвэл SSL алдаа гарвал мэдэгдэнэ."
              />
              <Switch
                name="lowStock"
                checked={preferences.lowStock}
                label="Бага үлдэгдэл"
                description="Үлдэгдэл 5-аас доош болоход мэдэгдэнэ."
              />
              <button
                type="submit"
                className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-brand-600 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
              >
                Мэдэгдэл хадгалах
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Платформын төлөв"
            description="Одоогийн орчин ба өгөгдлийн сан."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                <Database className="h-4 w-4" />
              </span>
            }
          />
          <CardContent className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-3 border-b border-ink-50 pb-2">
              <span className="text-ink-500">Өгөгдлийн эх сурвалж</span>
              <Badge tone={demo ? "warning" : "success"}>
                {demo ? "In-memory demo" : "Supabase Postgres"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-ink-50 pb-2">
              <span className="text-ink-500">Supabase тохиргоо</span>
              <Badge tone={isSupabaseConfigured() ? "success" : "warning"}>
                {isSupabaseConfigured() ? "Холбогдсон" : "Тохируулаагүй"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-ink-50 pb-2">
              <span className="text-ink-500">Admin host</span>
              <span className="font-mono text-2xs text-ink-700">{ADMIN_HOST}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-ink-50 pb-2">
              <span className="text-ink-500">Платформын домэйн</span>
              <span className="font-mono text-2xs text-ink-700">
                {PLATFORM_BASE_DOMAIN}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-500">Admin ID</span>
              <span className="max-w-[180px] truncate font-mono text-2xs text-ink-700">
                {admin.id}
              </span>
            </div>
            <p className="rounded-xl bg-surface-muted/70 p-3 text-2xs leading-relaxed text-ink-500">
              Production-д RLS бүхий Supabase, service role зөвхөн серверт,
              HTTP-only session cookie болон audit log ашиглагдана.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Аюулгүй байдлын бодлого"
            description="Платформын хамгаалалтын үндсэн зарчим."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success-50 text-success-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
            }
          />
          <CardContent>
            <ul className="space-y-2 text-[13px] leading-relaxed text-ink-600">
              {[
                "Нууц үг plaintext хэзээ ч хадгалагдахгүй — Supabase Auth ашиглана.",
                "Session HTTP-only, SameSite=Lax cookie-д хадгалагдана.",
                "Бүх admin хуудас болон action requireSuperAdmin()-ээр хамгаалагдсан.",
                "IDOR-оос сэргийлж store_id сервер талд шалгагдана.",
                "Зураг upload-д төрөл, хэмжээ шалгаж, service role-оор хадгална.",
                "Нэвтрэх оролдлого rate limit-тэй (production-д shared store шаардлагатай).",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Demo өгөгдөл"
            description="Зөвхөн demo горимд харагдана."
            action={
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
                <FlaskConical className="h-4 w-4" />
              </span>
            }
          />
          <CardContent className="space-y-3">
            {demo ? (
              <>
                <p className="text-[13px] leading-relaxed text-ink-600">
                  Бүх demo өгөгдөл санах ойд хадгалагдана. Reset хийвэл анхны
                  seeded өгөгдөл сэргээгдэнэ. Энэ нь production өгөгдөлд хэзээ ч
                  нөлөөлөхгүй.
                </p>
                <form action={resetDemoDataAction}>
                  <ConfirmSubmit
                    message="Demo өгөгдлийг анхны төлөвт сэргээх үү? Одоогийн өөрчлөлтүүд устана."
                    variant="danger"
                    size="md"
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4" /> Demo өгөгдөл reset
                  </ConfirmSubmit>
                </form>
              </>
            ) : (
              <Alert variant="success">
                Production горим идэвхтэй. Demo reset боломжгүй.
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
