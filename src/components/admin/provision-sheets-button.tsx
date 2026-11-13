"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sheet } from "lucide-react";
import { provisionSiteSheetsAction } from "@/app/admin/actions/sheets";
import { Button } from "@/components/ui/button";

export function ProvisionSheetsButton({ siteId, status }: { siteId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [attemptKey, setAttemptKey] = useState("");
  const storageKey = `axora-sheet-provision:${siteId}`;

  useEffect(() => {
    try { setAttemptKey(window.localStorage.getItem(storageKey) ?? ""); } catch { /* Storage can be disabled. */ }
  }, [storageKey]);

  if (status === "connected") return null;
  function provision() {
    const key = attemptKey || crypto.randomUUID();
    setAttemptKey(key);
    try { window.localStorage.setItem(storageKey, key); } catch { /* Drive marker still makes retries safe within this page session. */ }
    setMessage("Creating and verifying the customer spreadsheet…");
    startTransition(async () => {
      const result = await provisionSiteSheetsAction({ storeId: siteId, idempotencyKey: key });
      setMessage(result.ok ? "Spreadsheet provisioned and verified." : result.message);
      if (result.ok) {
        try { window.localStorage.removeItem(storageKey); } catch { /* no-op */ }
        router.refresh();
      }
    });
  }

  return <div className="flex flex-col items-end gap-1">
    <Button type="button" variant="secondary" size="md" onClick={provision} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
      {pending ? "Provisioning…" : "Provision Google Sheets"}
    </Button>
    {message ? <span className="max-w-64 text-right text-xs text-ink-500" role="status">{message}</span> : null}
  </div>;
}
