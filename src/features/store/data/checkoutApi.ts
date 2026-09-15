import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { StoreProduct } from '../types/catalog';

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  status: 'CREATED' | 'PAID';
  currency: 'INR';
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMode: 'FAKE_TEST' | 'COMPLIMENTARY' | 'PROVIDER';
  requiresFakePayment: boolean;
  checkoutUrl?: string;
}

export interface PaidOrderResponse {
  orderId: string;
  orderNumber: string;
  status: 'PAID';
  accessStatus: 'GRANTED';
  receiptNumber: string;
  paidAt: string;
  duplicate: boolean;
}

export interface StoreEntitlement {
  id: string;
  resourceType: 'PACKAGE' | 'PREMIUM_NOTES' | 'QUESTION_BANK' | string;
  resourceId: string | null;
  title: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED';
  grantedAt: string;
  expiresAt: string | null;
  order: null | { orderId: string; orderNumber: string; receiptNumber: string | null; paidAt: string | null };
}

export interface StoreReceipt {
  id: string;
  orderNumber: string;
  receiptNumber: string | null;
  status: string;
  accessStatus: string;
  purchaseType: 'FREE_PURCHASE' | 'PAID_PURCHASE';
  paymentMethod: string | null;
  paidAt: string | null;
  refundStatus: string;
  createdAt: string;
  refundedAt: string | null;
  course: { id: string; code: string; name: string };
  customer: { fullName: string; email: string; phone: string | null };
  totals: {
    subtotal: { amount: number; currency: 'INR' };
    discount: { amount: number; currency: 'INR' };
    total: { amount: number; currency: 'INR' };
  };
  items: Array<{ id: string; resourceType: string; contentItemId: string | null; packageId: string | null; questionBankId?: string | null; titleSnapshot: string; quantity: number; unitPrice: { amount: number; currency: 'INR' }; totalPrice: { amount: number; currency: 'INR' } }>;
  payments: Array<{ id: string; provider: string; providerPaymentId: string | null; amount: { amount: number; currency: 'INR' }; status: string; paymentMethod: string | null; createdAt: string; refunds: Array<{ id: string; providerRefundId: string; amount: { amount: number; currency: 'INR' }; reason: string; createdAt: string }> }>;
  coupons: Array<{ code: string; discountType: 'PERCENT' | 'FLAT'; discountValue: number; discount: { amount: number; currency: 'INR' } }>;
}

export interface StoreOrderSummary {
  id: string;
  orderNumber: string;
  receiptNumber: string | null;
  status: string;
  refundStatus: string;
  accessStatus: string;
  currency: 'INR';
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
}

const requestKey = (prefix: string) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

export const checkoutKeys = {
  entitlements: ['student', 'store', 'entitlements'] as const,
  receipt: (orderId: string) => ['student', 'store', 'receipt', orderId] as const,
  orders: ['student', 'store', 'orders'] as const,
};

export function createStoreCheckout(products: StoreProduct[], couponCode?: string) {
  return apiRequest<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    idempotencyKey: requestKey('checkout'),
    body: {
      items: products.map((product) => ({
        resourceType: product.productType === 'question-bank' ? 'QUESTION_BANK' : product.productType === 'bundle' ? 'PACKAGE' : 'CONTENT',
        resourceId: product.id,
      })),
      ...(couponCode?.trim() ? { couponCode: couponCode.trim() } : {}),
    },
  });
}

export function completeFakePayment(orderId: string) {
  return apiRequest<PaidOrderResponse>(`/api/checkout/${encodeURIComponent(orderId)}/fake-payment`, {
    method: 'POST',
    idempotencyKey: requestKey(`fake_${orderId}`),
    body: { outcome: 'SUCCESS' },
  });
}

export function fetchStoreReceipt(orderId: string) {
  return apiRequest<StoreReceipt>(`/api/student/orders/${encodeURIComponent(orderId)}/receipt`);
}

export function fetchStoreEntitlements() {
  return apiRequest<{ items: StoreEntitlement[] }>('/api/student/entitlements?status=ACTIVE&page=1&limit=100');
}

export async function fetchStoreOrders() {
  type OrderPage = { data: StoreOrderSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  const firstPage = await apiRequest<OrderPage>('/api/student/orders?page=1&limit=100');
  if (firstPage.pagination.totalPages <= 1) return firstPage;
  const remainingPages = await Promise.all(Array.from(
    { length: firstPage.pagination.totalPages - 1 },
    (_, index) => apiRequest<OrderPage>(`/api/student/orders?page=${index + 2}&limit=100`),
  ));
  return { ...firstPage, data: [firstPage, ...remainingPages].flatMap((page) => page.data) };
}

export function useStoreReceipt(orderId: string) {
  return useQuery({
    queryKey: checkoutKeys.receipt(orderId),
    queryFn: () => fetchStoreReceipt(orderId),
    enabled: Boolean(orderId),
    staleTime: 15_000,
  });
}

export function useStoreEntitlements(enabled = true) {
  return useQuery({
    queryKey: checkoutKeys.entitlements,
    queryFn: fetchStoreEntitlements,
    enabled,
    staleTime: 15_000,
  });
}

export function useStoreOrders() {
  return useQuery({
    queryKey: checkoutKeys.orders,
    queryFn: fetchStoreOrders,
    staleTime: 15_000,
  });
}
