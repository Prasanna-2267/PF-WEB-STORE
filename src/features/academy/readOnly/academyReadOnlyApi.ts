import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';


export type AcademyMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
export type AccountStatus = 'ACTIVE' | 'DISABLED';
export type CourseStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PageDto<T> {
  data: T[];
  pagination: PaginationDto;
  summary?: AcademyCourseSummary;
}

export interface AcademyCourseSummary {
  totalCourses: number;
  activeCourses: number;
  totalEnrolledStudents: number;
  totalContentItems: number;
}

interface AcademyStudentDto {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string | null;
  membershipStatus: AcademyMembershipStatus;
  accountStatus: AccountStatus;
  avatarStoragePath: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
}

interface AcademyStudentDetailDto {
  student: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    status: AccountStatus;
    avatarStoragePath: string | null;
    membershipStatus: AcademyMembershipStatus;
    joinedAt: string;
    lastLoginAt: string | null;
  };
  enrollments: Array<{
    id: string;
    courseId: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    enrolledAt: string;
    completedAt: string | null;
    course: { name: string; code: string };
  }>;
}

interface AcademyCourseDto {
  id: string;
  academyId: string | null;
  slug: string;
  code: string;
  name: string;
  description: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: { contentItems: number; questions: number; enrollments: number };
  contentItems?: Array<{ id: string; name: string; kind: 'FOLDER' | 'FILE'; status: 'PUBLISHED' | 'ARCHIVED'; updatedAt: string }>;
  questions?: Array<{ id: string; kind: string; status: string; difficulty: string; questionHtml: string }>;
  enrollments?: Array<{ id: string; status: string; enrolledAt: string; student: { id: string; fullName: string; email: string; status: string } }>;
}

export interface AcademyStudentViewModel {
  membershipId: string;
  studentId: string;
  name: string;
  email: string;
  phone: string | null;
  membershipStatus: AcademyMembershipStatus;
  accountStatus: AccountStatus;
  joinedAt: string;
  lastLoginAt: string | null;
}

export interface AcademyStudentDetailViewModel extends Omit<AcademyStudentViewModel, 'membershipId'> {
  enrollments: Array<{
    id: string;
    courseId: string;
    courseName: string;
    courseCode: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    enrolledAt: string;
    completedAt: string | null;
  }>;
}

export interface AcademyCourseViewModel {
  id: string;
  code: string;
  name: string;
  description: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  contentCount: number;
  questionCount: number;
  enrollmentCount: number;
  contentItems?: AcademyCourseDto['contentItems'];
  questions?: AcademyCourseDto['questions'];
  enrollments?: AcademyCourseDto['enrollments'];
}

export interface AcademyStudentFilters {
  page: number;
  limit: number;
  search?: string;
  status?: AcademyMembershipStatus;
  accountStatus?: AccountStatus;
}

export interface AcademyCourseFilters {
  page: number;
  limit: number;
  includeArchived?: boolean;
  search?: string;
  status?: CourseStatus;
  sort?: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
}

export interface AcademyCourseInput { name: string; code: string; description?: string; status?: CourseStatus }

const cleanSearch = (value?: string) => value?.trim() || undefined;

export const academyReadOnlyKeys = {
  students: (academyId: string, filters: AcademyStudentFilters) =>
    ['academy', academyId, 'students', { ...filters, search: cleanSearch(filters.search) }] as const,
  student: (academyId: string, studentId: string) =>
    ['academy', academyId, 'students', 'detail', studentId] as const,
  courses: (academyId: string, filters: AcademyCourseFilters) =>
    ['academy', academyId, 'courses', filters] as const,
  course: (academyId: string, courseId: string) =>
    ['academy', academyId, 'courses', 'detail', courseId] as const,
};

export function adaptAcademyStudent(dto: AcademyStudentDto): AcademyStudentViewModel {
  return {
    membershipId: dto.id,
    studentId: dto.studentId,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    membershipStatus: dto.membershipStatus,
    accountStatus: dto.accountStatus,
    joinedAt: dto.joinedAt,
    lastLoginAt: dto.lastLoginAt,
  };
}

export function adaptAcademyCourse(dto: AcademyCourseDto): AcademyCourseViewModel {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    contentCount: dto._count?.contentItems ?? 0,
    questionCount: dto._count?.questions ?? 0,
    enrollmentCount: dto._count?.enrollments ?? 0,
    contentItems: dto.contentItems,
    questions: dto.questions,
    enrollments: dto.enrollments,
  };
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export async function fetchAcademyStudents(filters: AcademyStudentFilters, signal?: AbortSignal) {
  const query = queryString({
    page: filters.page,
    limit: filters.limit,
    search: cleanSearch(filters.search),
    status: filters.status,
    accountStatus: filters.accountStatus,
  });
  const result = await apiRequest<PageDto<AcademyStudentDto>>(`/api/academy/students?${query}`, { signal });
  return { items: result.data.map(adaptAcademyStudent), pagination: result.pagination };
}

export async function fetchAcademyStudent(studentId: string, signal?: AbortSignal): Promise<AcademyStudentDetailViewModel> {
  const result = await apiRequest<AcademyStudentDetailDto>(`/api/academy/students/${encodeURIComponent(studentId)}`, { signal });
  return {
    studentId: result.student.id,
    name: result.student.fullName,
    email: result.student.email,
    phone: result.student.phone,
    membershipStatus: result.student.membershipStatus,
    accountStatus: result.student.status,
    joinedAt: result.student.joinedAt,
    lastLoginAt: result.student.lastLoginAt,
    enrollments: result.enrollments.map((enrollment) => ({
      id: enrollment.id,
      courseId: enrollment.courseId,
      courseName: enrollment.course.name,
      courseCode: enrollment.course.code,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
    })),
  };
}

export async function fetchAcademyCourses(filters: AcademyCourseFilters, signal?: AbortSignal) {
  const query = queryString({ page: filters.page, limit: filters.limit, includeArchived: filters.includeArchived ? 'true' : undefined, search: cleanSearch(filters.search), status: filters.status, sort: filters.sort });
  const result = await apiRequest<PageDto<AcademyCourseDto>>(`/api/academy/courses?${query}`, { signal });
  return {
    items: result.data.map(adaptAcademyCourse),
    pagination: result.pagination,
    summary: result.summary ?? {
      totalCourses: result.pagination.total,
      activeCourses: 0,
      totalEnrolledStudents: 0,
      totalContentItems: 0,
    },
  };
}

export async function fetchAcademyCourse(courseId: string, signal?: AbortSignal): Promise<AcademyCourseViewModel> {
  const result = await apiRequest<AcademyCourseDto>(`/api/academy/courses/${encodeURIComponent(courseId)}`, { signal });
  return adaptAcademyCourse(result);
}

export function useAcademyStudentsReadOnly(academyId: string | null, filters: AcademyStudentFilters) {
  return useQuery({
    queryKey: academyReadOnlyKeys.students(academyId ?? 'unresolved', filters),
    queryFn: ({ signal }) => fetchAcademyStudents(filters, signal),
    enabled: Boolean(academyId),
  });
}

export function useAcademyStudentReadOnly(academyId: string | null, studentId?: string) {
  return useQuery({
    queryKey: academyReadOnlyKeys.student(academyId ?? 'unresolved', studentId ?? 'missing'),
    queryFn: ({ signal }) => fetchAcademyStudent(studentId!, signal),
    enabled: Boolean(academyId && studentId),
  });
}

export function useAcademyCoursesReadOnly(academyId: string | null, filters: AcademyCourseFilters) {
  return useQuery({
    queryKey: academyReadOnlyKeys.courses(academyId ?? 'unresolved', filters),
    queryFn: ({ signal }) => fetchAcademyCourses(filters, signal),
    enabled: Boolean(academyId),
  });
}

export function useAcademyCourseReadOnly(academyId: string | null, courseId?: string) {
  return useQuery({
    queryKey: academyReadOnlyKeys.course(academyId ?? 'unresolved', courseId ?? 'missing'),
    queryFn: ({ signal }) => fetchAcademyCourse(courseId!, signal),
    enabled: Boolean(academyId && courseId),
  });
}

// ---------------------------------------------------------------------------
// Phase 5C-2 Mutations
// ---------------------------------------------------------------------------

export async function mutateAcademyStudentStatus(
  studentId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED',
): Promise<{ id: string; status: AcademyMembershipStatus }> {
  return apiRequest<{ id: string; status: AcademyMembershipStatus }>(
    `/api/academy/students/${encodeURIComponent(studentId)}/status`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
}

export async function enrollAcademyStudent(studentId: string, courseId: string): Promise<{ id: string; courseId: string; status: string }> {
  return apiRequest(`/api/academy/students/${encodeURIComponent(studentId)}/enrollments`, { method: 'POST', body: { courseId } });
}

export async function createAcademyCourse(input: AcademyCourseInput): Promise<AcademyCourseViewModel> {
  return adaptAcademyCourse(await apiRequest<AcademyCourseDto>('/api/academy/courses', { method: 'POST', body: input }));
}

export async function updateAcademyCourse(courseId: string, input: Partial<AcademyCourseInput>): Promise<AcademyCourseViewModel> {
  return adaptAcademyCourse(await apiRequest<AcademyCourseDto>(`/api/academy/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: input }));
}

export function useUpdateAcademyStudentStatus(academyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' }) =>
      mutateAcademyStudentStatus(studentId, status),
    onSuccess: (_, { studentId }) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'students'] }),
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'overview'] }),
      ]);
    },
  });
}

export async function mutateAcademyCourseStatus(
  courseId: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<AcademyCourseViewModel> {
  const result = await apiRequest<AcademyCourseDto>(`/api/academy/courses/${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    body: { status },
  });
  return adaptAcademyCourse(result);
}

export async function archiveAcademyCourse(courseId: string): Promise<AcademyCourseViewModel> {
  const result = await apiRequest<AcademyCourseDto>(`/api/academy/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  });
  return adaptAcademyCourse(result);
}

export async function restoreAcademyCourse(courseId: string): Promise<AcademyCourseViewModel> {
  const result = await apiRequest<AcademyCourseDto>(`/api/academy/courses/${encodeURIComponent(courseId)}/restore`, {
    method: 'POST',
  });
  return adaptAcademyCourse(result);
}

export function useUpdateAcademyCourse(academyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, status }: { courseId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      mutateAcademyCourseStatus(courseId, status),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'courses'] }),
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'overview'] }),
      ]);
    },
  });
}

export function useArchiveAcademyCourse(academyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => archiveAcademyCourse(courseId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'courses'] }),
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'overview'] }),
      ]);
    },
  });
}

export function useRestoreAcademyCourse(academyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => restoreAcademyCourse(courseId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'courses'] }),
        queryClient.invalidateQueries({ queryKey: ['academy', academyId ?? 'unresolved', 'overview'] }),
      ]);
    },
  });
}
