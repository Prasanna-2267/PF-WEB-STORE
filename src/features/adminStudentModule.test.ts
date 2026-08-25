import { describe, expect, it, vi } from 'vitest';
import {
  fetchAdminEntitlements,
  fetchAdminEntitlementResources,
  fetchAdminStudent,
  fetchAdminStudents,
  mutateGrantEntitlement,
  mutateRevokeAdminStudentSessions,
  mutateRevokeEntitlement,
} from './admin/readOnly/adminReadOnlyApi';

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
  queryString: vi.fn((params: Record<string, unknown>) =>
    Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&'),
  ),
}));

import { apiRequest } from '@/lib/api/client';

describe('Super Admin Student Module API Client', () => {
  it('fetchAdminStudents calls /api/admin/students with pagination and filters', async () => {
    const mockResponse = {
      data: [
        {
          id: 'user-1',
          fullName: 'Test Student',
          email: 'student@test.com',
          phone: '9876543210',
          status: 'ACTIVE',
          createdAt: '2026-08-20T00:00:00.000Z',
          lastLoginAt: '2026-08-22T10:00:00.000Z',
          role: { key: 'student', name: 'Student' },
        },
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockResponse);

    const result = await fetchAdminStudents({ page: 1, limit: 25, status: 'ACTIVE', search: 'Test' });

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/students?page=1&limit=25&search=Test&status=ACTIVE&role=student', expect.any(Object));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Test Student');
    expect(result.items[0].email).toBe('student@test.com');
  });

  it('fetchAdminStudent calls /api/admin/students/:userId and adapts detail DTO', async () => {
    const mockDetailResponse = {
      id: 'user-1',
      fullName: 'Test Student',
      email: 'student@test.com',
      phone: '9876543210',
      status: 'ACTIVE',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastLoginAt: '2026-08-22T10:00:00.000Z',
      role: {
        key: 'student',
        name: 'Student',
        rolePermissions: [{ permission: { key: 'courses:read' } }],
      },
      sessions: [
        {
          id: 'session-1',
          deviceName: 'Chrome Windows',
          platform: 'Desktop',
          createdAt: '2026-08-22T00:00:00.000Z',
          lastSeenAt: '2026-08-22T10:00:00.000Z',
          expiresAt: '2026-09-01T00:00:00.000Z',
          revokedAt: null,
        },
      ],
      academyMemberships: [
        {
          id: 'mem-1',
          academyId: 'academy-1',
          role: 'STUDENT',
          status: 'ACTIVE',
          academy: { name: 'Academy Alpha', slug: 'academy-alpha' },
        },
      ],
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockDetailResponse);

    const result = await fetchAdminStudent('user-1');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/students/user-1', expect.any(Object));
    expect(result.id).toBe('user-1');
    expect(result.memberships).toHaveLength(1);
    expect(result.memberships[0].academyName).toBe('Academy Alpha');
    expect(result.sessions).toHaveLength(1);
  });

  it('mutateRevokeAdminStudentSessions calls POST /api/admin/students/:userId/sessions/revoke', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ revokedSessions: 3 });

    const result = await mutateRevokeAdminStudentSessions('user-1');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/students/user-1/sessions/revoke', {
      method: 'POST',
    });
    expect(result.revokedSessions).toBe(3);
  });

  it('fetchAdminEntitlements calls GET /api/admin/entitlements?userId=:userId', async () => {
    const mockEntitlements = {
      data: [
        {
          id: 'ent-1',
          userId: 'user-1',
          resourceType: 'COURSE',
          resourceTitle: 'CA Foundation Full Access',
          accessType: 'PERMANENT',
          status: 'ACTIVE',
          grantedAt: '2026-08-20T00:00:00.000Z',
          expiresAt: null,
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockEntitlements);

    const result = await fetchAdminEntitlements('user-1');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/entitlements?userId=user-1', expect.any(Object));
    expect(result).toHaveLength(1);
    expect(result[0].resourceTitle).toBe('CA Foundation Full Access');
  });

  it('mutateGrantEntitlement calls POST /api/admin/entitlements with body', async () => {
    const grantInput = {
      userId: 'user-1',
      resourceType: 'COURSE' as const,
      resourceTitle: 'CA Foundation Full Access',
      accessType: 'PERMANENT' as const,
      reason: 'Manual grant by Super Admin',
    };

    vi.mocked(apiRequest).mockResolvedValueOnce({
      id: 'ent-1',
      ...grantInput,
      status: 'ACTIVE',
      grantedAt: '2026-08-23T00:00:00.000Z',
      expiresAt: null,
    });

    const result = await mutateGrantEntitlement(grantInput);

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/entitlements', {
      method: 'POST',
      body: grantInput,
    });
    expect(result.id).toBe('ent-1');
  });

  it('mutateRevokeEntitlement calls POST /api/admin/entitlements/:id/revoke', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'ent-1', status: 'REVOKED' });

    const result = await mutateRevokeEntitlement('ent-1', 'Super Admin revocation');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/entitlements/ent-1/revoke', {
      method: 'POST',
      body: { reason: 'Super Admin revocation' },
    });
    expect(result.status).toBe('REVOKED');
  });

  it('fetchAdminEntitlementResources loads database-backed options for the selected type', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: [{ id: 'course-1', resourceType: 'COURSE', title: 'CA Foundation', subtitle: 'CAF · Academy A' }],
    });

    const result = await fetchAdminEntitlementResources('COURSE');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/entitlement-resources?resourceType=COURSE&limit=100', expect.any(Object));
    expect(result).toEqual([{ id: 'course-1', resourceType: 'COURSE', title: 'CA Foundation', subtitle: 'CAF · Academy A' }]);
  });
});
