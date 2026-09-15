import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError, setTerminalAuthFailureHandler } from './client';
import { clearSessionCredentials, getSessionCredentials, setSessionCredentials } from './credentials';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

describe('central API client', () => {
  beforeEach(() => {
    clearSessionCredentials();
    setTerminalAuthFailureHandler(null);
    vi.restoreAllMocks();
  });

  it('injects bearer, tenant, request and idempotency headers', async () => {
    setSessionCredentials({ accessToken: 'access-one', refreshToken: 'refresh-one', expiresAt: Date.now() + 1000 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ok: true }));
    await apiRequest('/api/example', { academyId: 'academy-a', idempotencyKey: 'once-1' });
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer access-one');
    expect(headers.get('x-academy-id')).toBe('academy-a');
    expect(headers.get('idempotency-key')).toBe('once-1');
    expect(headers.get('x-request-id')).toBeTruthy();
  });

  it('normalizes the backend error envelope without inventing success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'FORBIDDEN', message: 'No access', fieldErrors: { role: ['invalid'] }, requestId: 'req-1' } }, 403));
    await expect(apiRequest('/api/example', { auth: false })).rejects.toMatchObject({
      status: 403, code: 'FORBIDDEN', message: 'No access', requestId: 'req-1',
    });
  });

  it('uses one refresh request for concurrent 401 responses and retries once', async () => {
    // The client believes this token is current, while the server rejects it.
    // Both 401 responses must share one refresh and retry independently.
    setSessionCredentials({ accessToken: 'expired', refreshToken: 'rotate-me', expiresAt: Date.now() + 60_000 });
    let protectedCalls = 0;
    let refreshCalls = 0;
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/refresh')) {
        refreshCalls += 1;
        await refreshGate;
        return json({ accessToken: 'fresh', refreshToken: 'rotated', tokenType: 'Bearer', expiresIn: 900, user: { id: 'u1', email: 'u@test', fullName: 'User', role: 'student', permissions: [] } });
      }
      protectedCalls += 1;
      return protectedCalls <= 2 ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401) : json({ ok: true });
    });

    const first = apiRequest<{ ok: boolean }>('/api/protected');
    const second = apiRequest<{ ok: boolean }>('/api/protected');
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    releaseRefresh();
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(getSessionCredentials()?.accessToken).toBe('fresh');
  });

  it('clears credentials and signals terminal refresh failure', async () => {
    setSessionCredentials({ accessToken: 'expired', refreshToken: 'bad-refresh', expiresAt: 0 });
    const terminal = vi.fn();
    setTerminalAuthFailureHandler(terminal);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).endsWith('/refresh')
      ? json({ error: { code: 'REFRESH_REPLAYED', message: 'Revoked' } }, 401)
      : json({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401));
    await expect(apiRequest('/api/protected')).rejects.toBeInstanceOf(ApiError);
    expect(getSessionCredentials()).toBeNull();
    expect(terminal).toHaveBeenCalledOnce();
  });

  it('does not refresh a public login failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }, 401));
    await expect(apiRequest('/api/auth/login', { method: 'POST', auth: false, body: {} })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('refreshes an expired access token before sending a protected mutation', async () => {
    setSessionCredentials({ accessToken: 'expired', refreshToken: 'rotate-me', expiresAt: Date.now() - 1 });
    const requests: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith('/api/auth/refresh')) {
        return json({ accessToken: 'fresh', refreshToken: 'rotated', tokenType: 'Bearer', expiresIn: 900, user: { id: 'u1', email: 'admin@test', fullName: 'Admin', role: 'super_admin', permissions: ['students:manage'] } });
      }
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fresh');
      return json({ state: 'RESET_APPROVED' });
    });

    await expect(apiRequest('/api/admin/students/u1/device-reset/approve', { method: 'POST' })).resolves.toEqual({ state: 'RESET_APPROVED' });
    expect(requests).toHaveLength(2);
  });

  it('clears a stale authenticated UI session after a terminal 401', async () => {
    const terminal = vi.fn();
    setTerminalAuthFailureHandler(terminal);
    setSessionCredentials({ accessToken: 'rejected', refreshToken: 'still-present', expiresAt: Date.now() + 60_000 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401));

    await expect(apiRequest('/api/admin/students/u1/device-reset/approve', { method: 'POST', retryAfterRefresh: false })).rejects.toMatchObject({ status: 401 });
    expect(getSessionCredentials()).toBeNull();
    expect(terminal).toHaveBeenCalledTimes(1);
  });
});
