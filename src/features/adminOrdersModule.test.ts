import { describe, expect, it, vi } from 'vitest';
import {
  fetchAdminOrders,
  fetchAdminOrder,
  mutateRefundAdminOrder,
  mutateCancelAdminOrder,
} from './admin/readOnly/adminOrdersReadOnlyApi';

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
  queryString: vi.fn((params: Record<string, unknown>) =>
    Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&'),
  ),
}));

import { apiRequest } from '@/lib/api/client';

describe('Super Admin Orders Module API Client', () => {
  it('fetchAdminOrders calls /api/admin/orders with pagination and status filter', async () => {
    const mockResponse = {
      data: [
        {
          id: 'ord-101',
          orderNumber: 'ORD-2026-101',
          currency: 'INR',
          subtotal: 1999,
          discountAmount: 0,
          totalAmount: 1999,
          status: 'PAID',
          refundStatus: 'NONE',
          accessStatus: 'GRANTED',
          createdAt: '2026-08-23T10:00:00.000Z',
          paidAt: '2026-08-23T10:05:00.000Z',
          user: {
            id: 'user-1',
            email: 'student@test.com',
            fullName: 'Test Student',
          },
        },
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      summary: {
        totalOrders: 10,
        paidOrders: 8,
        refundedOrders: 1,
        failedOrders: 1,
        totalRevenueMinor: 15992,
      },
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockResponse);

    const result = await fetchAdminOrders({ page: 1, limit: 25, search: 'Test Student', status: 'PAID' });

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/orders?page=1&limit=25&search=Test+Student&status=PAID', expect.any(Object));
    expect(result.data).toHaveLength(1);
    expect(result.data[0].orderNumber).toBe('ORD-2026-101');
    expect(result.data[0].user.fullName).toBe('Test Student');
    expect(result.summary.totalRevenueMinor).toBe(15992);
  });

  it('fetchAdminOrder calls /api/admin/orders/:orderId and returns order detail', async () => {
    const mockDetailResponse = {
      id: 'ord-101',
      orderNumber: 'ORD-2026-101',
      currency: 'INR',
      subtotal: 1999,
      discountAmount: 0,
      totalAmount: 1999,
      status: 'PAID',
      refundStatus: 'NONE',
      accessStatus: 'GRANTED',
      createdAt: '2026-08-23T10:00:00.000Z',
      paidAt: '2026-08-23T10:05:00.000Z',
      user: { id: 'user-1', email: 'student@test.com', fullName: 'Test Student' },
      items: [{ id: 'item-1', titleSnapshot: 'CA Foundation Full Course', priceSnapshot: 1999 }],
      payments: [{ id: 'pm-1', amount: 1999, status: 'SUCCESS', paymentMethod: 'UPI', providerPaymentId: 'pay_12345', createdAt: '2026-08-23T10:05:00.000Z' }],
      entitlements: [{ id: 'ent-1', resourceType: 'COURSE', resourceTitle: 'CA Foundation Full Course', status: 'ACTIVE', grantedAt: '2026-08-23T10:05:00.000Z' }],
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockDetailResponse);

    const result = await fetchAdminOrder('ord-101');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/orders/ord-101', expect.any(Object));
    expect(result.id).toBe('ord-101');
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
  });

  it('mutateRefundAdminOrder calls POST /api/admin/orders/:orderId/refund with Idempotency-Key header', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'refund-1', amount: 1999, status: 'REFUNDED' });

    const refundInput = { amount: 1999, reason: 'Student requested cancellation' };
    const result = await mutateRefundAdminOrder('ord-101', refundInput);

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/orders/ord-101/refund', {
      method: 'POST',
      headers: {
        'Idempotency-Key': expect.any(String),
      },
      body: refundInput,
    });
    expect(result).toEqual({ id: 'refund-1', amount: 1999, status: 'REFUNDED' });
  });

  it('mutateCancelAdminOrder calls POST /api/admin/orders/:orderId/cancel with reason', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ count: 1 });

    const cancelInput = { reason: 'Order created in error' };
    const result = await mutateCancelAdminOrder('ord-101', cancelInput);

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/orders/ord-101/cancel', {
      method: 'POST',
      body: cancelInput,
    });
    expect(result).toEqual({ count: 1 });
  });
});
