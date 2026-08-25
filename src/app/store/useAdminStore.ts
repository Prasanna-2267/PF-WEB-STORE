import { create } from 'zustand';
import { mockAdminRepository } from '@/features/admin/api/mockAdminRepository';
import type { AdminRepository } from '@/features/admin/api/adminRepository';
import type {
  AccessGrantInput,
  AdminFeedback,
  AdminOverview,
  Order,
  OrderListQuery,
  OrderSummary,
  PaginatedResult,
  StudentDetails,
  StudentListItem,
  StudentListQuery,
  StudentRole,
} from '@/features/admin/types/admin';

export type AdminLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AdminPendingActionType =
  | 'grant-access'
  | 'update-role'
  | 'enable-account'
  | 'disable-account'
  | 'force-logout';

export interface AdminPendingAction {
  type: AdminPendingActionType;
  studentId: string;
}

export interface AdminState {
  initialized: boolean;
  overviewStatus: AdminLoadStatus;
  studentsStatus: AdminLoadStatus;
  studentStatus: AdminLoadStatus;
  ordersStatus: AdminLoadStatus;
  orderSummaryStatus: AdminLoadStatus;
  orderStatus: AdminLoadStatus;
  overview: AdminOverview | null;
  studentsPage: PaginatedResult<StudentListItem> | null;
  ordersPage: PaginatedResult<Order> | null;
  orderSummary: OrderSummary | null;
  selectedStudent: StudentDetails | null;
  selectedOrder: Order | null;
  studentQuery: StudentListQuery;
  orderQuery: OrderListQuery;
  pendingAction: AdminPendingAction | null;
  overviewError: string | null;
  studentsError: string | null;
  studentError: string | null;
  ordersError: string | null;
  orderSummaryError: string | null;
  orderError: string | null;
  feedback: AdminFeedback | null;
  initialize: () => Promise<void>;
  loadOverview: () => Promise<void>;
  loadStudents: (query?: StudentListQuery) => Promise<void>;
  loadStudent: (studentId: string) => Promise<void>;
  clearSelectedStudent: () => void;
  loadOrders: (query?: OrderListQuery) => Promise<void>;
  loadOrderSummary: (courseId?: string) => Promise<void>;
  loadOrder: (orderId: string) => Promise<void>;
  clearSelectedOrder: () => void;
  grantAccess: (studentId: string, input: AccessGrantInput) => Promise<StudentDetails | null>;
  updateStudentRole: (
    studentId: string,
    role: StudentRole,
    reason?: string,
  ) => Promise<StudentDetails | null>;
  setStudentEnabled: (
    studentId: string,
    enabled: boolean,
    reason?: string,
  ) => Promise<StudentDetails | null>;
  forceLogout: (studentId: string, reason?: string) => Promise<StudentDetails | null>;
  clearFeedback: () => void;
  reset: () => void;
}

const initialStudentQuery: StudentListQuery = {
  page: 1,
  pageSize: 10,
  role: 'ALL',
  status: 'ALL',
  sort: 'joined-desc',
};

const initialOrderQuery: OrderListQuery = {
  page: 1,
  pageSize: 10,
  status: 'ALL',
  sort: 'date-desc',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

/** Creates the admin store against any repository adapter, which keeps UI state testable. */
export const createAdminStore = (repository: AdminRepository = mockAdminRepository) =>
  create<AdminState>((set, get) => {
    let overviewRequestId = 0;
    let studentsRequestId = 0;
    let studentRequestId = 0;
    let ordersRequestId = 0;
    let orderSummaryRequestId = 0;
    let orderRequestId = 0;

    const runStudentMutation = async (
      pendingAction: AdminPendingAction,
      operation: () => Promise<StudentDetails>,
      successMessage: string,
    ): Promise<StudentDetails | null> => {
      set({ pendingAction, feedback: null });

      try {
        const details = await operation();
        const currentQuery = get().studentQuery;
        const currentStudentsRequest = ++studentsRequestId;
        const currentOverviewRequest = ++overviewRequestId;
        set((state) => ({
          pendingAction: null,
          selectedStudent:
            state.selectedStudent?.student.id === details.student.id
              ? details
              : state.selectedStudent,
          feedback: { kind: 'success', message: successMessage },
        }));

        // A successful mutation should never be presented as a failure just because a
        // non-critical follow-up refresh fails. Refresh the related summaries in the
        // background and only commit responses that are still current.
        void Promise.allSettled([
          repository.listStudents(currentQuery),
          repository.getOverview(),
        ]).then(([studentsResult, overviewResult]) => {
          set((state) => ({
            ...(studentsResult.status === 'fulfilled' && currentStudentsRequest === studentsRequestId
              ? {
                  studentsPage: studentsResult.value,
                  studentsStatus: 'ready' as AdminLoadStatus,
                  studentsError: null,
                }
              : {}),
            ...(overviewResult.status === 'fulfilled' && currentOverviewRequest === overviewRequestId
              ? {
                  overview: overviewResult.value,
                  overviewStatus: 'ready' as AdminLoadStatus,
                  overviewError: null,
                }
              : {}),
            feedback: state.feedback,
          }));
        });
        return details;
      } catch (error) {
        const message = errorMessage(error);
        set({
          pendingAction: null,
          feedback: { kind: 'error', message },
        });
        return null;
      }
    };

    return {
      initialized: false,
      overviewStatus: 'idle',
      studentsStatus: 'idle',
      studentStatus: 'idle',
      ordersStatus: 'idle',
      orderSummaryStatus: 'idle',
      orderStatus: 'idle',
      overview: null,
      studentsPage: null,
      ordersPage: null,
      orderSummary: null,
      selectedStudent: null,
      selectedOrder: null,
      studentQuery: initialStudentQuery,
      orderQuery: initialOrderQuery,
      pendingAction: null,
      overviewError: null,
      studentsError: null,
      studentError: null,
      ordersError: null,
      orderSummaryError: null,
      orderError: null,
      feedback: null,

      initialize: async () => {
        if (get().initialized) return;
        set({ initialized: true, feedback: null });
        await Promise.all([
          get().loadOverview(),
          get().loadStudents(),
          get().loadOrders(),
        ]);
      },

      loadOverview: async () => {
        const requestId = ++overviewRequestId;
        set({ overviewStatus: 'loading', overviewError: null });
        try {
          const overview = await repository.getOverview();
          if (requestId !== overviewRequestId) return;
          set({ overviewStatus: 'ready', overview, overviewError: null });
        } catch (error) {
          if (requestId !== overviewRequestId) return;
          const message = errorMessage(error);
          set({ overviewStatus: 'error', overviewError: message, feedback: { kind: 'error', message } });
        }
      },

      loadStudents: async (query = {}) => {
        const requestId = ++studentsRequestId;
        const nextQuery = { ...get().studentQuery, ...query };
        set({ studentsStatus: 'loading', studentQuery: nextQuery, studentsError: null });
        try {
          const studentsPage = await repository.listStudents(nextQuery);
          if (requestId !== studentsRequestId) return;
          set({ studentsStatus: 'ready', studentsPage, studentsError: null });
        } catch (error) {
          if (requestId !== studentsRequestId) return;
          const message = errorMessage(error);
          set({ studentsStatus: 'error', studentsError: message, feedback: { kind: 'error', message } });
        }
      },

      loadStudent: async (studentId) => {
        const requestId = ++studentRequestId;
        set({ studentStatus: 'loading', selectedStudent: null, studentError: null });
        try {
          const selectedStudent = await repository.getStudent(studentId);
          if (requestId !== studentRequestId) return;
          set({ studentStatus: 'ready', selectedStudent, studentError: null });
        } catch (error) {
          if (requestId !== studentRequestId) return;
          const message = errorMessage(error);
          set({ studentStatus: 'error', studentError: message, feedback: { kind: 'error', message } });
        }
      },

      clearSelectedStudent: () => {
        studentRequestId += 1;
        set({ selectedStudent: null, studentStatus: 'idle', studentError: null });
      },

      loadOrders: async (query = {}) => {
        const requestId = ++ordersRequestId;
        const currentState = get();
        const nextQuery = { ...currentState.orderQuery, ...query };
        const courseChanged = nextQuery.courseId !== currentState.orderQuery.courseId;
        set({
          ordersStatus: 'loading',
          orderQuery: nextQuery,
          ordersPage: courseChanged ? null : currentState.ordersPage,
          ordersError: null,
        });
        try {
          const ordersPage = await repository.listOrders(nextQuery);
          if (requestId !== ordersRequestId) return;
          set({ ordersStatus: 'ready', ordersPage, ordersError: null });
        } catch (error) {
          if (requestId !== ordersRequestId) return;
          const message = errorMessage(error);
          set({ ordersStatus: 'error', ordersError: message, feedback: { kind: 'error', message } });
        }
      },

      loadOrderSummary: async (courseId) => {
        const requestId = ++orderSummaryRequestId;
        set({ orderSummaryStatus: 'loading', orderSummary: null, orderSummaryError: null });
        try {
          const orderSummary = await repository.getOrderSummary(courseId);
          if (requestId !== orderSummaryRequestId) return;
          set({ orderSummaryStatus: 'ready', orderSummary, orderSummaryError: null });
        } catch (error) {
          if (requestId !== orderSummaryRequestId) return;
          set({
            orderSummaryStatus: 'error',
            orderSummaryError: errorMessage(error),
          });
        }
      },

      loadOrder: async (orderId) => {
        const requestId = ++orderRequestId;
        set({ orderStatus: 'loading', selectedOrder: null, orderError: null });
        try {
          const selectedOrder = await repository.getOrder(orderId);
          if (requestId !== orderRequestId) return;
          set({ orderStatus: 'ready', selectedOrder, orderError: null });
        } catch (error) {
          if (requestId !== orderRequestId) return;
          const message = errorMessage(error);
          set({ orderStatus: 'error', orderError: message, feedback: { kind: 'error', message } });
        }
      },

      clearSelectedOrder: () => {
        orderRequestId += 1;
        set({ selectedOrder: null, orderStatus: 'idle', orderError: null });
      },

      grantAccess: (studentId, input) =>
        runStudentMutation(
          { type: 'grant-access', studentId },
          () => repository.grantAccess(studentId, input),
          `${input.resourceTitle} has been added to the student's library.`,
        ),

      updateStudentRole: (studentId, role, reason) =>
        runStudentMutation(
          { type: 'update-role', studentId },
          () => repository.updateStudentRole(studentId, role, reason),
          `Student role updated to ${role.replace('_', ' ').toLocaleLowerCase()}.`,
        ),

      setStudentEnabled: (studentId, enabled, reason) =>
        runStudentMutation(
          { type: enabled ? 'enable-account' : 'disable-account', studentId },
          () => repository.setStudentEnabled(studentId, enabled, reason),
          enabled ? 'Student account enabled.' : 'Student account disabled.',
        ),

      forceLogout: (studentId, reason) =>
        runStudentMutation(
          { type: 'force-logout', studentId },
          () => repository.forceLogout(studentId, reason),
          'All active sessions have been revoked.',
        ),

      clearFeedback: () => set({ feedback: null }),
      reset: () => {
        overviewRequestId += 1;
        studentsRequestId += 1;
        studentRequestId += 1;
        ordersRequestId += 1;
        orderRequestId += 1;
        set({
          initialized: false,
          overviewStatus: 'idle',
          studentsStatus: 'idle',
          studentStatus: 'idle',
          ordersStatus: 'idle',
          orderSummaryStatus: 'idle',
          orderStatus: 'idle',
          overview: null,
          studentsPage: null,
          ordersPage: null,
          orderSummary: null,
          selectedStudent: null,
          selectedOrder: null,
          studentQuery: initialStudentQuery,
          orderQuery: initialOrderQuery,
          pendingAction: null,
          overviewError: null,
          studentsError: null,
          studentError: null,
          ordersError: null,
          orderSummaryError: null,
          orderError: null,
          feedback: null,
        });
      },
    };
  });

export const useAdminStore = createAdminStore();

export const selectAdminStudents = (state: AdminState): StudentListItem[] =>
  state.studentsPage?.items ?? [];

export const selectAdminOrders = (state: AdminState): Order[] =>
  state.ordersPage?.items ?? [];

export const selectIsAdminBusy = (state: AdminState): boolean =>
  state.pendingAction !== null || [
    state.overviewStatus,
    state.studentsStatus,
    state.studentStatus,
    state.ordersStatus,
    state.orderStatus,
  ].includes('loading');
