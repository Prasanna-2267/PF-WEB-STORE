import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcademyTenantStore } from './useAcademyTenantStore';
import * as api from '@/lib/api/client';

describe('Academy tenant context store', () => {
  beforeEach(() => { useAcademyTenantStore.getState().clearTenantState(); vi.restoreAllMocks(); });

  it('caches only the Academy context returned by the backend', async () => {
    const request = vi.spyOn(api, 'apiRequest').mockResolvedValue({ academyId: 'academy-owned', roleInAcademy: 'ACADEMY_ADMIN', membershipId: 'membership-1', permissions: ['academy:manage'] });
    await useAcademyTenantStore.getState().resolveContext();
    expect(request).toHaveBeenCalledWith('/api/academy/context');
    expect(useAcademyTenantStore.getState()).toMatchObject({ activeAcademyId: 'academy-owned', activeRole: 'ACADEMY_ADMIN', status: 'ready' });
  });

  it.each([
    ['ACADEMY_ADMIN_SINGLE_TENANT_REQUIRED', 409],
    ['ACADEMY_ACCESS_DENIED', 403],
  ])('fails closed for %s and does not retain a foreign Academy', async (code, status) => {
    vi.spyOn(api, 'apiRequest').mockRejectedValue(new api.ApiError('Denied by server', status, code));
    useAcademyTenantStore.setState({ activeAcademyId: 'foreign-academy' });
    await useAcademyTenantStore.getState().resolveContext();
    expect(useAcademyTenantStore.getState()).toMatchObject({ activeAcademyId: null, context: null, status: 'error', errorCode: code });
  });

  it('exposes no arbitrary Academy switch action', () => {
    expect(useAcademyTenantStore.getState()).not.toHaveProperty('setActiveAcademyId');
    expect(useAcademyTenantStore.getState()).not.toHaveProperty('resolveStudentAcademyMembership');
  });
});
