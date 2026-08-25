import type { Coupon, CouponDiscountType, CouponInput, CouponUpdateInput } from '../types/coupon';
import { CouponRepositoryError, type CouponRepository } from './couponRepository';
import { apiRequest } from '@/lib/api/client';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface BackendCouponDto {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number | string;
  enabled: boolean;
  maxUses?: number | null;
  currentUses?: number;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function adaptBackendCoupon(dto: BackendCouponDto): Coupon {
  const val = typeof dto.discountValue === 'number' ? dto.discountValue : parseFloat(dto.discountValue) || 0;
  return {
    id: dto.id,
    code: dto.code,
    discountType: (dto.discountType === 'PERCENT' ? 'PERCENT' : 'FLAT') as CouponDiscountType,
    discountValue: val,
    scope: 'ALL',
    targetIds: [],
    usageCount: dto.currentUses ?? 0,
    maxUses: dto.maxUses ?? null,
    expiresAt: dto.expiresAt ?? null,
    enabled: dto.enabled,
    createdAt: dto.createdAt || new Date().toISOString(),
    updatedAt: dto.updatedAt || new Date().toISOString(),
  };
}

export class MockCouponRepository implements CouponRepository {
  async list(): Promise<Coupon[]> {
    try {
      const response = await apiRequest<{ data: BackendCouponDto[] }>('/api/admin/coupons?limit=100');
      if (response && Array.isArray(response.data)) {
        return response.data.map(adaptBackendCoupon);
      }
    } catch {
      // Unauthenticated fallback
    }
    return [];
  }

  async create(input: CouponInput): Promise<Coupon> {
    try {
      const dto = await apiRequest<BackendCouponDto>('/api/admin/coupons', {
        method: 'POST',
        body: {
          code: input.code.trim().toUpperCase(),
          discountType: input.discountType === 'PERCENT' ? 'PERCENT' : 'FLAT',
          discountValue: input.discountValue,
          scope: 'ALL',
          maxUses: input.maxUses || undefined,
          expiresAt: input.expiresAt || undefined,
        },
      });
      if (dto && dto.id) {
        return adaptBackendCoupon(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new CouponRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new CouponRepositoryError('STORAGE_ERROR', 'Failed to create coupon on backend.');
  }

  async update(couponId: string, input: CouponUpdateInput): Promise<Coupon> {
    try {
      const dto = await apiRequest<BackendCouponDto>(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        method: 'PATCH',
        body: {
          enabled: input.enabled,
          maxUses: input.maxUses || null,
          expiresAt: input.expiresAt || null,
        },
      });
      if (dto && dto.id) {
        return adaptBackendCoupon(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new CouponRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new CouponRepositoryError('STORAGE_ERROR', 'Failed to update coupon on backend.');
  }

  async setEnabled(couponId: string, enabled: boolean): Promise<Coupon> {
    try {
      const dto = await apiRequest<BackendCouponDto>(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        method: 'PATCH',
        body: { enabled },
      });
      if (dto && dto.id) {
        return adaptBackendCoupon(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new CouponRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new CouponRepositoryError('STORAGE_ERROR', 'Failed to update coupon state on backend.');
  }

  async delete(couponId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Soft ignore
    }
  }
}

export const mockCouponRepository = new MockCouponRepository();
