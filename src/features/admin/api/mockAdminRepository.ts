import {
  DEMO_SUPER_ADMIN_ID,
  adminContentCountsFixture,
  adminNewStudentSeriesFixture,
  adminRevenueSeriesFixture,
  createAdminFixtureState,
  type AdminFixtureState,
} from '../data/adminFixtures';
import type {
  AccessGrantInput,
  Activity,
  AdminOverview,
  AuditEvent,
  Entitlement,
  Order,
  OrderListQuery,
  OrderSummary,
  PaginatedResult,
  Student,
  StudentDetails,
  StudentListItem,
  StudentListQuery,
  StudentRole,
} from '../types/admin';
import {
  AdminRepositoryError,
  DEFAULT_ADMIN_PAGE_SIZE,
  type AdminRepository,
} from './adminRepository';

/**
 * DEMO ADAPTER ONLY.
 *
 * This repository persists fictional admin data in the current browser so the
 * console can be explored without a backend. It must never be treated as real
 * authentication, payment, order, entitlement, or audit authority. Production
 * builds must replace it with a server-backed adapter that verifies every
 * privileged action independently of browser state.
 */

export const ADMIN_DEMO_STORAGE_KEY = 'pf_admin_demo_repository_v1';
export const ADMIN_DEMO_STORAGE_VERSION = 1;
export const ADMIN_DEMO_LATENCY_MS = 180;

interface PersistedAdminState {
  version: number;
  data: AdminFixtureState;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isAdminFixtureState = (value: unknown): value is AdminFixtureState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdminFixtureState>;
  return (
    Array.isArray(candidate.students) &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.entitlements) &&
    Array.isArray(candidate.activity) &&
    Array.isArray(candidate.sessions) &&
    Array.isArray(candidate.auditEvents)
  );
};

const readPersistedState = (): AdminFixtureState => {
  if (typeof window === 'undefined') return createAdminFixtureState();

  try {
    const raw = window.localStorage.getItem(ADMIN_DEMO_STORAGE_KEY);
    if (!raw) return createAdminFixtureState();
    const persisted = JSON.parse(raw) as Partial<PersistedAdminState>;
    if (
      persisted.version !== ADMIN_DEMO_STORAGE_VERSION ||
      !isAdminFixtureState(persisted.data)
    ) {
      return createAdminFixtureState();
    }
    return clone(persisted.data);
  } catch {
    return createAdminFixtureState();
  }
};

const makeId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const calculateChange = (current: number, previousPeriod: number): number | null => {
  if (previousPeriod === 0) return current === 0 ? 0 : null;
  return Number((((current - previousPeriod) / previousPeriod) * 100).toFixed(1));
};

const paginate = <T>(
  items: T[],
  pageInput?: number,
  pageSizeInput?: number,
): PaginatedResult<T> => {
  const pageSize = Math.max(1, Math.floor(pageSizeInput ?? DEFAULT_ADMIN_PAGE_SIZE));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(pageInput ?? 1)));
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
};

const normalise = (value: string): string => value.trim().toLocaleLowerCase();

const hasEntitlementExpired = (entitlement: Entitlement, now = Date.now()): boolean => {
  if (entitlement.status !== 'ACTIVE' || !entitlement.expiresAt) return false;
  const expiryTime = new Date(entitlement.expiresAt).getTime();
  return Number.isFinite(expiryTime) && expiryTime <= now;
};

const withEffectiveEntitlementStatus = (entitlement: Entitlement): Entitlement =>
  hasEntitlementExpired(entitlement)
    ? { ...entitlement, status: 'EXPIRED' }
    : entitlement;

const hasActiveEntitlement = (entitlement: Entitlement): boolean =>
  entitlement.status === 'ACTIVE' && !hasEntitlementExpired(entitlement);

export class MockAdminRepository implements AdminRepository {
  private state: AdminFixtureState;
  private readonly latencyMs: number;

  constructor(latencyMs = ADMIN_DEMO_LATENCY_MS) {
    this.latencyMs = Math.max(0, latencyMs);
    this.state = readPersistedState();
  }

  private async delayed<T>(producer: () => T): Promise<T> {
    if (this.latencyMs > 0) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, this.latencyMs));
    }
    return clone(producer());
  }

  private persist(): void {
    if (typeof window === 'undefined') return;

    try {
      const persisted: PersistedAdminState = {
        version: ADMIN_DEMO_STORAGE_VERSION,
        data: this.state,
      };
      window.localStorage.setItem(ADMIN_DEMO_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      throw new AdminRepositoryError(
        'STORAGE_ERROR',
        'The demo data could not be saved in this browser.',
      );
    }
  }

  private requireStudent(studentId: string): Student {
    const student = this.state.students.find((candidate) => candidate.id === studentId);
    if (!student) {
      throw new AdminRepositoryError('NOT_FOUND', 'Student not found.');
    }
    return student;
  }

  private toStudentListItem(student: Student): StudentListItem {
    const purchases = this.state.orders.filter(
      (order) =>
        order.buyer.studentId === student.id &&
        (order.status === 'PAID' || order.status === 'REFUNDED'),
    );
    const activeEntitlements = this.state.entitlements.filter(
      (entitlement) => entitlement.studentId === student.id && hasActiveEntitlement(entitlement),
    );

    return {
      ...clone(student),
      studyStats: {
        ...student.studyStats,
        ownedLessons: activeEntitlements.length,
      },
      purchaseCount: purchases.length,
      totalSpentMinor: purchases
        .filter((order) => order.status === 'PAID')
        .reduce((sum, order) => sum + order.amountMinor, 0),
    };
  }

  private buildStudentDetails(studentId: string): StudentDetails {
    const student = this.requireStudent(studentId);
    const newestFirst = <T extends { occurredAt: string }>(items: T[]): T[] =>
      items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

    return {
      student: this.toStudentListItem(student),
      purchases: this.state.orders
        .filter((order) => order.buyer.studentId === studentId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      entitlements: this.state.entitlements
        .filter((entitlement) => entitlement.studentId === studentId)
        .map(withEffectiveEntitlementStatus)
        .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt)),
      activity: newestFirst(
        this.state.activity.filter((activity) => activity.studentId === studentId),
      ),
      activeSessions: this.state.sessions
        .filter((session) => session.studentId === studentId)
        .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt)),
      auditEvents: newestFirst(
        this.state.auditEvents.filter((event) => event.targetStudentId === studentId),
      ),
    };
  }

  private appendActivity(activity: Activity): void {
    this.state = { ...this.state, activity: [...this.state.activity, activity] };
  }

  private appendAuditEvent(event: AuditEvent): void {
    this.state = { ...this.state, auditEvents: [...this.state.auditEvents, event] };
  }

  async getOverview(): Promise<AdminOverview> {
    return this.delayed(() => {
      const paidOrders = this.state.orders.filter((order) => order.status === 'PAID');
      const totalRevenueMinor = paidOrders.reduce((sum, order) => sum + order.amountMinor, 0);
      const today = new Date().toISOString().slice(0, 10);
      const todayRevenueMinor = paidOrders
        .filter((order) => order.paidAt?.slice(0, 10) === today)
        .reduce((sum, order) => sum + order.amountMinor, 0);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const newStudentsThisWeek = this.state.students.filter(
        (student) => new Date(student.joinedAt).getTime() >= sevenDaysAgo,
      ).length;
      const previousRevenueMinor = 29900;
      const previousStudents = Math.max(0, this.state.students.length - 2);
      const previousPaidOrders = Math.max(0, paidOrders.length - 1);
      const courseIds = new Set<string | null>([
        ...this.state.students.map((student) => student.courseId),
        ...this.state.orders.map((order) => order.courseId),
      ]);
      const courseMetrics = Array.from(courseIds).map((courseId) => {
        const courseOrders = this.state.orders.filter((order) => order.courseId === courseId);
        const paidCourseOrders = courseOrders.filter((order) => order.status === 'PAID');
        const resourceMap = new Map<string, { productId: string; title: string; revenueMinor: number; purchases: number }>();

        paidCourseOrders.forEach((order) => {
          order.items.forEach((item) => {
            const current = resourceMap.get(item.productId) ?? {
              productId: item.productId,
              title: item.title,
              revenueMinor: 0,
              purchases: 0,
            };
            current.revenueMinor += item.totalAmountMinor;
            current.purchases += item.quantity;
            resourceMap.set(item.productId, current);
          });
        });

        return {
          courseId,
          revenueMinor: paidCourseOrders.reduce((sum, order) => sum + order.amountMinor, 0),
          students: this.state.students.filter((student) => student.courseId === courseId).length,
          paidOrders: paidCourseOrders.length,
          failedOrders: courseOrders.filter((order) => order.status === 'FAILED').length,
          refundedOrders: courseOrders.filter((order) => order.status === 'REFUNDED').length,
          accessGranted: courseOrders.filter((order) => order.accessStatus === 'GRANTED').length,
          resources: Array.from(resourceMap.values()).sort((left, right) =>
            right.revenueMinor - left.revenueMinor || right.purchases - left.purchases,
          ),
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        metrics: {
          totalRevenueMinor: {
            current: totalRevenueMinor,
            previousPeriod: previousRevenueMinor,
            changePercentage: calculateChange(totalRevenueMinor, previousRevenueMinor),
          },
          students: {
            current: this.state.students.length,
            previousPeriod: previousStudents,
            changePercentage: calculateChange(this.state.students.length, previousStudents),
          },
          paidOrders: {
            current: paidOrders.length,
            previousPeriod: previousPaidOrders,
            changePercentage: calculateChange(paidOrders.length, previousPaidOrders),
          },
          todayRevenueMinor: {
            current: todayRevenueMinor,
            previousPeriod: 0,
            changePercentage: calculateChange(todayRevenueMinor, 0),
          },
          failedOrders: this.state.orders.filter((order) => order.status === 'FAILED').length,
          refundedOrders: this.state.orders.filter((order) => order.status === 'REFUNDED').length,
          newStudentsThisWeek,
        },
        revenueLast30Days: [...adminRevenueSeriesFixture],
        newStudentsLast30Days: [...adminNewStudentSeriesFixture],
        recentOrders: [...this.state.orders]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 5),
        contentCounts: { ...adminContentCountsFixture },
        courseMetrics,
      };
    });
  }

  async listStudents(query: StudentListQuery = {}): Promise<PaginatedResult<StudentListItem>> {
    return this.delayed(() => {
      const search = normalise(query.search ?? '');
      let students = this.state.students
        .map((student) => this.toStudentListItem(student))
        .filter((student) => {
          const matchesSearch =
            !search ||
            [student.fullName, student.email, student.phone ?? '', student.selectedCourse?.name ?? '']
              .some((value) => normalise(value).includes(search));
          const matchesRole = !query.role || query.role === 'ALL' || student.role === query.role;
          const matchesStatus =
            !query.status || query.status === 'ALL' || student.status === query.status;
          const matchesCourse = !query.courseId || student.courseId === query.courseId;
          return matchesSearch && matchesRole && matchesStatus && matchesCourse;
        });

      switch (query.sort) {
        case 'joined-asc':
          students = students.sort((left, right) => left.joinedAt.localeCompare(right.joinedAt));
          break;
        case 'name-asc':
          students = students.sort((left, right) => left.fullName.localeCompare(right.fullName));
          break;
        case 'spent-desc':
          students = students.sort((left, right) => right.totalSpentMinor - left.totalSpentMinor);
          break;
        case 'joined-desc':
        default:
          students = students.sort((left, right) => right.joinedAt.localeCompare(left.joinedAt));
      }

      return paginate(students, query.page, query.pageSize);
    });
  }

  async getStudent(studentId: string): Promise<StudentDetails> {
    return this.delayed(() => this.buildStudentDetails(studentId));
  }

  async listOrders(query: OrderListQuery = {}): Promise<PaginatedResult<Order>> {
    return this.delayed(() => {
      const search = normalise(query.search ?? '');
      let orders = this.state.orders.filter((order) => {
        const matchesSearch =
          !search ||
          [
            order.id,
            order.buyer.fullName,
            order.buyer.email,
            ...order.items.map((item) => item.title),
          ].some((value) => normalise(value).includes(search));
        const matchesStatus =
          !query.status || query.status === 'ALL' || order.status === query.status;
        const matchesStudent = !query.studentId || order.buyer.studentId === query.studentId;
        const matchesCourse = !query.courseId || order.courseId === query.courseId;
        return matchesSearch && matchesStatus && matchesStudent && matchesCourse;
      });

      switch (query.sort) {
        case 'date-asc':
          orders = orders.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
          break;
        case 'amount-desc':
          orders = orders.sort((left, right) => right.amountMinor - left.amountMinor);
          break;
        case 'amount-asc':
          orders = orders.sort((left, right) => left.amountMinor - right.amountMinor);
          break;
        case 'date-desc':
        default:
          orders = orders.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      }

      return paginate(orders, query.page, query.pageSize);
    });
  }

  async getOrderSummary(courseId?: string): Promise<OrderSummary> {
    return this.delayed(() => {
      const orders = this.state.orders.filter((order) => !courseId || order.courseId === courseId);
      return {
        totalOrders: orders.length,
        paidOrders: orders.filter((order) => order.status === 'PAID').length,
        failedOrders: orders.filter((order) => order.status === 'FAILED').length,
        refundedOrders: orders.filter((order) => order.status === 'REFUNDED').length,
        pendingOrders: orders.filter((order) => order.status === 'CREATED').length,
        complimentaryOrders: orders.filter((order) => order.isComplimentary).length,
        revenueMinor: orders
          .filter((order) => order.status === 'PAID' && !order.isComplimentary)
          .reduce((total, order) => total + order.amountMinor, 0),
      };
    });
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.delayed(() => {
      const order = this.state.orders.find((candidate) => candidate.id === orderId);
      if (!order) throw new AdminRepositoryError('NOT_FOUND', 'Order not found.');
      return order;
    });
  }

  async grantAccess(studentId: string, input: AccessGrantInput): Promise<StudentDetails> {
    return this.delayed(() => {
      this.requireStudent(studentId);
      const resourceId = input.resourceId.trim();
      const resourceTitle = input.resourceTitle.trim();
      const reason = input.reason.trim();
      if (!resourceId || !resourceTitle || !reason) {
        throw new AdminRepositoryError(
          'VALIDATION_ERROR',
          'Resource, title, and reason are required.',
        );
      }
      if (input.accessType === 'TIME_LIMITED') {
        const expiresAt = input.expiresAt ? new Date(input.expiresAt).getTime() : Number.NaN;
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          throw new AdminRepositoryError(
            'VALIDATION_ERROR',
            'Time-limited access requires a future expiry date.',
          );
        }
      }
      const duplicate = this.state.entitlements.some(
        (entitlement) =>
          entitlement.studentId === studentId &&
          entitlement.resourceType === input.resourceType &&
          entitlement.resourceId === resourceId &&
          hasActiveEntitlement(entitlement),
      );
      if (duplicate) {
        throw new AdminRepositoryError('CONFLICT', 'This student already has active access.');
      }

      const occurredAt = new Date().toISOString();
      const entitlement: Entitlement = {
        id: makeId('ent'),
        studentId,
        resourceType: input.resourceType,
        resourceId,
        resourceTitle,
        source: 'ADMIN_GRANT',
        sourceId: null,
        accessType: input.accessType,
        status: 'ACTIVE',
        grantedAt: occurredAt,
        expiresAt: input.accessType === 'TIME_LIMITED' ? input.expiresAt ?? null : null,
        grantedByAdminId: DEMO_SUPER_ADMIN_ID,
        reason,
        revokedAt: null,
      };
      this.state = {
        ...this.state,
        entitlements: [...this.state.entitlements, entitlement],
      };
      this.appendActivity({
        id: makeId('activity'),
        studentId,
        type: 'ACCESS_GRANTED',
        title: `${resourceTitle} unlocked`,
        description: `Manual access granted by an administrator: ${reason}`,
        occurredAt,
        metadata: { entitlementId: entitlement.id, resourceId },
      });
      this.appendAuditEvent({
        id: makeId('audit'),
        actorId: DEMO_SUPER_ADMIN_ID,
        targetStudentId: studentId,
        action: 'ACCESS_GRANTED',
        occurredAt,
        reason,
        before: null,
        after: { entitlementId: entitlement.id, resourceId, accessType: input.accessType },
      });
      this.persist();
      return this.buildStudentDetails(studentId);
    });
  }

  async updateStudentRole(
    studentId: string,
    role: StudentRole,
    reason = 'Role updated by a super administrator.',
  ): Promise<StudentDetails> {
    return this.delayed(() => {
      const student = this.requireStudent(studentId);
      if (student.role === role) return this.buildStudentDetails(studentId);
      if (
        student.role === 'SUPER_ADMIN' &&
        role !== 'SUPER_ADMIN' &&
        this.state.students.filter((candidate) => candidate.role === 'SUPER_ADMIN').length <= 1
      ) {
        throw new AdminRepositoryError('FORBIDDEN', 'The final super administrator cannot be demoted.');
      }

      const occurredAt = new Date().toISOString();
      const previousRole = student.role;
      this.state = {
        ...this.state,
        students: this.state.students.map((candidate) =>
          candidate.id === studentId ? { ...candidate, role } : candidate,
        ),
      };
      this.appendActivity({
        id: makeId('activity'),
        studentId,
        type: 'ROLE_CHANGED',
        title: 'Account role changed',
        description: `Role changed from ${previousRole} to ${role}.`,
        occurredAt,
      });
      this.appendAuditEvent({
        id: makeId('audit'),
        actorId: DEMO_SUPER_ADMIN_ID,
        targetStudentId: studentId,
        action: 'ROLE_CHANGED',
        occurredAt,
        reason: reason.trim() || 'Role updated by a super administrator.',
        before: { role: previousRole },
        after: { role },
      });
      this.persist();
      return this.buildStudentDetails(studentId);
    });
  }

  async setStudentEnabled(
    studentId: string,
    enabled: boolean,
    reason = enabled
      ? 'Account enabled by a super administrator.'
      : 'Account disabled by a super administrator.',
  ): Promise<StudentDetails> {
    return this.delayed(() => {
      const student = this.requireStudent(studentId);
      const status = enabled ? 'ACTIVE' : 'DISABLED';
      if (student.status === status) return this.buildStudentDetails(studentId);
      if (
        !enabled &&
        student.role === 'SUPER_ADMIN' &&
        this.state.students.filter(
          (candidate) => candidate.role === 'SUPER_ADMIN' && candidate.status === 'ACTIVE',
        ).length <= 1
      ) {
        throw new AdminRepositoryError(
          'FORBIDDEN',
          'The final active super administrator cannot be disabled.',
        );
      }

      const occurredAt = new Date().toISOString();
      const previousStatus = student.status;
      this.state = {
        ...this.state,
        students: this.state.students.map((candidate) =>
          candidate.id === studentId ? { ...candidate, status } : candidate,
        ),
      };
      this.appendActivity({
        id: makeId('activity'),
        studentId,
        type: enabled ? 'ACCOUNT_ENABLED' : 'ACCOUNT_DISABLED',
        title: enabled ? 'Account enabled' : 'Account disabled',
        description: reason.trim() || `Account ${enabled ? 'enabled' : 'disabled'}.`,
        occurredAt,
      });
      this.appendAuditEvent({
        id: makeId('audit'),
        actorId: DEMO_SUPER_ADMIN_ID,
        targetStudentId: studentId,
        action: enabled ? 'ACCOUNT_ENABLED' : 'ACCOUNT_DISABLED',
        occurredAt,
        reason: reason.trim() || `Account ${enabled ? 'enabled' : 'disabled'}.`,
        before: { status: previousStatus },
        after: { status },
      });
      this.persist();
      return this.buildStudentDetails(studentId);
    });
  }

  async forceLogout(
    studentId: string,
    reason = 'All active sessions revoked by a super administrator.',
  ): Promise<StudentDetails> {
    return this.delayed(() => {
      this.requireStudent(studentId);
      const revokedSessionIds = this.state.sessions
        .filter((session) => session.studentId === studentId)
        .map((session) => session.id);
      const occurredAt = new Date().toISOString();
      this.state = {
        ...this.state,
        sessions: this.state.sessions.filter((session) => session.studentId !== studentId),
      };
      this.appendActivity({
        id: makeId('activity'),
        studentId,
        type: 'FORCE_LOGOUT',
        title: 'Sessions revoked',
        description: `${revokedSessionIds.length} active session${revokedSessionIds.length === 1 ? '' : 's'} revoked.`,
        occurredAt,
        metadata: { revokedSessionCount: revokedSessionIds.length },
      });
      this.appendAuditEvent({
        id: makeId('audit'),
        actorId: DEMO_SUPER_ADMIN_ID,
        targetStudentId: studentId,
        action: 'SESSIONS_REVOKED',
        occurredAt,
        reason: reason.trim() || 'All active sessions revoked by a super administrator.',
        before: { sessionIds: revokedSessionIds },
        after: { sessionIds: [] },
      });
      this.persist();
      return this.buildStudentDetails(studentId);
    });
  }
}

export const mockAdminRepository: AdminRepository = new MockAdminRepository();
