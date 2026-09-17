import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import { clearSessionCredentials, getSessionCredentials, setSessionCredentials } from '@/lib/api/credentials';
import { ApiError, setTerminalAuthFailureHandler } from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import type { AuthResult, AuthUser, UserRole } from '@/lib/api/contracts';

export type { UserRole } from '@/lib/api/contracts';
export type AdminPermission = string;

export interface EnrolledCourse {
  id: string;
  slug: string;
  name: string;
}

/** Identity and authorization fields are always copied verbatim from the API. */
export interface UserProfile extends AuthUser {
  avatarUrl?: string;
  purchasedNoteIds?: string[];
  enrolledCourse?: EnrolledCourse;
  subscription?: 'Free' | 'Premium';
}

export const isAuthorizedSuperAdmin = (user: UserProfile | null | undefined): boolean =>
  user?.role === 'super_admin' && user.permissions.includes('overview:read');

type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';
let bootstrapRetryTimer: number | null = null;

function cancelBootstrapRetry(): void {
  if (bootstrapRetryTimer !== null && typeof window !== 'undefined') window.clearTimeout(bootstrapRetryTimer);
  bootstrapRetryTimer = null;
}

interface AuthState {
  user: UserProfile | null;
  status: AuthStatus;
  initialized: boolean;
  isAuthenticated: boolean;
  completeAuthentication: (result: AuthResult) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Pick<Partial<UserProfile>, 'fullName' | 'avatarUrl'>) => void;
}

function clearLocalSession(): void {
  cancelBootstrapRetry();
  clearSessionCredentials();
  queryClient.clear();
  useAuthStore.setState({ user: null, status: 'anonymous', initialized: true, isAuthenticated: false });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('pf_auth_token');
    window.localStorage.removeItem('pf_academy_tenant_identity_store');
    [
      'pf_admin_course_context_v1', 'pf_admin_courses_v1', 'pf_admin_question_taxonomy_v1',
      'pf_admin_broadcasts_v1', 'pf_admin_question_bank_v2', 'pf_admin_coupons_v1',
      'pf_admin_demo_repository_v1', 'pf_admin_content_v1', 'pf_admin_packages_v1',
      'pf_admin_academies_v1',
    ].forEach((key) => window.localStorage.removeItem(key));
    window.dispatchEvent(new CustomEvent('pf:session-cleared'));
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'restoring',
  initialized: false,
  isAuthenticated: false,

  completeAuthentication: (result) => {
    cancelBootstrapRetry();
    setSessionCredentials({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
    });
    queryClient.clear();
    set({ user: result.user, status: 'authenticated', initialized: true, isAuthenticated: true });
  },

  bootstrap: async () => {
    if (useAuthStore.getState().initialized) return;
    if (!getSessionCredentials()) {
      set({ user: null, status: 'anonymous', initialized: true, isAuthenticated: false });
      return;
    }
    set({ status: 'restoring' });
    try {
      const { user } = await authService.session();
      set({ user, status: 'authenticated', initialized: true, isAuthenticated: true });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearLocalSession();
        return;
      }
      set({ status: 'restoring', initialized: false });
      if (typeof window !== 'undefined' && bootstrapRetryTimer === null) {
        bootstrapRetryTimer = window.setTimeout(() => {
          bootstrapRetryTimer = null;
          void useAuthStore.getState().bootstrap();
        }, 15_000);
      }
    }
  },

  logout: async () => {
    try {
      if (getSessionCredentials()?.accessToken) await authService.logout();
    } catch {
      // Local revocation is mandatory even when the server is unavailable.
    } finally {
      clearLocalSession();
    }
  },

  updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
}));

setTerminalAuthFailureHandler(clearLocalSession);

export function isRole(user: UserProfile | null, role: UserRole): boolean {
  return user?.role === role;
}
