import { apiRequest, ApiError } from '@/lib/api/client';
import type { AuthResult, SessionResult } from '@/lib/api/contracts';

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

export const authService = {
  googleLogin(idToken: string): Promise<AuthResult> {
    return apiRequest('/api/auth/google', { method: 'POST', auth: false, body: { idToken } });
  },

  login(credentials: LoginCredentials): Promise<AuthResult> {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: credentials.email.trim(), password: credentials.password },
    });
  },

  register(credentials: RegisterCredentials): Promise<AuthResult> {
    return apiRequest('/api/auth/register', { method: 'POST', auth: false, body: credentials });
  },

  session(signal?: AbortSignal): Promise<SessionResult> {
    return apiRequest('/api/auth/session', { method: 'GET', signal });
  },

  async requestPasswordReset(_email?: string): Promise<never> {
    throw new ApiError('Password reset is not available from the server yet. Contact support for account recovery.', 501, 'FEATURE_NOT_AVAILABLE');
  },

  async logout(): Promise<void> {
    await apiRequest('/api/auth/logout', { method: 'POST', retryAfterRefresh: false });
  },
};
