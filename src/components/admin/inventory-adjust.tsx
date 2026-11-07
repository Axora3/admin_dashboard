"use client";

import { useActionState, useState } from "react";
import { Boxes, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { Product } from "@/lib/types";
import { adjustStockAction } from "@/app/admin/actions/inventory";
import { INVENTORY_REASONS } from "@/lib/labels";
import { Alert } from "@/components/admin/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export function InventoryAdjustButton({
  product,
  back,
}: {
  product: Product;
  back: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(adjustStockAction, undefined);
  const errors = state?.errors ?? {};

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses("secondary", "sm")}
      >
        <Boxes className="h-3.5 w-3.5" /> Засварлах
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Үлдэгдэл засах"
        description={`${product.name} · одоогийн үлдэгдэл ${product.stock} ш`}
        size="sm"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="back" value={back} />
          {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

          <div className="rounded-xl bg-surface-muted/70 p-3 text-[13px] text-ink-600">
            <div className="flex items-center justify-between">
              <span>Одоогийн үлдэгдэл</span>
              <Badge tone="neutral">{product.stock} ш</Badge>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>SKU</span>
              <span className="font-mono text-2xs text-ink-500">
                {product.sku || "—"}
              </span>
            </div>
          </div>

          <Field
            label="Өөрчлөлт (+/-)"
            htmlFor="changeAmount"
            error={errors.changeAmount}
            hint="Нэмэх бол эерэг, хасах бол сөрөг тоо. Жишээ: 10 эсвэл -3"
            required
          >
            <Input
              id="changeAmount"
              name="changeAmount"
              type="number"
              step={1}
              defaultValue={1}
              required
            />
          </Field>

          <Field label="Шалтгаан" htmlFor="reason" error={errors.reason} required>
            <Select id="reason" name="reason" defaultValue={INVENTORY_REASONS[0]}>
              {INVENTORY_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Тэмдэглэл" htmlFor="note" error={errors.note}>
            <Textarea id="note" name="note" placeholder="Нэмэлт тайлбар…" />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonClasses("secondary", "md")}
            >
              Цуцлах
            </button>
            <Button type="submit" size="md" loading={pending}>
              <Plus className="h-4 w-4" /> Үлдэгдэл хадгалах
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
