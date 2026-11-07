"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import {
  isLocalAuthMode,
  sheetsMode,
  SUPABASE_SERVICE_ROLE_KEY,
} from "@/lib/config";
import { clearAllLocalData } from "@/lib/google/sheet-backend";
import {
  DEFAULT_COLUMNS,
  DEFAULT_TABS,
  extractSpreadsheetId,
  spreadsheetUrl,
  type StoreSheetColumns,
  type StoreSheetTabs,
  type StoreSheetsInput,
} from "@/lib/google/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { formObject, storeSchema, zodErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";
import type { StoreStatus } from "@/lib/types";
import { manageAdminAction } from "./admins";

const STATUS_ACTIONS: Record<StoreStatus, string> = {
  active: "store.activated",
  suspended: "store.suspended",
  archived: "store.archived",
};

function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Reads the Google Sheets connection fields emitted by <GoogleSheetsFields />.
 * Returns undefined when the form did not include any Sheets configuration so
 * local-mode stores can still be created without a spreadsheet.
 */
function sheetsInputFromForm(formData: FormData): StoreSheetsInput | undefined {
  const url = String(formData.get("spreadsheetUrl") ?? "").trim();
  const rawId = String(formData.get("spreadsheetId") ?? "").trim();
  const tabsRaw = String(formData.get("sheetTabs") ?? "").trim();
  const columnsRaw = String(formData.get("sheetColumns") ?? "").trim();
  if (!url && !rawId && !tabsRaw && !columnsRaw) return undefined;

  const spreadsheetId = extractSpreadsheetId(rawId || url);
  const tabs = {
    ...DEFAULT_TABS,
    ...parseJson<Partial<StoreSheetTabs>>(tabsRaw, {}),
  };
  const columns = {
    ...DEFAULT_COLUMNS,
    ...parseJson<Partial<StoreSheetColumns>>(columnsRaw, {}),
  };
  return {
    spreadsheetId,
    spreadsheetUrl: url || spreadsheetUrl(spreadsheetId),
    tabs,
    columns,
  };
}

export async function createStoreAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsed = storeSchema.safeParse({
    ...formObject(formData),
    domainIsPrimary: formData.get("domainIsPrimary") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;
  const sheets = sheetsInputFromForm(formData);

  let storeId: string;
  try {
    const store = await getRepository().createStore({
      storeId: String(formData.get("storeId") ?? "").trim() || undefined,
      name: values.name,
      slug: values.slug,
      businessType: values.businessType,
      description: values.description,
      logoUrl: values.logoUrl || null,
      phone: values.phone,
      email: values.email,
      address: values.address,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail,
      ownerPhone: values.ownerPhone,
      domain: values.domain,
      domainIsPrimary: values.domainIsPrimary,
      status: values.status,
      currency: values.currency,
      language: values.language,
      theme: values.theme,
      sheets,
    });
    storeId = store.id;
    await recordAudit(admin, {
      storeId,
      action: "store.created",
      resourceType: "store",
      resourceId: storeId,
      metadata: { name: values.name, domain: values.domain || null },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/stores");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/domains");
  if (!isLocalAuthMode()) {
    const account = new FormData();
    account.set("operation", "create");
    account.set("email", values.ownerEmail);
    account.set("name", values.ownerName);
    account.set("storeId", storeId);
    const result = await manageAdminAction(undefined, account);
    if (!result.ok) redirect(`/admin/admins?notice=${encodeURIComponent(`Дэлгүүр үүссэн. ${result.message ?? "Admin үүсгэлтийг шалгана уу."}`)}`);
  }
  redirect(`/admin/stores/${storeId}?created=1`);
}

export async function updateStoreAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return { ok: false, message: "Дэлгүүр тодорхойгүй байна." };

  const parsed = storeSchema.safeParse({
    ...formObject(formData),
    domainIsPrimary: formData.get("domainIsPrimary") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;
  const sheets = sheetsInputFromForm(formData);

  try {
    await getRepository().updateStore(storeId, {
      name: values.name,
      slug: values.slug || undefined,
      businessType: values.businessType,
      description: values.description,
      logoUrl: values.logoUrl || null,
      phone: values.phone,
      email: values.email,
      address: values.address,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail,
      ownerPhone: values.ownerPhone,
      domain: values.domain,
      status: values.status,
      currency: values.currency,
      language: values.language,
      theme: values.theme,
      sheets,
    });
    await recordAudit(admin, {
      storeId,
      action: "store.updated",
      resourceType: "store",
      resourceId: storeId,
      metadata: { name: values.name, sheetsUpdated: Boolean(sheets) },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${storeId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(`/admin/stores/${storeId}?updated=1`);
}

export async function updateStoreSheetsAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) return { ok: false, message: "Дэлгүүр тодорхойгүй байна." };
  const sheets = sheetsInputFromForm(formData);
  if (!sheets) {
    return { ok: false, message: "Google Sheets тохиргоо олдсонгүй." };
  }
  try {
    const store = await getRepository().updateStoreSheets(storeId, sheets);
    if (store.sheets.connectionStatus === "error") {
      return {
        ok: false,
        message:
          store.sheets.lastError ??
          "Google Sheets холболт шалгахад алдаа гарлаа.",
      };
    }
    await recordAudit(admin, {
      storeId,
      action: "store.sheets_updated",
      resourceType: "store",
      resourceId: storeId,
      metadata: { connectionStatus: store.sheets.connectionStatus },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/admin/stores/${storeId}`);
  revalidatePath("/admin/stores");
  redirect(`/admin/stores/${storeId}?sheets=1`);
}

export async function setStoreStatusAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  const status = String(formData.get("status") ?? "") as StoreStatus;
  const next = String(formData.get("next") ?? `/admin/stores/${storeId}`);
  if (!storeId || !["active", "suspended", "archived"].includes(status)) {
    redirect("/admin/stores");
  }
  await getRepository().setStoreStatus(storeId, status);
  await recordAudit(admin, {
    storeId,
    action: STATUS_ACTIONS[status],
    resourceType: "store",
    resourceId: storeId,
    metadata: { status },
  });
  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${storeId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(next.startsWith("/admin") ? next : "/admin/stores");
}

export async function deleteStoreAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId) redirect("/admin/stores");
  const store = await getRepository().getStore(storeId);
  await getRepository().deleteStore(storeId);
  await recordAudit(admin, {
    storeId: null,
    action: "store.deleted",
    resourceType: "store",
    resourceId: storeId,
    metadata: { name: store?.name ?? null },
  });
  revalidatePath("/admin/stores");
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect("/admin/stores?deleted=1");
}

export async function inviteStoreOwnerAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const storeId = String(formData.get("storeId") ?? "");
  const store = await getRepository().getStore(storeId);
  if (!store) redirect("/admin/stores");

  if (isLocalAuthMode()) {
    await recordAudit(admin, {
      storeId,
      action: "store.owner_invite_simulated",
      resourceType: "store_member",
      resourceId: storeId,
      metadata: { email: store.ownerEmail, mode: "local" },
    });
    redirect(`/admin/stores/${storeId}?invite=local`);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    redirect(`/admin/stores/${storeId}?invite=unconfigured`);
  }

  let inviteFailed = false;
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.auth.admin.inviteUserByEmail(store.ownerEmail, {
      data: { full_name: store.ownerName, invited_store_id: storeId },
    });
    if (error) throw new Error(error.message);
    await service
      .from("store_members")
      .update({ status: "invited" })
      .eq("store_id", storeId)
      .eq("email", store.ownerEmail);
    await recordAudit(admin, {
      storeId,
      action: "store.owner_invited",
      resourceType: "store_member",
      resourceId: storeId,
      metadata: { email: store.ownerEmail },
    });
  } catch {
    inviteFailed = true;
  }
  revalidatePath(`/admin/stores/${storeId}`);
  redirect(`/admin/stores/${storeId}?invite=${inviteFailed ? "failed" : "sent"}`);
}

/**
 * Clears the local file emulator (registry, emulated sheets and platform audit
 * logs). Only available when no Google credentials are configured, because in
 * Google mode the spreadsheets are the source of truth and must never be
 * wiped from the dashboard.
 */
export async function resetLocalDataAction(): Promise<void> {
  if (sheetsMode() !== "local") redirect("/admin/settings");
  await requireSuperAdmin();
  await clearAllLocalData();
  revalidatePath("/", "layout");
  redirect("/admin/dashboard?reset=1");
}

/** @deprecated Use resetLocalDataAction(). */
export const resetDemoDataAction = resetLocalDataAction;
