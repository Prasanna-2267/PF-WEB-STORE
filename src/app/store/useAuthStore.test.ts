import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { clearSessionCredentials, getSessionCredentials, setSessionCredentials } from '@/lib/api/credentials';
import { useAcademyTenantStore } from './useAcademyTenantStore';

const serverUser = { id: 'server-user', email: 'server@test.invalid', fullName: 'Server User', role: 'admin' as const, permissions: ['academy:manage'] };

describe('authentication store', () => {
  beforeEach(() => {
    clearSessionCredentials();
    useAuthStore.setState({ user: null, status: 'anonymous', initialized: false, isAuthenticated: false });
    vi.restoreAllMocks();
  });

  it('accepts the backend identity verbatim and stores only credentials persistently', () => {
    useAuthStore.getState().completeAuthentication({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60, tokenType: 'Bearer', user: serverUser });
    expect(useAuthStore.getState().user).toEqual(serverUser);
    expect(window.localStorage.getItem('pf_auth_token')).toBeNull();
    expect(window.localStorage.getItem('pf_session_credentials')).toContain('refresh');
    expect(window.sessionStorage.getItem('pf_session_credentials')).toBeNull();
  });

  it('restores the user from the protected server session instead of persisted profile data', async () => {
    setSessionCredentials({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: serverUser }), { status: 200 }));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState()).toMatchObject({ user: serverUser, isAuthenticated: true, initialized: true });
  });

  it('reflects a server-side role change during session restoration', async () => {
    useAuthStore.setState({ user: { ...serverUser, role: 'admin' }, status: 'anonymous', initialized: false, isAuthenticated: false });
    setSessionCredentials({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 });
    const changed = { ...serverUser, role: 'student' as const, permissions: [] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: changed }), { status: 200 }));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().user).toEqual(changed);
  });

  it('does not erase stored credentials during a temporary session restore outage', async () => {
    vi.useFakeTimers();
    setSessionCredentials({ accessToken: 'access', refreshToken: 'keep-refresh', expiresAt: Date.now() + 60_000 });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    await useAuthStore.getState().bootstrap();

    expect(getSessionCredentials()?.refreshToken).toBe('keep-refresh');
    expect(useAuthStore.getState()).toMatchObject({ status: 'restoring', initialized: false });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('clears local credentials even when server logout fails', async () => {
    useAcademyTenantStore.setState({ activeAcademyId: 'academy-a', status: 'ready' });
    useAuthStore.getState().completeAuthentication({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 60, tokenType: 'Bearer', user: serverUser });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await useAuthStore.getState().logout();
    expect(getSessionCredentials()).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, status: 'anonymous' });
    expect(useAcademyTenantStore.getState()).toMatchObject({ activeAcademyId: null, status: 'idle' });
  });
});
