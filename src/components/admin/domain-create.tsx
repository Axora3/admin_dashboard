"use client";

import { useActionState, useState } from "react";
import { Globe, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { StoreOption } from "@/lib/data";
import { createDomainAction } from "@/app/admin/actions/domains";
import { Alert } from "@/components/admin/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";

export function DomainCreateButton({
  stores,
  defaultStoreId,
  back,
}: {
  stores: StoreOption[];
  defaultStoreId?: string;
  back: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createDomainAction, undefined);
  const errors = state?.errors ?? {};

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Домэйн нэмэх
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Шинэ домэйн бүртгэх"
        description="Домэйныг DNS-ээр баталгаажуулж, SSL-ийг бодитоор шалгана."
        size="sm"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="back" value={back} />
          {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

          <Field label="Дэлгүүр" htmlFor="domain-store" error={errors.storeId} required>
            <Select
              id="domain-store"
              name="storeId"
              defaultValue={defaultStoreId ?? stores[0]?.id ?? ""}
              required
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Домэйн"
            htmlFor="domain-name"
            error={errors.domain}
            hint="www-гүйгээр оруулна уу. Жишээ: mystore.mn"
            required
          >
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="domain-name"
                name="domain"
                placeholder="mystore.mn"
                className="pl-9"
                required
              />
            </div>
          </Field>

          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input
              type="checkbox"
              name="isPrimary"
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Үндсэн домэйн болгох
          </label>

          <div className="rounded-xl bg-surface-muted/70 p-3 text-2xs leading-relaxed text-ink-500">
            DNS тохиргоо: <code className="font-mono">CNAME → cname.axora.mn</code>{" "}
            эсвэл <code className="font-mono">TXT _axora.домэйн</code> бичлэг.
            Баталгаажуулалтын token нь домэйн бүртгэгдсэний дараа харагдана.
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClasses("secondary", "md")}
            >
              Цуцлах
            </button>
            <Button type="submit" size="md" loading={pending}>
              Домэйн бүртгэх
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
