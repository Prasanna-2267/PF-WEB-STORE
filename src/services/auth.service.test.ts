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

  it('does not fabricate password-reset success while the backend route is absent', async () => {
    await expect(authService.requestPasswordReset('user@test.invalid')).rejects.toMatchObject({ code: 'FEATURE_NOT_AVAILABLE', status: 501 });
  });
});
