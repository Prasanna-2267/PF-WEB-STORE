import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';

export type AdminOrderStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type AdminRefundStatus = 'NONE' | 'PARTIAL' | 'FULL';
export type AdminAccessStatus = 'NOT_APPLICABLE' | 'GRANTED' | 'REVOKED';

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageDto<T> {
  data: T[];
  pagination: PaginationDto;
}

export interface AdminOrderUserDto {
  id: string;
  email: string;
  fullName: string;
}

export interface AdminOrderDto {
  id: string;
  orderNumber: string;
  currency: string;
  subtotal: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  status: AdminOrderStatus;
  refundStatus: AdminRefundStatus;
  accessStatus: AdminAccessStatus;
  createdAt: string;
  paidAt: string | null;
  user: AdminOrderUserDto;
  items?: AdminOrderItemDto[];
}

export interface AdminOrderItemDto {
  id: string;
  titleSnapshot: string;
  priceSnapshot: number | string;
}

export interface AdminOrderPaymentDto {
  id: string;
  amount: number | string;
  status: string;
  paymentMethod?: string | null;
  providerPaymentId?: string | null;
  createdAt: string;
}

export interface AdminOrderEntitlementDto {
  id: string;
  resourceType: string;
  resourceTitle: string;
  status: string;
  grantedAt: string;
}

export interface AdminOrderDetailDto extends AdminOrderDto {
  items: AdminOrderItemDto[];
  payments: AdminOrderPaymentDto[];
  entitlements: AdminOrderEntitlementDto[];
}

export interface AdminOrderSummary {
  totalOrders: number;
  paidOrders: number;
  refundedOrders: number;
  failedOrders: number;
  totalRevenueMinor: number;
}

export interface AdminOrdersResponseDto {
  data: AdminOrderDto[];
  pagination: PaginationDto;
  summary: AdminOrderSummary;
}

export interface AdminOrderFilters {
  page: number;
  limit: number;
  search?: string;
  status?: AdminOrderStatus;
}

export interface RefundOrderInput {
  amount: number;
  reason: string;
}

export interface CancelOrderInput {
  reason: string;
}

const queryString = (values: Record<string, string | number | undefined>): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};

export const adminOrdersKeys = {
  all: (userId: string) => ['admin', userId, 'orders'] as const,
  list: (userId: string, filters: AdminOrderFilters) =>
    ['admin', userId, 'orders', 'list', { ...filters, search: filters.search?.trim() || undefined }] as const,
  detail: (userId: string, orderId: string) =>
    ['admin', userId, 'orders', 'detail', orderId] as const,
};

export async function fetchAdminOrders(
  filters: AdminOrderFilters,
  signal?: AbortSignal,
): Promise<AdminOrdersResponseDto> {
  const query = queryString({
    page: filters.page,
    limit: filters.limit,
    search: filters.search?.trim() || undefined,
    status: filters.status,
  });
  return apiRequest<AdminOrdersResponseDto>(`/api/admin/orders?${query}`, { signal });
}

export async function fetchAdminOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetailDto> {
  return apiRequest<AdminOrderDetailDto>(`/api/admin/orders/${encodeURIComponent(orderId)}`, { signal });
}

export async function mutateRefundAdminOrder(
  orderId: string,
  input: RefundOrderInput,
): Promise<unknown> {
  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `refund-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: input,
  });
}

export async function mutateCancelAdminOrder(
  orderId: string,
  input: CancelOrderInput,
): Promise<unknown> {
  return apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: input,
  });
}

export function useAdminOrdersReadOnly(userId: string | null, filters: AdminOrderFilters) {
  return useQuery({
    queryKey: adminOrdersKeys.list(userId ?? 'anonymous', filters),
    queryFn: ({ signal }) => fetchAdminOrders(filters, signal),
    enabled: Boolean(userId),
  });
}

export function useAdminOrderReadOnly(userId: string | null, orderId?: string) {
  return useQuery({
    queryKey: adminOrdersKeys.detail(userId ?? 'anonymous', orderId ?? 'missing'),
    queryFn: ({ signal }) => fetchAdminOrder(orderId!, signal),
    enabled: Boolean(userId && orderId),
  });
}

export function useRefundAdminOrder(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: RefundOrderInput }) =>
      mutateRefundAdminOrder(orderId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminOrdersKeys.all(userId ?? 'anonymous'),
      });
      queryClient.invalidateQueries({
        queryKey: adminOrdersKeys.detail(userId ?? 'anonymous', variables.orderId),
      });
    },
  });
}

export function useCancelAdminOrder(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CancelOrderInput }) =>
      mutateCancelAdminOrder(orderId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminOrdersKeys.all(userId ?? 'anonymous'),
      });
      queryClient.invalidateQueries({
        queryKey: adminOrdersKeys.detail(userId ?? 'anonymous', variables.orderId),
      });
    },
  });
}
