import type { Coupon, CouponInput, CouponUpdateInput } from '../types/coupon';

export type CouponRepositoryErrorCode = 'DUPLICATE' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'STORAGE_ERROR';

export class CouponRepositoryError extends Error {
  readonly code: CouponRepositoryErrorCode;

  constructor(code: CouponRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'CouponRepositoryError';
    this.code = code;
  }
}

export interface CouponRepository {
  list(): Promise<Coupon[]>;
  create(input: CouponInput): Promise<Coupon>;
  update(couponId: string, input: CouponUpdateInput): Promise<Coupon>;
  setEnabled(couponId: string, enabled: boolean): Promise<Coupon>;
  delete(couponId: string): Promise<void>;
}
