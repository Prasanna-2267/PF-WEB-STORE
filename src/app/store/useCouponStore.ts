import { create } from 'zustand';
import { mockCouponRepository } from '@/features/admin/coupons/api/mockCouponRepository';
import { CouponRepositoryError, type CouponRepository } from '@/features/admin/coupons/api/couponRepository';
import type { Coupon, CouponInput, CouponUpdateInput } from '@/features/admin/coupons/types/coupon';

type CouponLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CouponState {
  status: CouponLoadStatus;
  error: string | null;
  coupons: Coupon[];
  pendingId: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  createCoupon: (input: CouponInput) => Promise<Coupon>;
  updateCoupon: (couponId: string, input: CouponUpdateInput) => Promise<Coupon>;
  setCouponEnabled: (couponId: string, enabled: boolean) => Promise<Coupon>;
  deleteCoupon: (couponId: string) => Promise<void>;
}

const messageFor = (error: unknown, fallback: string): string => {
  if (error instanceof CouponRepositoryError) return error.message;
  return fallback;
};

export const createCouponStore = (repository: CouponRepository = mockCouponRepository) => create<CouponState>((set, get) => {
  let requestId = 0;

  const load = async () => {
    const currentRequest = ++requestId;
    set({ status: 'loading', error: null });
    try {
      const coupons = await repository.list();
      if (currentRequest !== requestId) return;
      set({ status: 'ready', coupons, error: null });
    } catch (error) {
      if (currentRequest !== requestId) return;
      set({ status: 'error', error: messageFor(error, 'Coupons could not be loaded. Please try again.') });
    }
  };

  return {
    status: 'idle',
    error: null,
    coupons: [],
    pendingId: null,
    initialize: async () => { if (get().status === 'idle') await load(); },
    refresh: load,
    createCoupon: async (input) => {
      set({ pendingId: 'create' });
      try {
        const created = await repository.create(input);
        set((state) => ({ coupons: [created, ...state.coupons], pendingId: null }));
        return created;
      } catch (error) {
        set({ pendingId: null });
        throw new Error(messageFor(error, 'The coupon could not be created. Please try again.'));
      }
    },
    updateCoupon: async (couponId, input) => {
      set({ pendingId: couponId });
      try {
        const updated = await repository.update(couponId, input);
        set((state) => ({ coupons: state.coupons.map((coupon) => coupon.id === couponId ? updated : coupon), pendingId: null }));
        return updated;
      } catch (error) {
        set({ pendingId: null });
        throw new Error(messageFor(error, 'The coupon could not be updated. Please try again.'));
      }
    },
    setCouponEnabled: async (couponId, enabled) => {
      set({ pendingId: couponId });
      try {
        const updated = await repository.setEnabled(couponId, enabled);
        set((state) => ({ coupons: state.coupons.map((coupon) => coupon.id === couponId ? updated : coupon), pendingId: null }));
        return updated;
      } catch (error) {
        set({ pendingId: null });
        throw new Error(messageFor(error, `The coupon could not be ${enabled ? 'enabled' : 'disabled'}. Please try again.`));
      }
    },
    deleteCoupon: async (couponId) => {
      set({ pendingId: couponId });
      try {
        await repository.delete(couponId);
        set((state) => ({ coupons: state.coupons.filter((coupon) => coupon.id !== couponId), pendingId: null }));
      } catch (error) {
        set({ pendingId: null });
        throw new Error(messageFor(error, 'The coupon could not be deleted. Please try again.'));
      }
    },
  };
});

export const useCouponStore = createCouponStore();
