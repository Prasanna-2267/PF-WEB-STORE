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

export type AdminRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'STORAGE_ERROR';

export class AdminRepositoryError extends Error {
  readonly code: AdminRepositoryErrorCode;

  constructor(code: AdminRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'AdminRepositoryError';
    this.code = code;
  }
}

/**
 * UI-facing contract for the Super Admin data layer.
 *
 * A production adapter must enforce authentication, authorization, payment
 * verification, entitlement rules, and audit logging on a trusted server.
 */
export interface AdminRepository {
  getOverview(): Promise<AdminOverview>;
  listStudents(query?: StudentListQuery): Promise<PaginatedResult<StudentListItem>>;
  getStudent(studentId: string): Promise<StudentDetails>;
  listOrders(query?: OrderListQuery): Promise<PaginatedResult<Order>>;
  getOrderSummary(courseId?: string): Promise<OrderSummary>;
  getOrder(orderId: string): Promise<Order>;
  grantAccess(studentId: string, input: AccessGrantInput): Promise<StudentDetails>;
  updateStudentRole(
    studentId: string,
    role: StudentRole,
    reason?: string,
  ): Promise<StudentDetails>;
  setStudentEnabled(
    studentId: string,
    enabled: boolean,
    reason?: string,
  ): Promise<StudentDetails>;
  forceLogout(studentId: string, reason?: string): Promise<StudentDetails>;
}

export const DEFAULT_ADMIN_PAGE_SIZE = 10;
