import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api/client';
import {
  archiveAcademyCourse,
  createAcademyCourse,
  mutateAcademyCourseStatus,
  mutateAcademyStudentStatus,
  restoreAcademyCourse,
} from './academy/readOnly/academyReadOnlyApi';
import { mutateAdminAcademyStatus, mutateAdminStudentStatus } from './admin/readOnly/adminReadOnlyApi';


vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
}));

const mockApiRequest = vi.mocked(apiRequest);

describe('Phase 5C-2 Domain Mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Academy Student status mutation', () => {
    it('sends PATCH request with tenant student status update', async () => {
      mockApiRequest.mockResolvedValueOnce({
        id: 'mem-101',
        status: 'SUSPENDED',
      });

      const result = await mutateAcademyStudentStatus('student-uuid-1', 'SUSPENDED');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/academy/students/student-uuid-1/status', {
        method: 'PATCH',
        body: { status: 'SUSPENDED' },
      });
      expect(result).toEqual({ id: 'mem-101', status: 'SUSPENDED' });
    });

    it('handles student status mutation error correctly', async () => {
      mockApiRequest.mockRejectedValueOnce({
        status: 403,
        error: { code: 'FORBIDDEN', message: 'Tenant access denied' },
      });

      await expect(mutateAcademyStudentStatus('student-uuid-2', 'REVOKED')).rejects.toEqual({
        status: 403,
        error: { code: 'FORBIDDEN', message: 'Tenant access denied' },
      });
    });
  });

  describe('2. Academy Course lifecycle mutations', () => {
    const rawCourse = {
      id: 'course-uuid-1',
      academyId: 'acad-1',
      slug: 'ca-foundation',
      code: 'CAF-101',
      name: 'CA Foundation Math',
      description: 'Comprehensive course',
      status: 'INACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      deletedAt: null,
      _count: { contentItems: 5, questions: 10, enrollments: 20 },
    };

    it('includes the selected lifecycle status when creating an Academy course', async () => {
      mockApiRequest.mockResolvedValueOnce({ ...rawCourse, status: 'ARCHIVED', deletedAt: '2026-08-22T00:00:00Z' });
      await createAcademyCourse({ name: 'CA Foundation Math', code: 'CAF-101', description: 'Comprehensive course', status: 'ARCHIVED' });
      expect(mockApiRequest).toHaveBeenCalledWith('/api/academy/courses', {
        method: 'POST',
        body: { name: 'CA Foundation Math', code: 'CAF-101', description: 'Comprehensive course', status: 'ARCHIVED' },
      });
    });

    it('sends PATCH request to update course status', async () => {
      mockApiRequest.mockResolvedValueOnce(rawCourse);

      const result = await mutateAcademyCourseStatus('course-uuid-1', 'INACTIVE');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/academy/courses/course-uuid-1', {
        method: 'PATCH',
        body: { status: 'INACTIVE' },
      });
      expect(result.status).toBe('INACTIVE');
      expect(result.name).toBe('CA Foundation Math');
    });

    it('sends DELETE request to archive course', async () => {
      mockApiRequest.mockResolvedValueOnce({ ...rawCourse, status: 'ARCHIVED', deletedAt: '2026-08-22T00:00:00Z' });

      const result = await archiveAcademyCourse('course-uuid-1');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/academy/courses/course-uuid-1', {
        method: 'DELETE',
      });
      expect(result.status).toBe('ARCHIVED');
    });

    it('sends POST request to restore course', async () => {
      mockApiRequest.mockResolvedValueOnce({ ...rawCourse, status: 'ACTIVE', deletedAt: null });

      const result = await restoreAcademyCourse('course-uuid-1');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/academy/courses/course-uuid-1/restore', {
        method: 'POST',
      });
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('3. Super Admin Student mutation', () => {
    it('sends PATCH request to toggle platform student status', async () => {
      mockApiRequest.mockResolvedValueOnce({ id: 'user-uuid-1', status: 'DISABLED' });

      const result = await mutateAdminStudentStatus('user-uuid-1', 'DISABLED');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/students/user-uuid-1/status', {
        method: 'PATCH',
        body: { status: 'DISABLED' },
      });
      expect(result).toEqual({ id: 'user-uuid-1', status: 'DISABLED' });
    });
  });

  describe('4. Super Admin Academy lifecycle mutation', () => {
    const rawAcademy = {
      id: 'acad-uuid-1',
      slug: 'apex-commerce',
      name: 'Apex Commerce Academy',
      email: 'contact@apex.edu',
      phone: '+919876543210',
      address: '123 Main St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600001',
      website: 'https://apex.edu',
      description: 'Top commerce tutorial',
      logoUrl: null,
      status: 'SUSPENDED',
      adminName: 'Admin User',
      adminEmail: 'admin@apex.edu',
      adminPhone: '+919876543211',
      studentCount: 150,
      activeStudentCount: 120,
      courseCount: 8,
      activeCourseCount: 6,
      packageCount: 3,
      orderCount: 45,
      revenue: '150000.00',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      deletedAt: null,
    };

    it('sends PATCH request to update academy status', async () => {
      mockApiRequest.mockResolvedValueOnce(rawAcademy);

      const result = await mutateAdminAcademyStatus('acad-uuid-1', 'SUSPENDED');

      expect(mockApiRequest).toHaveBeenCalledWith('/api/admin/academies/acad-uuid-1/suspend', {
        method: 'POST',
      });
      expect(result.status).toBe('SUSPENDED');
      expect(result.name).toBe('Apex Commerce Academy');
    });
  });
});
