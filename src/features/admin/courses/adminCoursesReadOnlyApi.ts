import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useCourseStore } from '@/app/store/useCourseStore';
import type { CourseStatus } from '@/features/admin/types/admin';

export interface AdminCourseSummary {
  totalCourses: number;
  activeCourses: number;
  totalEnrolledStudents: number;
  totalPackages: number;
  totalContentItems?: number;
}

export interface AdminCourseItem {
  id: string;
  slug: string;
  name: string;
  code: string;
  description: string;
  status: CourseStatus;
  packagesCount: number;
  studentsCount: number;
  contentCount: number;
  questionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCourseListResponse {
  summary?: AdminCourseSummary;
  data: AdminCourseItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminCourseDetail {
  id: string;
  slug: string;
  name: string;
  code: string;
  description: string;
  status: CourseStatus;
  packages: Array<{
    id: string;
    title: string;
    price: number | string;
    currency: string;
    status: string;
  }>;
  contentItems?: Array<{
    id: string;
    name: string;
    kind: string;
    accessType: string;
    isPublished: boolean;
    createdAt: string;
  }>;
  questions?: Array<{
    id: string;
    title: string;
    type: string;
    difficulty: string;
  }>;
  students?: Array<{
    id: string;
    userId: string;
    studentName: string;
    studentEmail: string;
    status: string;
    grantedAt: string;
  }>;
  academies: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  packagesCount: number;
  studentsCount: number;
  contentCount: number;
  questionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCourseInput {
  name: string;
  code: string;
  description?: string;
  status?: CourseStatus;
}

export const ADMIN_COURSES_READ_ONLY_QUERY_KEY = ['admin', 'courses', 'read-only'] as const;

export function fetchAdminCoursesSummary(): Promise<AdminCourseSummary> {
  return apiRequest<AdminCourseSummary>('/api/admin/courses/summary');
}

export function fetchAdminCourses(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: CourseStatus;
}): Promise<AdminCourseListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', String(params.page));
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.search?.trim()) queryParams.set('search', params.search.trim());
  if (params?.status) queryParams.set('status', params.status);

  const url = `/api/admin/courses${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return apiRequest<AdminCourseListResponse>(url);
}

export function fetchAdminCourse(courseId: string): Promise<AdminCourseDetail> {
  return apiRequest<AdminCourseDetail>(`/api/admin/courses/${encodeURIComponent(courseId)}`);
}

export function useAdminCoursesSummaryReadOnly(actorUserId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_COURSES_READ_ONLY_QUERY_KEY, 'summary', actorUserId],
    queryFn: () => fetchAdminCoursesSummary(),
    enabled: Boolean(actorUserId),
    staleTime: 30_000,
  });
}

export function useAdminCoursesReadOnly(
  actorUserId: string | null,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: CourseStatus;
  }
) {
  return useQuery({
    queryKey: [...ADMIN_COURSES_READ_ONLY_QUERY_KEY, 'list', actorUserId, params],
    queryFn: () => fetchAdminCourses(params),
    enabled: Boolean(actorUserId),
    staleTime: 30_000,
  });
}

export function useAdminCourseReadOnly(actorUserId: string | null, courseId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_COURSES_READ_ONLY_QUERY_KEY, 'detail', actorUserId, courseId],
    queryFn: () => fetchAdminCourse(courseId!),
    enabled: Boolean(actorUserId && courseId),
    staleTime: 30_000,
  });
}

export function useCreateAdminCourse(actorUserId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCourseInput) =>
      apiRequest<AdminCourseDetail>('/api/admin/courses', {
        method: 'POST',
        body: input,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_READ_ONLY_QUERY_KEY }),
        useCourseStore.getState().refresh(),
      ]);
    },
  });
}

export function useUpdateAdminCourse(actorUserId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: Partial<AdminCourseInput> }) =>
      apiRequest<AdminCourseDetail>(`/api/admin/courses/${encodeURIComponent(courseId)}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_READ_ONLY_QUERY_KEY }),
        useCourseStore.getState().refresh(),
      ]);
    },
  });
}

export function useDeleteAdminCourse(actorUserId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/api/admin/courses/${encodeURIComponent(courseId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_READ_ONLY_QUERY_KEY }),
        useCourseStore.getState().refresh(),
      ]);
    },
  });
}
