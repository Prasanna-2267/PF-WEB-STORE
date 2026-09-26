import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Device-local cart state for the Store UI prototype.
 *
 * It is deliberately not a payment record, receipt, or entitlement source.
 * A production checkout must re-price product ids on the server and only the
 * payment backend may grant access to purchased learning resources.
 */
export interface CartState {
  itemIds: string[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}


export const STORE_CART_STORAGE_KEY = 'pf_store_cart_v1';

const sanitiseItemIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.trim().length > 0 && candidate.length <= 200,
      ),
    ),
  );
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      itemIds: [],
      addItem: (productId) => {
        if (!productId?.trim()) return;

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
