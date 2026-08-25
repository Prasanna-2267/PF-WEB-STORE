import { create } from 'zustand';
import { apiRequest, ApiError } from '@/lib/api/client';
import type { AcademyContext, AcademyOverview } from '@/lib/api/contracts';
import type { AcademyTenantInfo } from '@/features/academy/types/academyTenant';
import { queryClient } from '@/lib/queryClient';

type TenantStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AcademyTenantStore {
  context: AcademyContext | null;
  activeAcademyId: string | null;
  activeAcademy: AcademyTenantInfo | null;
  activeRole: string | null;
  status: TenantStatus;
  errorCode: string | null;
  errorMessage: string | null;
  resolveContext: () => Promise<void>;
  updateFromOverview: (overview: AcademyOverview) => void;
  updateActiveAcademyProfile: (updated: Partial<AcademyTenantInfo>) => void;
  clearTenantState: () => void;
}

const emptyState = {
  context: null,
  activeAcademyId: null,
  activeAcademy: null,
  activeRole: null,
  status: 'idle' as TenantStatus,
  errorCode: null,
  errorMessage: null,
};

export const useAcademyTenantStore = create<AcademyTenantStore>((set, get) => ({
  ...emptyState,

  resolveContext: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', errorCode: null, errorMessage: null });
    try {
      // No x-academy-id is invented here. The backend resolves the sole authorized
      // membership or rejects ambiguous/missing context.
      const context = await apiRequest<AcademyContext>('/api/academy/context');
      set({
        context,
        activeAcademyId: context.academyId,
        activeRole: context.roleInAcademy,
        status: 'ready',
      });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      set({
        ...emptyState,
        status: 'error',
        errorCode: apiError?.code ?? 'TENANT_CONTEXT_FAILED',
        errorMessage: apiError?.message ?? 'Unable to resolve an authorized Academy context.',
      });
    }
  },

  updateFromOverview: ({ academy, metrics }) => set((state) => {
    if (state.activeAcademyId !== academy.id) return state;
    return {
      activeAcademy: {
        id: academy.id,
        slug: academy.slug,
        name: academy.name,
        email: academy.email,
        phone: academy.phone ?? '',
        address: '', city: '', state: '', country: '', postalCode: '',
        status: academy.status as AcademyTenantInfo['status'],
        adminName: '', adminEmail: '',
        studentCount: metrics.studentCount,
        activeStudentCount: metrics.activeStudentCount,
        courseCount: metrics.courseCount,
        activeCourseCount: metrics.courseCount,
        createdAt: '',
      },
    };
  }),

  updateActiveAcademyProfile: (updated) => set((state) => ({
    activeAcademy: state.activeAcademy ? { ...state.activeAcademy, ...updated } : null,
  })),

  clearTenantState: () => {
    queryClient.removeQueries({ queryKey: ['academy'] });
    set(emptyState);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('pf:session-cleared', () => useAcademyTenantStore.getState().clearTenantState());
}
