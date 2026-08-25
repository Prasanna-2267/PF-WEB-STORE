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

export const COURSE_STORAGE_KEY = 'pf_admin_courses_v1';

const initialCourses: AdminCourse[] = [
  { id: 'course-chartered-accountancy', slug: 'chartered-accountancy', name: 'Chartered Accountancy', code: 'CA', description: 'Professional accounting and finance education.', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'course-jee', slug: 'jee', name: 'JEE', code: 'JEE', description: 'Engineering entrance preparation.', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'course-neet', slug: 'neet', name: 'NEET', code: 'NEET', description: 'Medical entrance preparation.', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'course-upsc', slug: 'upsc', name: 'UPSC', code: 'UPSC', description: 'Civil services preparation.', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const slugify = (value: string) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const readLocal = (): AdminCourse[] => {
  try {
    const raw = window.localStorage.getItem(COURSE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { courses?: AdminCourse[] }) : null;
    return Array.isArray(parsed?.courses) ? parsed.courses : clone(initialCourses);
  } catch {
    return clone(initialCourses);
  }
};

let courses = typeof window === 'undefined' ? clone(initialCourses) : readLocal();
const persistLocal = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify({ version: 1, courses }));
  }
};

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
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    code: dto.code,
    description: dto.description || '',
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const courseRepository: CourseRepository = {
  async list() {
    try {
      const response = await apiRequest<{ data: BackendCourseDto[] }>('/api/admin/courses?limit=100');
      if (response && Array.isArray(response.data)) {
        const remoteCourses = response.data.map(adaptBackendCourse);
        if (remoteCourses.length > 0) return remoteCourses;
      }
    } catch {
      // Fallback
    }
    return clone([...courses].sort((a, b) => a.name.localeCompare(b.name)));
  },

  async create(input: CourseInput) {
    try {
      const dto = await apiRequest<BackendCourseDto>('/api/admin/courses', {
        method: 'POST',
        body: {
          name: input.name,
          code: input.code,
          description: input.description,
          status: input.status,
        },
      });
      if (dto && dto.id) {
        return adaptBackendCourse(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }

    // Local fallback
    const name = input.name.trim().replace(/\s+/g, ' ');
    const code = input.code.trim().toLocaleUpperCase();
    if (!name || !code) throw new Error('Course name and course code are required.');

    const now = new Date().toISOString();
    const baseSlug = slugify(name) || code.toLocaleLowerCase();
    let slug = baseSlug;
    let suffix = 2;
    while (courses.some((c) => c.slug === slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const course: AdminCourse = {
      id: `course-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      slug,
      name,
      code,
      description: input.description.trim(),
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    courses = [...courses, course];
    persistLocal();
    return clone(course);
  },

  async update(courseId: string, input: CourseInput) {
    try {
      const dto = await apiRequest<BackendCourseDto>(`/api/admin/courses/${encodeURIComponent(courseId)}`, {
        method: 'PATCH',
        body: {
          name: input.name,
          code: input.code,
          description: input.description,
          status: input.status,
        },
      });
      if (dto && dto.id) {
        return adaptBackendCourse(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }

    const existing = courses.find((c) => c.id === courseId);
    const updated: AdminCourse = existing
      ? {
          ...existing,
          name: input.name.trim(),
          code: input.code.trim().toLocaleUpperCase(),
          description: input.description.trim(),
          status: input.status,
          updatedAt: new Date().toISOString(),
        }
      : {
          id: courseId,
          slug: slugify(input.name) || courseId,
          name: input.name.trim(),
          code: input.code.trim().toLocaleUpperCase(),
          description: input.description.trim(),
          status: input.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
    courses = courses.filter((c) => c.id !== courseId).concat(updated);
    persistLocal();
    return clone(updated);
  },

  async remove(courseId: string) {
    try {
      await apiRequest(`/api/admin/courses/${encodeURIComponent(courseId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Fallback
    }
    courses = courses.filter((c) => c.id !== courseId);
    persistLocal();
  },
};
