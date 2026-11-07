"use client";

import { useActionState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { AdminUser } from "@/lib/types";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/app/admin/actions/settings";
import { Alert } from "@/components/admin/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ProfileForm({ admin }: { admin: AdminUser }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state?.message ? (
        <Alert variant={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <div className="flex items-center gap-3">
        <Avatar name={admin.fullName} src={admin.avatarUrl} size="lg" />
        <div>
          <p className="text-[13px] font-semibold text-ink-900">{admin.fullName}</p>
          <p className="text-2xs text-ink-400">{admin.email} · Super Admin</p>
        </div>
      </div>
      <Field label="Бүтэн нэр" htmlFor="fullName" error={errors.fullName} required>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            id="fullName"
            name="fullName"
            defaultValue={admin.fullName}
            className="pl-9"
            required
          />
        </div>
      </Field>
      <Field label="Имэйл" htmlFor="profile-email" hint="Имэйлийг Supabase Auth-аар удирдана.">
        <Input id="profile-email" value={admin.email} disabled />
      </Field>
      <Button type="submit" size="md" loading={pending}>
        Профайл хадгалах
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state?.message ? (
        <Alert variant={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}
      <Field
        label="Одоогийн нууц үг"
        htmlFor="currentPassword"
        error={errors.currentPassword}
        required
      >
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className="pl-9"
            required
          />
        </div>
      </Field>
      <Field
        label="Шинэ нууц үг"
        htmlFor="newPassword"
        error={errors.newPassword}
        hint="8+ тэмдэгт, үсэг болон тоо агуулсан."
        required
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Field
        label="Шинэ нууц үг давтах"
        htmlFor="confirmPassword"
        error={errors.confirmPassword}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <Button type="submit" size="md" loading={pending}>
        Нууц үг солих
      </Button>
    </form>
  );
}
