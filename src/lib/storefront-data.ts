import { cache } from "react";
import { getRepository } from "@/lib/data";
import type { Store } from "@/lib/types";

/**
 * Request-scoped cache so layout, metadata and the page share one storefront
 * query. It is intentionally not a cross-request cache: store data must stay
 * fresh after admin edits.
 */
export const loadStorefront = cache(async (slug: string) => {
  return getRepository().getStorefront(slug);
});

export function isStoreOpen(store: Store): boolean {
  return store.status === "active" && store.settings.visibility.published;
}

export function effectivePrice(product: { price: number; salePrice: number | null }) {
  return product.salePrice !== null ? product.salePrice : product.price;
}

export function shippingFor(
  subtotal: number,
  shipping: Store["settings"]["shipping"],
): number {
  if (!shipping.enabled) return 0;
  if (shipping.freeOver > 0 && subtotal >= shipping.freeOver) return 0;
  return shipping.flatRate;
}
