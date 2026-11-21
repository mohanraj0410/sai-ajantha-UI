"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BrandMotionConfig } from "@/components/MotionPrimitives";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PRODUCT_CATEGORIES, type ProductCategory, type ProductItem } from "@/lib/products";
import { getProductSpecData } from "@/lib/productSpecs";

export type UserRole = "CUSTOMER" | "DISTRIBUTOR" | "DEALER" | "ADMIN";
export type ApprovalStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED";
export type EffectivePriceTier = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  businessCity: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface ServerProductPricing {
  id: string;
  sku: string;
  src?: string;
  unitPriceInr: number | null;
  customerPriceInr: number | null;
  billingUnit: string;
  gstRate: number;
  gstMode: string;
  stockQty: number;
  approved: boolean;
}

export interface CartLineItem {
  key: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  image: string;
  finish: string;
  packLabel: string;
  packMultiplier: number;
  unitPriceInr: number | null;
  quantity: number;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipient: string;
  organization: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

interface StoreContextValue {
  cart: CartLineItem[];
  cartCount: number;
  pricedSubtotalInr: number;
  hasQuoteItems: boolean;
  wishlistIds: string[];
  compareIds: string[];
  session: AuthenticatedUser | null;
  authLoading: boolean;
  effectivePriceTier: EffectivePriceTier;
  wholesaleUnlocked: boolean;
  addresses: SavedAddress[];
  cartOpen: boolean;
  deliveryPincode: string;
  setDeliveryPincode: (pin: string) => void;
  toastMessage: string | null;
  setCartOpen: (open: boolean) => void;
  getAuthorizedUnitPrice: (productId: string) => number | null;
  getProductStock: (productId: string) => number | null;
  getProductImage: (productId: string, fallbackSrc: string) => string;
  catalogProducts: ProductItem[];
  catalogCategories: ProductCategory[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogSource: "medusa" | null;
  addToCart: (
    item: ProductItem,
    options?: { finish?: string; packIndex?: number; quantity?: number; openDrawer?: boolean }
  ) => void;
  updateCartQuantity: (key: string, delta: number) => void;
  removeFromCart: (key: string) => void;
  removeCartKeys: (keys: string[]) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string, productName?: string) => void;
  isWishlisted: (productId: string) => boolean;
  toggleCompare: (productId: string) => void;
  isCompared: (productId: string) => boolean;
  clearCompare: () => void;
  refreshAuthAndCatalog: () => Promise<void>;
  refreshAddresses: () => Promise<void>;
  signOut: () => Promise<void>;
  showToast: (msg: string) => void;
}

const PREFS_STORAGE_PREFIX = "sai-ajanta-ui-prefs-v3";

function getScopedStorageKey(userId?: string | null): string {
  return `${PREFS_STORAGE_PREFIX}:${userId ? userId : "guest"}`;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [session, setSession] = useState<AuthenticatedUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [effectivePriceTier, setEffectivePriceTier] =
    useState<EffectivePriceTier>("CUSTOMER");
  const [wholesaleUnlocked, setWholesaleUnlocked] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<ProductItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [productMap, setProductMap] = useState<Record<string, ProductItem>>({});
  const [catalogSource, setCatalogSource] = useState<"medusa" | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);

  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    toast.success(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  const refreshAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/addresses", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { addresses?: SavedAddress[] };
        setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      } else {
        setAddresses([]);
      }
    } catch {
      setAddresses([]);
    }
  }, []);

  const refreshAuthAndCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [meRes, prodRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/products", { cache: "no-store" }),
      ]);

      let nextUser: AuthenticatedUser | null = null;
      if (meRes.ok) {
        const meData = (await meRes.json()) as {
          user: AuthenticatedUser | null;
          effectivePriceTier: EffectivePriceTier;
          wholesaleUnlocked: boolean;
        };
        nextUser = meData.user ?? null;
        setSession(nextUser);
        setEffectivePriceTier(meData.effectivePriceTier || "CUSTOMER");
        setWholesaleUnlocked(Boolean(meData.wholesaleUnlocked));
      } else {
        setSession(null);
        setEffectivePriceTier("CUSTOMER");
        setWholesaleUnlocked(false);
      }

      if (prodRes.ok) {
        const prodData = (await prodRes.json()) as {
          source?: "medusa";
          products: ProductItem[];
        };
        const products = Array.isArray(prodData.products) ? prodData.products : [];
        setCatalogSource(prodData.source ?? "medusa");
        setCatalogProducts(products);
        setCatalogError(null);
        const map: Record<string, ProductItem> = {};
        for (const p of products) {
          map[p.id] = p;
        }
        setProductMap(map);

        // Synchronize cart display prices and NAS images from live Medusa catalog
        setCart((prev) =>
          prev.map((line) => {
            const serverProd = map[line.productId];
            if (!serverProd) return line;
            const resolvedUnit = serverProd.unitPriceInr ?? null;
            const unitPriceInr =
              resolvedUnit !== null
                ? Math.round(resolvedUnit * line.packMultiplier * 100) / 100
                : null;
            const image =
              serverProd.src && serverProd.src.trim()
                ? serverProd.src
                : line.image;
            return { ...line, unitPriceInr, image };
          })
        );
      } else {
        let errorMessage =
          "Unable to reach the Medusa backend catalog API. Please start Medusa and retry.";
        try {
          const errData = (await prodRes.json()) as { error?: string };
          if (errData?.error) {
            errorMessage = errData.error;
          }
        } catch {
          // Keep default error message
        }
        setCatalogSource(null);
        setCatalogProducts([]);
        setProductMap({});
        setCatalogError(errorMessage);
      }

      if (nextUser) {
        await refreshAddresses();
      } else {
        setAddresses([]);
      }
    } catch {
      setCatalogSource(null);
      setCatalogProducts([]);
      setProductMap({});
      setCatalogError(
        "Unable to connect to the storefront catalog API. Ensure the backend service is running."
      );
    } finally {
      setAuthLoading(false);
      setCatalogLoading(false);
    }
  }, [refreshAddresses]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const scopedKey = getScopedStorageKey(session?.id ?? null);
        const raw = window.localStorage.getItem(scopedKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.cart)) setCart(parsed.cart);
          if (Array.isArray(parsed.wishlistIds)) setWishlistIds(parsed.wishlistIds);
          if (Array.isArray(parsed.compareIds)) setCompareIds(parsed.compareIds);
          if (typeof parsed.deliveryPincode === "string") setDeliveryPincode(parsed.deliveryPincode);
        }
      } catch {
        // Ignore malformed local preferences
      } finally {
        setHydrated(true);
      }
      void refreshAuthAndCatalog();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [refreshAuthAndCatalog]);

  const activeScopeRef = useRef<string | null>(null);

  // Isolate user-scoped cart storage whenever session user changes (SF-15 / P8.11.B)
  useEffect(() => {
    if (!hydrated || authLoading) return;
    const scopedKey = getScopedStorageKey(session?.id ?? null);
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(scopedKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setCart(Array.isArray(parsed.cart) ? parsed.cart : []);
          setWishlistIds(Array.isArray(parsed.wishlistIds) ? parsed.wishlistIds : []);
          setCompareIds(Array.isArray(parsed.compareIds) ? parsed.compareIds : []);
          setDeliveryPincode(typeof parsed.deliveryPincode === "string" ? parsed.deliveryPincode : "");
        } else {
          // Empty new scope: explicitly clear prior user's in-memory state to prevent cross-account bleed
          setCart([]);
          setWishlistIds([]);
          setCompareIds([]);
          setDeliveryPincode("");
        }
      } catch {
        setCart([]);
      } finally {
        activeScopeRef.current = scopedKey;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session?.id, authLoading, hydrated]);

  useEffect(() => {
    if (!hydrated || authLoading) return;
    const scopedKey = getScopedStorageKey(session?.id ?? null);
    // Do NOT persist until the current scope has finished loading (prevents writing User A's cart into User B's key)
    if (activeScopeRef.current !== scopedKey) return;
    try {
      window.localStorage.setItem(
        scopedKey,
        JSON.stringify({ cart, wishlistIds, compareIds, deliveryPincode })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [hydrated, authLoading, session?.id, cart, wishlistIds, compareIds, deliveryPincode]);

  const getAuthorizedUnitPrice = useCallback(
    (productId: string): number | null => {
      const srv = productMap[productId];
      return srv ? (srv.unitPriceInr ?? null) : null;
    },
    [productMap]
  );

  const getProductStock = useCallback(
    (productId: string): number | null => {
      const srv = productMap[productId];
      return srv && typeof srv.stockQty === "number" ? srv.stockQty : null;
    },
    [productMap]
  );

  const getProductImage = useCallback(
    (productId: string, fallbackSrc: string): string => {
      const srv = productMap[productId];
      return srv?.src && srv.src.trim() ? srv.src : fallbackSrc;
    },
    [productMap]
  );

  const addToCart = (
    item: ProductItem,
    options?: {
      finish?: string;
      packIndex?: number;
      quantity?: number;
      openDrawer?: boolean;
    }
  ) => {
    const spec = getProductSpecData(item);
    const finish = options?.finish ?? spec.finishOptions[0] ?? "Standard Finish";
    const packIdx = options?.packIndex ?? 0;
    const pack = spec.packOptions[packIdx] ?? spec.packOptions[0];
    const qty = Math.max(1, options?.quantity ?? 1);
    const sku = item.code ?? item.id.toUpperCase();
    const serverUnit =
      productMap[item.id] !== undefined
        ? (productMap[item.id].unitPriceInr ?? null)
        : spec.verifiedPriceInr;
    const unitPriceInr =
      serverUnit !== null
        ? Math.round(serverUnit * pack.multiplier * 100) / 100
        : null;
    const key = `${item.id}::${finish}::${pack.label}`;

    setCart((prev) => {
      const idx = prev.findIndex((entry) => entry.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], unitPriceInr, quantity: next[idx].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: item.id,
          sku,
          name: item.name,
          category: item.category,
          image: getProductImage(item.id, item.src),
          finish,
          packLabel: pack.label,
          packMultiplier: pack.multiplier,
          unitPriceInr,
          quantity: qty,
        },
      ];
    });

    if (options?.openDrawer) {
      setCartOpen(true);
    } else {
      showToast(`Added ${item.name} to BOQ Cart`);
    }
  };

  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.key === key
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((entry) => entry.key !== key));
  };

  const removeCartKeys = (keys: string[]) => {
    const keySet = new Set(keys);
    setCart((prev) => prev.filter((entry) => !keySet.has(entry.key)));
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string, productName?: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      showToast(
        exists
          ? `Removed${productName ? ` ${productName}` : ""} from Shortlist`
          : `Saved${productName ? ` ${productName}` : ""} to Shortlist`
      );
      return next;
    });
  };

  const isWishlisted = (productId: string) => wishlistIds.includes(productId);

  const toggleCompare = (productId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 4) {
        showToast("Compare up to 4 specifications at once");
        return prev;
      }
      return [...prev, productId];
    });
  };

  const isCompared = (productId: string) => compareIds.includes(productId);
  const clearCompare = () => setCompareIds([]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setEffectivePriceTier("CUSTOMER");
    setWholesaleUnlocked(false);
    setAddresses([]);
    // Clear active session cart from memory on shared devices (SF-15)
    setCart([]);
    await refreshAuthAndCatalog();
    showToast("Signed out");
  };

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const pricedSubtotalInr = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + (item.unitPriceInr !== null ? item.unitPriceInr * item.quantity : 0),
        0
      ),
    [cart]
  );

  const hasQuoteItems = useMemo(
    () => cart.some((item) => item.unitPriceInr === null),
    [cart]
  );

  const catalogCategories = useMemo<ProductCategory[]>(() => {
    if (catalogProducts.length === 0) return [];
    const present = new Set(catalogProducts.map((p) => p.category));
    return PRODUCT_CATEGORIES.filter((cat) => present.has(cat));
  }, [catalogProducts]);

  const value: StoreContextValue = {
    cart,
    cartCount,
    pricedSubtotalInr,
    hasQuoteItems,
    wishlistIds,
    compareIds,
    session,
    authLoading,
    effectivePriceTier,
    wholesaleUnlocked,
    addresses,
    cartOpen,
    deliveryPincode,
    setDeliveryPincode,
    toastMessage,
    setCartOpen,
    getAuthorizedUnitPrice,
    getProductStock,
    getProductImage,
    catalogProducts,
    catalogCategories,
    catalogLoading,
    catalogError,
    catalogSource,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    removeCartKeys,
    clearCart,
    toggleWishlist,
    isWishlisted,
    toggleCompare,
    isCompared,
    clearCompare,
    refreshAuthAndCatalog,
    refreshAddresses,
    signOut,
    showToast,
  };

  return (
    <BrandMotionConfig>
      <TooltipProvider>
        <StoreContext.Provider value={value}>
          {children}
          <Toaster />
        </StoreContext.Provider>
      </TooltipProvider>
    </BrandMotionConfig>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
}
