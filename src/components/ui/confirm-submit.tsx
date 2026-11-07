"use client";

import { cn } from "@/lib/utils";
import { buttonClasses } from "./button";

export function ConfirmSubmit({
  message,
  children,
  className,
  variant = "secondary",
  size = "sm",
  name,
  value,
  formAction,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg" | "icon";
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={cn(buttonClasses(variant, size), className)}
    >
      {children}
    </button>
  );
}
