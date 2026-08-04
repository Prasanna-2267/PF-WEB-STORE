import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getProductById } from '@/features/store/data/catalogQueries';
import type { StoreProduct } from '@/features/store/types/catalog';

/**
 * Device-local cart state for the Store UI prototype.
 *
 * It is deliberately not a payment record, receipt, or entitlement source.
 * A production checkout must re-price product ids on the server and only the
 * payment backend may grant access to purchased learning resources.
 */
export interface CartState {
  itemIds: string[];
  addItem: (productId: StoreProduct['id']) => void;
  removeItem: (productId: StoreProduct['id']) => void;
  clearCart: () => void;
}

export interface CartTotals {
  itemCount: number;
  originalSubtotal: number;
  discountTotal: number;
  subtotal: number;
  total: number;
  currency: StoreProduct['currency'];
}

export const STORE_CART_STORAGE_KEY = 'pf_store_cart_v1';

const sanitiseItemIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && Boolean(getProductById(candidate)),
      ),
    ),
  );
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      itemIds: [],
      addItem: (productId) => {
        if (!getProductById(productId)) return;

        set((state) =>
          state.itemIds.includes(productId)
            ? state
            : { itemIds: [...state.itemIds, productId] },
        );
      },
      removeItem: (productId) => {
        set((state) => ({
          itemIds: state.itemIds.filter((itemId) => itemId !== productId),
        }));
      },
      clearCart: () => set({ itemIds: [] }),
    }),
    {
      name: STORE_CART_STORAGE_KEY,
      version: 1,
      merge: (persistedState, currentState) => {
        const persistedCart = persistedState as Partial<CartState> | undefined;

        return {
          ...currentState,
          itemIds: sanitiseItemIds(persistedCart?.itemIds),
        };
      },
    },
  ),
);

/** Resolves live catalog data and silently drops removed or inactive products. */
export const getCartProducts = (itemIds: readonly string[]): StoreProduct[] =>
  sanitiseItemIds(itemIds)
    .map((itemId) => getProductById(itemId))
    .filter((product): product is StoreProduct => Boolean(product));

/**
 * Totals are always derived from the current catalog rather than persisted
 * prices. These values are display estimates until a backend checkout verifies
 * availability, discounts, taxes, and the final amount due.
 */
export const getCartTotals = (itemIds: readonly string[]): CartTotals => {
  const products = getCartProducts(itemIds);
  const subtotal = products.reduce((sum, product) => sum + product.price, 0);
  const originalSubtotal = products.reduce(
    (sum, product) => sum + (product.discount?.originalPrice ?? product.price),
    0,
  );

  return {
    itemCount: products.length,
    originalSubtotal,
    discountTotal: Math.max(0, originalSubtotal - subtotal),
    subtotal,
    total: subtotal,
    currency: 'INR',
  };
};

export const selectCartItemCount = (state: CartState): number => state.itemIds.length;
export const selectCartProducts = (state: CartState): StoreProduct[] => getCartProducts(state.itemIds);
export const selectCartTotals = (state: CartState): CartTotals => getCartTotals(state.itemIds);
