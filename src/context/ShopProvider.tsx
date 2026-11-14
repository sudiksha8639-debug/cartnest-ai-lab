import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

const GUEST_KEY_STORAGE = "cartnest:guest-key";
const RECENT_STORAGE = "cartnest:recently-viewed";
let seedRequested = false;

function createGuestKey() {
  try {
    const stored = window.localStorage.getItem(GUEST_KEY_STORAGE);
    if (stored && /^guest_[a-zA-Z0-9_-]{8,64}$/.test(stored)) return stored;
    const key = `guest_${crypto.randomUUID().replace(/-/g, "")}`;
    window.localStorage.setItem(GUEST_KEY_STORAGE, key);
    return key;
  } catch {
    return `guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function readRecentIds(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

type CartValue = {
  items: {
    _id: Id<"cartItems">;
    productId: Id<"products">;
    quantity: number;
    product: Doc<"products">;
  }[];
  count: number;
  subtotal: number;
};

type ShopContextValue = {
  guestKey: string;
  cart: CartValue | undefined;
  cartCount: number;
  cartSubtotal: number;
  wishlist: { productId: Id<"products">; product: Doc<"products"> }[];
  wishlistCount: number;
  recentlyViewed: Doc<"products">[];
  addToCart: (product: Doc<"products">, quantity?: number) => Promise<void>;
  setQuantity: (itemId: Id<"cartItems">, quantity: number) => Promise<void>;
  removeItem: (itemId: Id<"cartItems">) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (product: Doc<"products">) => Promise<void>;
  isWishlisted: (productId: Id<"products">) => boolean;
  recordView: (productId: Id<"products">) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [guestKey] = useState(createGuestKey);
  const [recentIds, setRecentIds] = useState<string[]>(readRecentIds);
  const mergedFor = useRef<string | null>(null);

  const cart = useQuery(api.cart.get, { guestKey }) as CartValue | undefined;
  const wishlistRows = useQuery(api.wishlist.list, { guestKey });
  const catalogue = useQuery(api.products.catalogueStats, {});
  const recentProducts = useQuery(api.products.byIds, {
    ids: recentIds as Id<"products">[],
  });

  const seedCatalogue = useMutation(api.products.seedCatalogue);
  const addMutation = useMutation(api.cart.add);
  const setQuantityMutation = useMutation(api.cart.setQuantity);
  const removeMutation = useMutation(api.cart.remove);
  const clearMutation = useMutation(api.cart.clear);
  const toggleWishlistMutation = useMutation(api.wishlist.toggle);
  const mergeGuestSession = useMutation(api.cart.mergeGuestSession);

  useEffect(() => {
    if (seedRequested || catalogue === undefined) return;
    if (catalogue.productCount > 0) {
      seedRequested = true;
      return;
    }
    seedRequested = true;
    seedCatalogue({}).catch((error) => {
      console.warn("[CartNest] Catalogue seed skipped:", error);
    });
  }, [catalogue, seedCatalogue]);

  useEffect(() => {
    if (!isAuthenticated) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === guestKey) return;
    mergedFor.current = guestKey;
    mergeGuestSession({ guestKey })
      .then((result) => {
        if (result && result.merged > 0) {
          toast.success("Guest cart moved", {
            description: `${result.merged} item${result.merged > 1 ? "s" : ""} carried over to your account.`,
          });
        }
      })
      .catch(() => {
        /* merging is best-effort; the account cart still works */
      });
  }, [isAuthenticated, guestKey, mergeGuestSession]);

  const addToCart = useCallback(
    async (product: Doc<"products">, quantity = 1) => {
      try {
        const result = await addMutation({
          guestKey,
          productId: product._id,
          quantity,
        });
        toast.success(result?.added ? "Added to cart" : "Cart updated", {
          description: `${quantity} × ${product.name} · ${product.brand}`,
        });
      } catch (error) {
        toast.error("Could not add to cart", { description: messageOf(error) });
        throw error;
      }
    },
    [addMutation, guestKey],
  );

  const setQuantity = useCallback(
    async (itemId: Id<"cartItems">, quantity: number) => {
      try {
        await setQuantityMutation({ guestKey, itemId, quantity });
      } catch (error) {
        toast.error("Could not update quantity", { description: messageOf(error) });
        throw error;
      }
    },
    [guestKey, setQuantityMutation],
  );

  const removeItem = useCallback(
    async (itemId: Id<"cartItems">) => {
      try {
        await removeMutation({ guestKey, itemId });
        toast.success("Removed from cart");
      } catch (error) {
        toast.error("Could not remove item", { description: messageOf(error) });
        throw error;
      }
    },
    [guestKey, removeMutation],
  );

  const clearCart = useCallback(async () => {
    try {
      await clearMutation({ guestKey });
    } catch (error) {
      toast.error("Could not empty the cart", { description: messageOf(error) });
      throw error;
    }
  }, [clearMutation, guestKey]);

  const toggleWishlist = useCallback(
    async (product: Doc<"products">) => {
      try {
        const result = await toggleWishlistMutation({ guestKey, productId: product._id });
        toast.success(result?.wishlisted ? "Saved to wishlist" : "Removed from wishlist", {
          description: product.name,
        });
      } catch (error) {
        toast.error("Could not update wishlist", { description: messageOf(error) });
        throw error;
      }
    },
    [guestKey, toggleWishlistMutation],
  );

  const recordView = useCallback((productId: Id<"products">) => {
    setRecentIds((previous) => {
      const next = [productId, ...previous.filter((id) => id !== productId)].slice(0, 8);
      try {
        window.localStorage.setItem(RECENT_STORAGE, JSON.stringify(next));
      } catch {
        /* storage may be unavailable; the session still works */
      }
      return next;
    });
  }, []);

  const wishlist = useMemo(
    () =>
      (wishlistRows ?? []).map((row) => ({
        productId: row.productId,
        product: row.product,
      })),
    [wishlistRows],
  );

  const wishlistIds = useMemo(
    () => new Set(wishlist.map((item) => item.productId as string)),
    [wishlist],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      guestKey,
      cart,
      cartCount: cart?.count ?? 0,
      cartSubtotal: cart?.subtotal ?? 0,
      wishlist,
      wishlistCount: wishlist.length,
      recentlyViewed: recentProducts ?? [],
      addToCart,
      setQuantity,
      removeItem,
      clearCart,
      toggleWishlist,
      isWishlisted: (productId) => wishlistIds.has(productId),
      recordView,
    }),
    [
      guestKey,
      cart,
      wishlist,
      recentProducts,
      addToCart,
      setQuantity,
      removeItem,
      clearCart,
      toggleWishlist,
      wishlistIds,
      recordView,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used inside ShopProvider");
  return context;
}

export function messageOf(error: unknown) {
  if (error instanceof Error) {
    const match = error.message.match(/Uncaught Error:\s*(.*)/);
    return match ? match[1] : error.message;
  }
  return "Something went wrong. Please try again.";
}
