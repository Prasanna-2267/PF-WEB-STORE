import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdminCourses, fetchAdminCourse, fetchAdminCoursesSummary } from '@/features/admin/courses/adminCoursesReadOnlyApi';

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@/lib/api/client';

describe('Admin Courses Read-Only API Suite', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches courses summary metrics from dedicated endpoint', async () => {
    const mockSummary = {
      totalCourses: 5,
      activeCourses: 4,
      totalEnrolledStudents: 12,
      totalPackages: 8,
      totalContentItems: 45,
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockSummary);

    const result = await fetchAdminCoursesSummary();

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/courses/summary');
    expect(result.totalCourses).toBe(5);
    expect(result.activeCourses).toBe(4);
    expect(result.totalEnrolledStudents).toBe(12);
  });

  it('fetches courses list with summary metrics and pagination metadata', async () => {
    const mockResponse = {
      summary: {
        totalCourses: 5,
        activeCourses: 4,
        totalEnrolledStudents: 12,
        totalPackages: 8,
      },
      data: [
        {
          id: 'course-1',
          slug: 'phase-4-course-a',
          name: 'Phase 4 Course A',
          code: 'A0D2F5A',
          description: 'Advanced course A',
          status: 'ACTIVE',
          packagesCount: 2,
          studentsCount: 5,
          contentCount: 10,
          questionsCount: 25,
          createdAt: '2026-08-23T10:00:00.000Z',
          updatedAt: '2026-08-23T10:00:00.000Z',
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockResponse);

    const result = await fetchAdminCourses({ page: 1, limit: 10, search: 'Phase 4', status: 'ACTIVE' });

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/courses?page=1&limit=10&search=Phase+4&status=ACTIVE');
    expect(result.summary?.totalCourses).toBe(5);
    expect(result.data[0].name).toBe('Phase 4 Course A');
    expect(result.data[0].studentsCount).toBe(5);
  });

  it('fetches single course detail with linked packages, content, questions, and students', async () => {
    const mockDetail = {
      id: 'course-1',
      slug: 'phase-4-course-a',
      name: 'Phase 4 Course A',
      code: 'A0D2F5A',
      description: 'Advanced course A',
      status: 'ACTIVE',
      packages: [
        { id: 'pkg-1', title: 'Full Access Package', price: 999, currency: 'INR', status: 'PUBLISHED' },
      ],
      contentItems: [
        { id: 'cnt-1', name: 'Module 1 Video', kind: 'FILE', accessType: 'PAID', isPublished: true, createdAt: '2026-08-23T10:00:00.000Z' },
      ],
      questions: [
        { id: 'q-1', title: 'Accounting Practice Q1', type: 'MCQ', difficulty: 'MEDIUM' },
      ],
      students: [
        { id: 'ent-1', userId: 'user-1', studentName: 'Phase 4 Student A', studentEmail: 'student-a@test.invalid', status: 'ACTIVE', grantedAt: '2026-08-23T10:00:00.000Z' },
      ],
      academies: [],
      packagesCount: 1,
      studentsCount: 1,
      contentCount: 1,
      questionsCount: 1,
      createdAt: '2026-08-23T10:00:00.000Z',
      updatedAt: '2026-08-23T10:00:00.000Z',
    };

    vi.mocked(apiRequest).mockResolvedValueOnce(mockDetail);

    const result = await fetchAdminCourse('course-1');

    expect(apiRequest).toHaveBeenCalledWith('/api/admin/courses/course-1');
    expect(result.name).toBe('Phase 4 Course A');
    expect(result.packages[0].title).toBe('Full Access Package');
    expect(result.students?.[0].studentName).toBe('Phase 4 Student A');
  });
});
