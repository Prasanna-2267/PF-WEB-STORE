import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  apiRequest: apiRequestMock,
}));

import { adminReadOnlyKeys, fetchAdminStudent, fetchAdminStudents } from './adminReadOnlyApi';

const student = { id: 'student-1', email: 'student@example.test', fullName: 'Dev Rao', phone: null, status: 'ACTIVE', lastLoginAt: null, createdAt: '2026-08-20T00:00:00.000Z', role: { key: 'student', name: 'Student' } };
const pagination = { page: 1, limit: 25, total: 1, totalPages: 1 };

describe('Super Admin Students read-only contract', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('adapts a successful backend user projection', async () => {
    apiRequestMock.mockResolvedValue({ data: [student], pagination });
    await expect(fetchAdminStudents({ page: 1, limit: 25 })).resolves.toEqual({ items: [expect.objectContaining({ id: 'student-1', name: 'Dev Rao', roleKey: 'student' })], pagination });
  });

  it('sends server pagination and pins the canonical student role', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAdminStudents({ page: 2, limit: 10 });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/students?page=2&limit=10&role=student');
  });

  it('sends supported trimmed search and status filters', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAdminStudents({ page: 1, limit: 25, search: '  dev ', status: 'DISABLED' });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/students?page=1&limit=25&search=dev&status=DISABLED&role=student');
  });

  it('preserves an empty server response', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } });
    await expect(fetchAdminStudents({ page: 1, limit: 25 })).resolves.toMatchObject({ items: [] });
  });

  it('includes authenticated Super Admin identity in the key', () => {
    const filters = { page: 1, limit: 25 };
    expect(adminReadOnlyKeys.students('admin-a', filters)).not.toEqual(adminReadOnlyKeys.students('admin-b', filters));
  });

  it('adapts detail memberships, permissions, and sessions only from backend data', async () => {
    apiRequestMock.mockResolvedValue({ ...student, updatedAt: student.createdAt, role: { ...student.role, rolePermissions: [{ permission: { key: 'catalog:read' } }] }, sessions: [], academyMemberships: [{ id: 'membership-1', academyId: 'academy-a', role: 'ACADEMY_STUDENT', status: 'ACTIVE', academy: { name: 'Alpha', slug: 'alpha' } }] });
    const result = await fetchAdminStudent('student-1');
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/admin/students/student-1');
    expect(result).toMatchObject({ permissions: ['catalog:read'], memberships: [{ academyName: 'Alpha' }] });
  });
});
