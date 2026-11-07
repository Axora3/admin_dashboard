"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import {
  DEMO_COOKIE,
  DEMO_SESSION_TTL_SECONDS,
  isDemoMode,
} from "@/lib/config";
import {
  getDemoPassword,
  safeEqual,
  setDemoAdminName,
  setDemoPassword,
} from "@/lib/auth/demo-credentials";
import { signSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formObject,
  passwordSchema,
  profileSchema,
  storeSettingsSchema,
  zodErrors,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";

export async function updateStoreSettingsAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = storeSettingsSchema.safeParse({
    ...formObject(formData),
    shippingEnabled: formData.get("shippingEnabled") === "on",
    codEnabled: formData.get("codEnabled") === "on",
    bankTransferEnabled: formData.get("bankTransferEnabled") === "on",
    published: formData.get("published") === "on",
    showOutOfStock: formData.get("showOutOfStock") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;

  try {
    const repository = getRepository();
    const current = await repository.getStoreSettings(values.storeId);
    await repository.updateStore(values.storeId, {
      name: values.name,
      logoUrl: values.logoUrl || null,
      description: values.description,
      phone: values.phone,
      email: values.email,
      address: values.address,
      currency: values.currency,
      language: values.language,
      theme: values.theme,
    });
    await repository.updateStoreSettings(values.storeId, {
      social: { facebook: values.facebook, instagram: values.instagram },
      theme: { ...current.theme, style: values.theme },
      shipping: {
        enabled: values.shippingEnabled,
        flatRate: values.shippingFlatRate,
        freeOver: values.shippingFreeOver,
        note: values.shippingNote,
      },
      payment: {
        codEnabled: values.codEnabled,
        bankTransferEnabled: values.bankTransferEnabled,
        bankAccount: values.bankAccount,
        note: values.paymentNote,
      },
      visibility: {
        published: values.published,
        showOutOfStock: values.showOutOfStock,
      },
    });
    await recordAudit(admin, {
      storeId: values.storeId,
      action: "store.settings_updated",
      resourceType: "store_settings",
      resourceId: values.storeId,
      metadata: { name: values.name, published: values.published },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath(`/admin/stores/${values.storeId}/settings`);
  revalidatePath(`/admin/stores/${values.storeId}`);
  revalidatePath("/admin/stores");
  revalidatePath("/", "layout");
  redirect(`/admin/stores/${values.storeId}/settings?saved=1`);
}

export async function updateProfileAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = profileSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const fullName = parsed.data.fullName;

  try {
    if (isDemoMode()) {
      setDemoAdminName(fullName);
      const token = await signSession({
        sub: admin.id,
        email: admin.email,
        name: fullName,
        role: "super_admin",
        exp: Math.floor(Date.now() / 1000) + DEMO_SESSION_TTL_SECONDS,
      });
      (await cookies()).set(DEMO_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEMO_SESSION_TTL_SECONDS,
      });
    } else {
      const supabase = await createSupabaseServerClient();
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (authError) throw new Error(authError.message);
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", admin.id);
      if (error) throw new Error(error.message);
    }
    await recordAudit(admin, {
      action: "admin.profile_updated",
      resourceType: "profile",
      resourceId: admin.id,
      metadata: { fullName },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Профайл амжилттай шинэчлэгдлээ." };
}

export async function changePasswordAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = passwordSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;

  try {
    if (isDemoMode()) {
      if (!safeEqual(values.currentPassword, getDemoPassword())) {
        return {
          ok: false,
          errors: { currentPassword: "Одоогийн нууц үг буруу байна." },
        };
      }
      setDemoPassword(values.newPassword);
    } else {
      const supabase = await createSupabaseServerClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: admin.email,
        password: values.currentPassword,
      });
      if (signInError) {
        return {
          ok: false,
          errors: { currentPassword: "Одоогийн нууц үг буруу байна." },
        };
      }
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });
      if (error) throw new Error(error.message);
    }
    await recordAudit(admin, {
      action: "admin.password_changed",
      resourceType: "profile",
      resourceId: admin.id,
      metadata: {},
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  return { ok: true, message: "Нууц үг амжилттай шинэчлэгдлээ." };
}

export async function updateNotificationPreferencesAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin();
  const preferences = {
    newOrders: formData.get("newOrders") === "on",
    newStores: formData.get("newStores") === "on",
    domainIssues: formData.get("domainIssues") === "on",
    lowStock: formData.get("lowStock") === "on",
  };
  (await cookies()).set("axora_notifications", JSON.stringify(preferences), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin/settings");
  redirect("/admin/settings?notifications=1");
}
