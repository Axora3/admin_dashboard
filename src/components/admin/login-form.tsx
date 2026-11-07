"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/admin/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/admin/alert";

export function LoginForm({
  next,
  demoEmail,
  demoPassword,
  isDemo,
  notice,
}: {
  next: string;
  demoEmail: string;
  demoPassword: string;
  isDemo: boolean;
  notice?: string | null;
}) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {notice ? <Alert variant="info">{notice}</Alert> : null}
      {state?.message ? <Alert variant="danger">{state.message}</Alert> : null}

      <div>
        <label htmlFor="email" className="axora-label">
          Имэйл
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            autoFocus
            required
            placeholder="admin@axora.mn"
            className="h-11 pl-9"
            aria-invalid={Boolean(state?.errors?.email)}
          />
        </div>
        {state?.errors?.email ? (
          <p className="mt-1.5 text-xs text-danger-600">{state.errors.email}</p>
        ) : null}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-[13px] font-medium text-ink-700">
            Нууц үг
          </label>
          <Link
            href="/admin/login?forgot=1"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Нууц үг мартсан?
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 pl-9 pr-10"
            aria-invalid={Boolean(state?.errors?.password)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харуулах"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state?.errors?.password ? (
          <p className="mt-1.5 text-xs text-danger-600">{state.errors.password}</p>
        ) : null}
      </div>

      <input type="hidden" name="next" value={next} />

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Нэвтрэх
      </Button>

      {isDemo ? (
        <div className="rounded-xl border border-dashed border-ink-200 bg-surface-muted/70 px-3.5 py-3 text-xs leading-relaxed text-ink-500">
          <p className="font-semibold text-ink-700">Demo горим</p>
          <p className="mt-0.5">
            Имэйл: <b>{demoEmail}</b>
            <br />
            Нууц үг: <b>{demoPassword}</b>
          </p>
          <p className="mt-1.5 text-2xs text-ink-400">
            Supabase тохируулсны дараа энэ мэдээлэл автоматаар нуугдана.
          </p>
        </div>
      ) : null}
    </form>
  );
}
