"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartLine {
  productId: string;
  name: string;
  slug: string;
  unitPrice: number;
  image: string | null;
  stock: number;
  quantity: number;
}

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  unitPrice: number;
  image: string | null;
  stock: number;
}

interface CartContextValue {
  items: CartLine[];
  ready: boolean;
  count: number;
  subtotal: number;
  addItem: (product: CartProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string) {
  return `axora.cart.v1.${slug}`;
}

function clampQuantity(value: number, max: number) {
  return Math.max(1, Math.min(Math.max(1, max), Math.floor(value)));
}

function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: CartLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const productId = typeof value.productId === "string" ? value.productId : "";
    const quantity = Number(value.quantity);
    const unitPrice = Number(value.unitPrice);
    const stock = Number(value.stock);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    lines.push({
      productId,
      name: typeof value.name === "string" ? value.name : "Бараа",
      slug: typeof value.slug === "string" ? value.slug : "",
      unitPrice: Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0,
      image: typeof value.image === "string" ? value.image : null,
      stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
      quantity: clampQuantity(quantity, Number.isFinite(stock) ? stock : 99),
    });
  }
  return lines;
}

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const key = storageKey(storeSlug);

  useEffect(() => {
    setReady(false);
    try {
      const raw = window.localStorage.getItem(key);
      setItems(raw ? sanitize(JSON.parse(raw)) : []);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // Storage can be unavailable (private mode/quota). The cart still works
      // for the current page view.
    }
  }, [items, key, ready]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== key) return;
      try {
        setItems(event.newValue ? sanitize(JSON.parse(event.newValue)) : []);
      } catch {
        setItems([]);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const addItem = useCallback((product: CartProduct, quantity = 1) => {
    setItems((current) => {
      const max = Math.max(0, Math.floor(product.stock));
      if (max <= 0) return current;
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? {
                ...line,
                name: product.name,
                slug: product.slug,
                unitPrice: product.unitPrice,
                image: product.image,
                stock: max,
                quantity: clampQuantity(line.quantity + quantity, max),
              }
            : line,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          unitPrice: product.unitPrice,
          image: product.image,
          stock: max,
          quantity: clampQuantity(quantity, max),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) {
        return current.filter((line) => line.productId !== productId);
      }
      return current.map((line) =>
        line.productId === productId
          ? { ...line, quantity: clampQuantity(quantity, line.stock || 99) }
          : line,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = items.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    return { items, ready, count, subtotal, addItem, setQuantity, removeItem, clear };
  }, [items, ready, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
