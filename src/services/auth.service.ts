import { UserProfile } from '@/app/store/useAuthStore';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

// Mock API service layer for authentication
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await new Promise((res) => setTimeout(res, 700));
    
    if (credentials.email === 'error@parallaxflow.com') {
      throw new Error('Invalid email credentials or account suspended.');
    }

    return {
      token: `pf-jwt-${Math.random().toString(36).substr(2, 9)}`,
      user: {
        id: 'user-101',
        email: credentials.email,
        fullName: credentials.email.split('@')[0].toUpperCase().replace('.', ' '),
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        androidAppConnected: true,
        role: 'student',
        purchasedNoteIds: ['financial-reporting-intermediate'],
        enrolledCourse: {
          id: 'course-ca-intermediate',
          slug: 'ca-intermediate',
          name: 'CA Intermediate',
        },
        subscription: 'Premium',
      },
    };
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await new Promise((res) => setTimeout(res, 800));

    return {
      token: `pf-jwt-reg-${Math.random().toString(36).substr(2, 9)}`,
      user: {
        id: `user-${Date.now()}`,
        email: credentials.email,
        fullName: credentials.fullName,
        androidAppConnected: false,
        role: 'student',
        purchasedNoteIds: [],
        enrolledCourse: {
          id: 'course-ca-intermediate',
          slug: 'ca-intermediate',
          name: 'CA Intermediate',
        },
        subscription: 'Free',
      },
    };
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    await new Promise((res) => setTimeout(res, 600));
    return {
      success: true,
      message: `Password reset instructions sent to ${email}`,
    };
  },

  async logout(): Promise<void> {
    await new Promise((res) => setTimeout(res, 200));
  },
};
