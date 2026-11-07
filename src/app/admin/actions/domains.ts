"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";
import { requireSuperAdmin } from "@/lib/auth/server";
import { recordAudit } from "@/lib/audit";
import { getRepository } from "@/lib/data";
import { domainSchema, formObject, zodErrors } from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { messageOf } from "@/lib/errors";

function backPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "");
  return path.startsWith("/admin") && !path.startsWith("//")
    ? path
    : "/admin/domains";
}

async function checkDns(
  domain: string,
  token: string,
  target: string,
): Promise<{ ok: boolean; note: string }> {
  const notes: string[] = [];
  try {
    const records = await resolveTxt(`_axora.${domain}`);
    if (records.some((parts) => parts.join("").includes(token))) {
      return { ok: true, note: `TXT бичлэг баталгаажсан (_axora.${domain})` };
    }
    notes.push("TXT бичлэг таарсангүй");
  } catch {
    notes.push("TXT бичлэг олдсонгүй");
  }
  try {
    const records = await resolveCname(domain);
    if (records.some((value) => value.toLowerCase().replace(/\.$/, "") === target)) {
      return { ok: true, note: `CNAME → ${target}` };
    }
    notes.push(`CNAME (${records.join(", ")}) target-тай таарахгүй`);
  } catch {
    notes.push("CNAME олдсонгүй");
  }
  try {
    const addresses = await resolve4(domain);
    notes.push(`A бичлэг: ${addresses.join(", ")}`);
  } catch {
    notes.push("A бичлэг олдсонгүй");
  }
  return { ok: false, note: notes.join(" · ") };
}

function checkTls(domain: string): Promise<{ ok: boolean; note: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; note: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const socket = tlsConnect(
        { host: domain, port: 443, servername: domain, timeout: 7000 },
        () => {
          const authorized = socket.authorized;
          const certificate = socket.getPeerCertificate();
          socket.end();
          finish({
            ok: authorized,
            note: authorized
              ? `SSL идэвхтэй${certificate?.valid_to ? ` (${certificate.valid_to})` : ""}`
              : "SSL гэрчилгээ баталгаажаагүй",
          });
        },
      );
      socket.on("error", () => finish({ ok: false, note: "TLS холболт амжилтгүй" }));
      socket.on("timeout", () => {
        socket.destroy();
        finish({ ok: false, note: "TLS холболт timeout" });
      });
    } catch {
      finish({ ok: false, note: "TLS шалгалт эхлүүлж чадсангүй" });
    }
  });
}

export async function createDomainAction(
  _previous: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const back = backPath(formData.get("back"));
  const parsed = domainSchema.safeParse({
    ...formObject(formData),
    isPrimary: formData.get("isPrimary") === "on",
  });
  if (!parsed.success) {
    return { ok: false, errors: zodErrors(parsed.error) };
  }
  const values = parsed.data;

  try {
    const domain = await getRepository().createDomain(values);
    await recordAudit(admin, {
      storeId: values.storeId,
      action: "domain.created",
      resourceType: "domain",
      resourceId: domain.id,
      metadata: { domain: domain.domain },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }

  revalidatePath("/admin/domains");
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(back);
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const domainId = String(formData.get("domainId") ?? "");
  const back = backPath(formData.get("back"));
  const domain = await getRepository().getDomain(domainId);
  if (!domain) redirect(back);

  const [dns, tls] = await Promise.all([
    checkDns(domain.domain, domain.verificationToken, domain.expectedTarget),
    checkTls(domain.domain),
  ]);

  const verified = dns.ok;
  const status = verified ? (tls.ok ? "active" : "ssl_pending") : "error";
  await getRepository().updateDomain(domainId, {
    verificationStatus: verified ? "verified" : "failed",
    sslStatus: tls.ok ? "active" : verified ? "provisioning" : "error",
    status,
    lastCheckedAt: new Date().toISOString(),
    verifiedAt: verified ? new Date().toISOString() : null,
  });

  await recordAudit(admin, {
    storeId: domain.storeId,
    action: verified ? "domain.verified" : "domain.verification_failed",
    resourceType: "domain",
    resourceId: domainId,
    metadata: {
      domain: domain.domain,
      dns: dns.note,
      tls: tls.note,
      status,
    },
  });

  revalidatePath("/admin/domains");
  revalidatePath("/admin/dashboard");
  revalidatePath("/", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}checked=${verified ? "ok" : "failed"}`);
}

export async function setPrimaryDomainAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const domainId = String(formData.get("domainId") ?? "");
  const back = backPath(formData.get("back"));
  const domain = await getRepository().getDomain(domainId);
  if (!domain) redirect(back);
  await getRepository().updateDomain(domainId, { isPrimary: true });
  await recordAudit(admin, {
    storeId: domain.storeId,
    action: "domain.primary_changed",
    resourceType: "domain",
    resourceId: domainId,
    metadata: { domain: domain.domain },
  });
  revalidatePath("/admin/domains");
  revalidatePath("/", "layout");
  redirect(back);
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const domainId = String(formData.get("domainId") ?? "");
  const back = backPath(formData.get("back"));
  const domain = await getRepository().getDomain(domainId);
  if (!domain) redirect(back);
  await getRepository().deleteDomain(domainId);
  await recordAudit(admin, {
    storeId: domain.storeId,
    action: "domain.deleted",
    resourceType: "domain",
    resourceId: domainId,
    metadata: { domain: domain.domain },
  });
  revalidatePath("/admin/domains");
  revalidatePath("/", "layout");
  redirect(back);
}
