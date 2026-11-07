import { Clock, Mail, Phone } from "lucide-react";
import type { Store } from "@/lib/types";

export function StoreClosed({ store }: { store: Store }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <Clock className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-950">
        Дэлгүүр түр хаалттай байна
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
        {store.name} дэлгүүр одоогоор худалдан авалт хүлээж авахгүй байна. Дараа
        дахин оролдоно уу.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        {store.phone ? (
          <a
            href={`tel:${store.phone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 font-medium text-ink-700 hover:bg-ink-50"
          >
            <Phone className="h-4 w-4" /> {store.phone}
          </a>
        ) : null}
        {store.email ? (
          <a
            href={`mailto:${store.email}`}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 font-medium text-ink-700 hover:bg-ink-50"
          >
            <Mail className="h-4 w-4" /> {store.email}
          </a>
        ) : null}
      </div>
    </div>
  );
}
