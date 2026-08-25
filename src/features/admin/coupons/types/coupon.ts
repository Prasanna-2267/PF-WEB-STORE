export type CouponDiscountType = 'PERCENT' | 'FLAT';
export type CouponScope = 'ALL' | 'PACKAGES' | 'SUBJECTS';
export type CouponStatus = 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'DISABLED';

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  scope: CouponScope;
  targetIds: string[];
  usageCount: number;
  maxUses: number | null;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponInput {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  scope: CouponScope;
  targetIds: string[];
  maxUses: number | null;
  expiresAt: string | null;
  enabled?: boolean;
}

export type CouponUpdateInput = Omit<CouponInput, 'code'>;

export const getCouponStatus = (coupon: Coupon, now = new Date()): CouponStatus => {
  if (!coupon.enabled) return 'DISABLED';
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now.getTime()) return 'EXPIRED';
  if (coupon.maxUses !== null && coupon.usageCount >= coupon.maxUses) return 'EXHAUSTED';
  return 'ACTIVE';
};

export const normalizeCouponCode = (value: string): string => value
  .toLocaleUpperCase()
  .replace(/\s+/g, '')
  .replace(/[^A-Z0-9_-]/g, '');
