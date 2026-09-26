import { apiRequest } from '@/lib/api/client';
import type {
  AccessGrantInput,
  AdminOverview,
  Order,
  OrderListQuery,
  OrderSummary,
  PaginatedResult,
  StudentDetails,
  StudentListItem,
  StudentListQuery,
  StudentRole,
} from '../types/admin';
import type { AdminRepository } from './adminRepository';

const queryString = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'ALL') query.set(key, String(value));
  });
  return query.toString();
};

class ApiAdminRepository implements AdminRepository {
  getOverview() {
    return apiRequest<AdminOverview>('/api/admin/overview');
  }

  listStudents(query: StudentListQuery = {}) {
    const search = queryString({ ...query, limit: query.pageSize, pageSize: undefined });
    return apiRequest<PaginatedResult<StudentListItem>>(`/api/admin/students${search ? `?${search}` : ''}`);
  }

  getStudent(studentId: string) {
    return apiRequest<StudentDetails>(`/api/admin/students/${encodeURIComponent(studentId)}`);
  }

  listOrders(query: OrderListQuery = {}) {
    const search = queryString({ ...query, limit: query.pageSize, pageSize: undefined });
    return apiRequest<PaginatedResult<Order>>(`/api/admin/orders${search ? `?${search}` : ''}`);
  }

  async getOrderSummary(courseId?: string): Promise<OrderSummary> {
    const page = await this.listOrders({ page: 1, pageSize: 100, courseId });
    return page.items.reduce<OrderSummary>((summary, order) => ({
      totalOrders: summary.totalOrders + 1,
      paidOrders: summary.paidOrders + Number(order.status === 'PAID'),
      failedOrders: summary.failedOrders + Number(order.status === 'FAILED'),
      refundedOrders: summary.refundedOrders + Number(order.status === 'REFUNDED'),
      pendingOrders: summary.pendingOrders + Number(order.status === 'CREATED'),
      complimentaryOrders: summary.complimentaryOrders + Number(order.isComplimentary),
      revenueMinor: summary.revenueMinor + (order.status === 'PAID' ? order.amountMinor : 0),
    }), { totalOrders: 0, paidOrders: 0, failedOrders: 0, refundedOrders: 0, pendingOrders: 0, complimentaryOrders: 0, revenueMinor: 0 });
  }

  getOrder(orderId: string) {
    return apiRequest<Order>(`/api/admin/orders/${encodeURIComponent(orderId)}`);
  }

  async grantAccess(studentId: string, input: AccessGrantInput) {
    await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}/grant-access`, { method: 'POST', body: input });
    return this.getStudent(studentId);
  }

  async updateStudentRole(studentId: string, role: StudentRole) {
    await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}/role`, { method: 'PATCH', body: { role: role.toLowerCase() } });
    return this.getStudent(studentId);
  }

  async setStudentEnabled(studentId: string, enabled: boolean) {
    await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}/status`, { method: 'PATCH', body: { status: enabled ? 'ACTIVE' : 'DISABLED' } });
    return this.getStudent(studentId);
  }

  async forceLogout(studentId: string) {
    await apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}/sessions/revoke`, { method: 'POST' });
    return this.getStudent(studentId);
  }
}

export const apiAdminRepository: AdminRepository = new ApiAdminRepository();
