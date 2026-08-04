import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { APP_CONSTANTS } from '@/config/constants';

export interface EnrolledCourse {
  id: string;
  slug: string;
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  androidAppConnected: boolean;
  role: 'student' | 'admin';
  purchasedNoteIds: string[];
  enrolledCourse?: EnrolledCourse;
  subscription?: 'Free' | 'Premium';
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  updateUser: (data: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token: string, user: UserProfile) => {
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },
      updateUser: (data: Partial<UserProfile>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },
    }),
    {
      name: APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN,
    }
  )
);
