import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth.service';
import { clearSessionCredentials } from '@/lib/api/credentials';

const user = { id: 'user-1', email: 'user@test.invalid', fullName: 'Server User', role: 'student', permissions: [] };
const result = { accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer', expiresIn: 900, user };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('server authentication adapter', () => {
  beforeEach(() => { clearSessionCredentials(); vi.restoreAllMocks(); });

  it('returns the authoritative login response unchanged', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(result));
    await expect(authService.login({ email: ' USER@test.invalid ', password: 'correct-password' })).resolves.toEqual(result);
  });

  it.each([
    [401, 'INVALID_CREDENTIALS', 'Invalid credentials'],
    [422, 'VALIDATION_FAILED', 'Password is invalid'],
  ])('preserves a %i authentication failure instead of creating a local session', async (status, code, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ error: { code, message } }, status));
    await expect(authService.login({ email: 'user@test.invalid', password: 'bad' })).rejects.toMatchObject({ status, code, message });
  });

  it('preserves registration-disabled 503 instead of fabricating an account', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ error: { code: 'REGISTRATION_DISABLED', message: 'Registration is disabled' } }, 503));
    await expect(authService.register({ fullName: 'User Name', email: 'user@test.invalid', password: 'valid-password' })).rejects.toMatchObject({ status: 503, code: 'REGISTRATION_DISABLED' });
  });

  it('sends a Google ID token to the backend without decoding it locally', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(result));
    await authService.googleLogin('google-id-token-from-provider');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/google');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ idToken: 'google-id-token-from-provider' });
  });

  it('uses the real password-reset request and confirmation endpoints', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ challengeId: 'challenge-1', expiresAt: '2026-10-19T12:00:00.000Z' }))
      .mockResolvedValueOnce(response({ changed: true, sessionsRevoked: true }));
    await expect(authService.requestPasswordReset(' user@test.invalid ')).resolves.toMatchObject({ challengeId: 'challenge-1' });
    await expect(authService.confirmPasswordReset({
      challengeId: 'challenge-1',
      code: '1234',
      newPassword: 'secure-password-123',
      confirmPassword: 'secure-password-123',
    })).resolves.toEqual({ changed: true, sessionsRevoked: true });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/password-reset/request');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/password-reset/confirm');
  });
});
