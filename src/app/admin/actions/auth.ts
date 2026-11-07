"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_COOKIE,
  DEMO_SESSION_TTL_SECONDS,
  isDemoMode,
} from "@/lib/config";
import { getDemoAdminName, getDemoPassword, safeEqual } from "@/lib/auth/demo-credentials";
import { signSession } from "@/lib/auth/session";
import { getCurrentAdmin, requireSuperAdmin } from "@/lib/auth/server";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/data";
import { recordAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";

function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//")
    ? next
    : "/admin/dashboard";
}

export async function loginAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    };
  }

  const email = parsed.data.email.trim();
  const password = parsed.data.password;
  const ip = await clientIp();

  const ipLimit = rateLimit(`login:ip:${ip}`, 12, 5 * 60_000);
  if (!ipLimit.allowed) {
    return {
      ok: false,
      message: `Хэт олон оролдлого. ${ipLimit.retryAfterSeconds} секундын дараа дахин оролдоно уу.`,
    };
  }
  const accountLimit = rateLimit(`login:account:${ip}:${email.toLowerCase()}`, 5, 5 * 60_000);
  if (!accountLimit.allowed) {
    return {
      ok: false,
      message: `Хэт олон оролдлого. ${accountLimit.retryAfterSeconds} секундын дараа дахин оролдоно уу.`,
    };
  }

  const next = safeNext(formData.get("next"));

  if (isDemoMode()) {
    const emailMatches = safeEqual(
      email.toLowerCase(),
      DEMO_ADMIN_EMAIL.toLowerCase(),
    );
    const passwordMatches = safeEqual(password, getDemoPassword());
    if (!emailMatches || !passwordMatches) {
      return {
        ok: false,
        message: "Имэйл эсвэл нууц үг буруу байна.",
      };
    }

    const payload = {
      sub: "demo-super-admin",
      email: DEMO_ADMIN_EMAIL,
      name: getDemoAdminName(),
      role: "super_admin" as const,
      exp: Math.floor(Date.now() / 1000) + DEMO_SESSION_TTL_SECONDS,
    };
    const token = await signSession(payload);
    const cookieStore = await cookies();
    cookieStore.set(DEMO_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEMO_SESSION_TTL_SECONDS,
    });
    resetRateLimit(`login:account:${ip}:${email.toLowerCase()}`);
    await recordAudit(
      { id: payload.sub, email: payload.email, fullName: payload.name },
      {
        action: "auth.login",
        resourceType: "session",
        resourceId: null,
        metadata: { mode: "demo" },
      },
    );
    redirect(next);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return { ok: false, message: "Имэйл эсвэл нууц үг буруу байна." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, full_name, email")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      await supabase.auth.signOut();
      return {
        ok: false,
        message: "Энэ аккаунтад AXORA Super Admin эрх байхгүй байна.",
      };
    }

    resetRateLimit(`login:account:${ip}:${email.toLowerCase()}`);
    const admin = await getCurrentAdmin();
    if (admin) {
      await recordAudit(admin, {
        action: "auth.login",
        resourceType: "session",
        resourceId: null,
        metadata: {},
      });
    }
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_COOKIE);
  } else {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

export async function selectStoreAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "all");
  const next = safeNext(formData.get("next"));

  const cookieStore = await cookies();
  if (storeId === "all") {
    cookieStore.set("axora_store_context", "all", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    const store = await getRepository().getStore(storeId);
    if (!store) redirect(next);
    cookieStore.set("axora_store_context", store.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  revalidatePath("/", "layout");
  redirect(next);
}
