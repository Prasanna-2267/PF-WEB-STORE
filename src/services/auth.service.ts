import { apiRequest } from '@/lib/api/client';
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

export interface PasswordResetChallenge {
  challengeId: string;
  expiresAt: string;
}

export interface ConfirmPasswordResetInput {
  challengeId: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
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

  requestPasswordReset(email: string): Promise<PasswordResetChallenge> {
    return apiRequest('/api/auth/password-reset/request', { method: 'POST', auth: false, body: { email: email.trim() } });
  },

  confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<{ changed: true; sessionsRevoked: true }> {
    return apiRequest('/api/auth/password-reset/confirm', { method: 'POST', auth: false, body: input });
  },

  async logout(): Promise<void> {
    await apiRequest('/api/auth/logout', { method: 'POST', retryAfterRefresh: false });
  },
};
