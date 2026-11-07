"use client";

import { useEffect, useRef } from "react";

export function SelectAllCheckbox({
  formId,
  name = "ids",
  label = "Бүгдийг сонгох",
}: {
  formId: string;
  name?: string;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const boxes = () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `input[name="${name}"][form="${formId}"]`,
        ),
      );
    const sync = () => {
      const all = boxes();
      input.checked = all.length > 0 && all.every((box) => box.checked);
      input.indeterminate = all.some((box) => box.checked) && !input.checked;
    };
    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.name !== name) return;
      sync();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [formId, name]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      onChange={(event) => {
        const checked = event.target.checked;
        document
          .querySelectorAll<HTMLInputElement>(
            `input[name="${name}"][form="${formId}"]`,
          )
          .forEach((box) => {
            box.checked = checked;
          });
      }}
      className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
    />
  );
}
