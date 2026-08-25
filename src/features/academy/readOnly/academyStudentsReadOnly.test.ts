import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  apiRequest: apiRequestMock,
}));

import { academyReadOnlyKeys, fetchAcademyStudent, fetchAcademyStudents } from './academyReadOnlyApi';

const row = {
  id: 'membership-1', studentId: 'student-1', name: 'Asha Rao', email: 'asha@example.test', phone: null,
  membershipStatus: 'ACTIVE', accountStatus: 'ACTIVE', avatarStoragePath: null, joinedAt: '2026-08-20T10:00:00.000Z', lastLoginAt: null,
};
const page = { page: 2, limit: 25, total: 26, totalPages: 2 };

describe('Academy Students read-only contract', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('adapts a successful server list without fabricating fields', async () => {
    apiRequestMock.mockResolvedValue({ data: [row], pagination: page });
    const result = await fetchAcademyStudents({ page: 2, limit: 25 });
    expect(result).toEqual({ items: [{ membershipId: 'membership-1', studentId: 'student-1', name: 'Asha Rao', email: 'asha@example.test', phone: null, membershipStatus: 'ACTIVE', accountStatus: 'ACTIVE', joinedAt: row.joinedAt, lastLoginAt: null }], pagination: page });
  });

  it('sends server pagination', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: page });
    await fetchAcademyStudents({ page: 2, limit: 25 });
    expect(apiRequestMock).toHaveBeenCalledWith('/api/academy/students?page=2&limit=25', expect.any(Object));
  });

  it('sends trimmed server search and supported status', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: page });
    await fetchAcademyStudents({ page: 1, limit: 25, search: '  asha  ', status: 'SUSPENDED' });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/academy/students?page=1&limit=25&search=asha&status=SUSPENDED');
  });

  it('sends the account-status filter to the Academy-scoped endpoint', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: page });
    await fetchAcademyStudents({ page: 1, limit: 25, accountStatus: 'DISABLED' });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/academy/students?page=1&limit=25&accountStatus=DISABLED');
  });

  it('preserves an empty server page', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: { ...page, total: 0, totalPages: 0 } });
    await expect(fetchAcademyStudents({ page: 1, limit: 25 })).resolves.toMatchObject({ items: [] });
  });

  it('includes authoritative Academy identity in the cache key', () => {
    const filters = { page: 1, limit: 25, search: ' Asha ' };
    expect(academyReadOnlyKeys.students('academy-a', filters)).toEqual(['academy', 'academy-a', 'students', { page: 1, limit: 25, search: 'Asha' }]);
    expect(academyReadOnlyKeys.students('academy-a', filters)).not.toEqual(academyReadOnlyKeys.students('academy-b', filters));
  });

  it('uses the backend student detail endpoint and adapts enrollments', async () => {
    apiRequestMock.mockResolvedValue({ student: { id: 'student-1', fullName: 'Asha Rao', email: row.email, phone: null, status: 'ACTIVE', avatarStoragePath: null, membershipStatus: 'ACTIVE', joinedAt: row.joinedAt, lastLoginAt: null }, enrollments: [{ id: 'enrollment-1', courseId: 'course-1', status: 'ACTIVE', enrolledAt: row.joinedAt, completedAt: null, course: { name: 'Accounting', code: 'ACC' } }] });
    const result = await fetchAcademyStudent('student-1');
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/academy/students/student-1');
    expect(result.enrollments[0]).toMatchObject({ courseName: 'Accounting', courseCode: 'ACC' });
  });
});
