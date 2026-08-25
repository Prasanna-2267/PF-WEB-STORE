import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@/lib/api/client', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client')),
  apiRequest: apiRequestMock,
}));

import { academyReadOnlyKeys, fetchAcademyCourse, fetchAcademyCourses } from './academyReadOnlyApi';

const course = { id: 'course-1', academyId: 'academy-a', slug: 'accounting', code: 'ACC', name: 'Accounting', description: '', status: 'ACTIVE', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z', deletedAt: null, _count: { contentItems: 4, questions: 8, enrollments: 12 } };
const pagination = { page: 1, limit: 25, total: 1, totalPages: 1 };

describe('Academy Courses read-only contract', () => {
  beforeEach(() => apiRequestMock.mockReset());

  it('adapts server-owned counts and lifecycle', async () => {
    const summary = { totalCourses: 1, activeCourses: 1, totalEnrolledStudents: 12, totalContentItems: 4 };
    apiRequestMock.mockResolvedValue({ data: [course], pagination, summary });
    await expect(fetchAcademyCourses({ page: 1, limit: 25 })).resolves.toEqual({ items: [expect.objectContaining({ id: 'course-1', status: 'ACTIVE', contentCount: 4, questionCount: 8, enrollmentCount: 12 })], pagination, summary });
  });

  it('sends pagination and no unsupported search/filter/sort parameters', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination });
    await fetchAcademyCourses({ page: 3, limit: 10 });
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/academy/courses?page=3&limit=10');
  });

  it('preserves an empty server page', async () => {
    apiRequestMock.mockResolvedValue({ data: [], pagination: { ...pagination, total: 0, totalPages: 0 } });
    await expect(fetchAcademyCourses({ page: 1, limit: 25 })).resolves.toMatchObject({ items: [] });
  });

  it('isolates keys by Academy identity', () => {
    expect(academyReadOnlyKeys.courses('academy-a', { page: 1, limit: 25 })).not.toEqual(academyReadOnlyKeys.courses('academy-b', { page: 1, limit: 25 }));
  });

  it('loads course detail without list lookup or fabricated content', async () => {
    apiRequestMock.mockResolvedValue(course);
    const result = await fetchAcademyCourse('course-1');
    expect(apiRequestMock.mock.calls[0][0]).toBe('/api/academy/courses/course-1');
    expect(result).toMatchObject({ name: 'Accounting', contentCount: 4 });
  });

  it('adapts create and lifecycle responses that do not include relation counts', async () => {
    apiRequestMock.mockResolvedValue({ ...course, _count: undefined });
    const result = await fetchAcademyCourse('course-1');
    expect(result).toMatchObject({ contentCount: 0, questionCount: 0, enrollmentCount: 0 });
  });
});
