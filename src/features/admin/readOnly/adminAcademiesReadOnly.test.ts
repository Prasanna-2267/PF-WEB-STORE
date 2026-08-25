import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  apiRequest: apiRequestMock,
}));

import { adminReadOnlyKeys, fetchAdminAcademies, fetchAdminAcademy, fetchAdminAcademyDetailResource } from './adminReadOnlyApi';

const academy = { id: 'academy-a', slug: 'alpha', name: 'Alpha Academy', email: 'alpha@example.test', phone: '1234567', address: '1 Main St', city: 'Chennai', state: 'Tamil Nadu', country: 'India', postalCode: '600001', website: '', description: '', logoUrl: null, status: 'ACTIVE', adminName: 'Admin', adminEmail: 'admin@example.test', adminPhone: '', studentCount: 2, activeStudentCount: 1, courseCount: 3, activeCourseCount: 2, packageCount: 0, orderCount: 0, revenue: '0.00', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z', deletedAt: null, _count: { memberships: 2, tenantCourses: 3 } };
const pagination = { page: 1, limit: 25, total: 1, totalPages: 1 };

describe('Super Admin Academies read-only contract', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('adapts server-owned Academy fields and counts', async () => {
    apiRequestMock.mockResolvedValue({ data: [academy], pagination });
    await expect(fetchAdminAcademies({ page: 1, limit: 25 })).resolves.toEqual({ items: [expect.objectContaining({ id: 'academy-a', membershipCount: 2, tenantCourseCount: 3, revenue: 0 })], pagination });
  });

  it('sends server pagination', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAdminAcademies({ page: 2, limit: 10 });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/academies?page=2&limit=10');
  });

  it('sends supported search and status filters', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAdminAcademies({ page: 1, limit: 25, search: ' alpha ', status: 'SUSPENDED' });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/academies?page=1&limit=25&search=alpha&status=SUSPENDED');
  });

  it('preserves an empty server response', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } });
    await expect(fetchAdminAcademies({ page: 1, limit: 25 })).resolves.toMatchObject({ items: [] });
  });

  it('includes authenticated user identity in Academy list keys', () => {
    const filters = { page: 1, limit: 25 };
    expect(adminReadOnlyKeys.academies('admin-a', filters)).not.toEqual(adminReadOnlyKeys.academies('admin-b', filters));
  });

  it('queries a paginated academy-scoped resource rather than a copied client list', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAdminAcademyDetailResource('academy-a', 'content', 3);
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/academies/academy-a/content?page=3&limit=25');
    expect(adminReadOnlyKeys.academyResource('admin-a', 'academy-a', 'content', 3))
      .not.toEqual(adminReadOnlyKeys.academyResource('admin-b', 'academy-a', 'content', 3));
  });

  it('adapts database-owned detail metrics and administrator identity without fake activity', async () => {
    apiRequestMock.mockResolvedValue({
      ...academy,
      metrics: { studentsCount: 2, activeStudentsCount: 1, coursesCount: 3, publishedCoursesCount: 2, contentCount: 4, publishedContentCount: 4, packagesCount: 0, questionsCount: 5, broadcastCount: 2, activeBroadcastCount: 1, auditLogCount: 7, ordersCount: 0, revenue: 0 },
      administrator: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', phone: null, identityStatus: 'ACTIVE', membershipStatus: 'ACTIVE' },
      memberships: [{ id: 'membership-1', academyId: 'academy-a', userId: 'student-1', role: 'ACADEMY_STUDENT', status: 'ACTIVE', joinedAt: academy.createdAt, user: { id: 'student-1', email: 'student@example.test', fullName: 'Dev Rao', status: 'ACTIVE' } }],
      admins: [], students: [], invitations: [], tenantCourses: [], contentItems: [], questions: [], packages: [], orders: [], broadcasts: [],
    });
    const result = await fetchAdminAcademy('academy-a');
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/academies/academy-a');
    expect(result.memberships[0]).toMatchObject({ name: 'Dev Rao', membershipStatus: 'ACTIVE' });
    expect(result.metrics).toMatchObject({ contentCount: 4, questionsCount: 5, broadcastCount: 2, activeBroadcastCount: 1 });
    expect(result.administrator).toMatchObject({ id: 'admin-1', identityStatus: 'ACTIVE' });
    expect(result).not.toHaveProperty('recentActivity');
  });
});
