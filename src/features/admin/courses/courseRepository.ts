import type { AdminCourse, CourseStatus } from '@/features/admin/types/admin';
import { apiRequest } from '@/lib/api/client';

export interface CourseInput {
  name: string;
  code: string;
  description: string;
  status: CourseStatus;
}

export interface CourseRepository {
  list(): Promise<AdminCourse[]>;
  create(input: CourseInput): Promise<AdminCourse>;
  update(courseId: string, input: CourseInput): Promise<AdminCourse>;
  remove(courseId: string): Promise<void>;
}

interface BackendCourseDto {
  id: string;
  slug: string;
  name: string;
  code: string;
  description?: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

function adaptBackendCourse(dto: BackendCourseDto): AdminCourse {
  return { ...dto, description: dto.description || '' };
}

const validCourse = (dto: BackendCourseDto | undefined): BackendCourseDto => {
  if (!dto?.id) throw new Error('The course service returned an invalid response.');
  return dto;
};

export const courseRepository: CourseRepository = {
  async list() {
    const response = await apiRequest<{ data: BackendCourseDto[] }>('/api/admin/courses?limit=100');
    if (!Array.isArray(response.data)) throw new Error('The course service returned an invalid response.');
    return response.data.map(adaptBackendCourse);
  },
  async create(input) {
    const dto = await apiRequest<BackendCourseDto>('/api/admin/courses', { method: 'POST', body: input });
    return adaptBackendCourse(validCourse(dto));
  },
  async update(courseId, input) {
    const dto = await apiRequest<BackendCourseDto>(`/api/admin/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: input });
    return adaptBackendCourse(validCourse(dto));
  },
  async remove(courseId) {
    await apiRequest(`/api/admin/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' });
  },
};
