import type { Academy, AcademyInput, AcademyStatus } from '../types/academy';
import { AcademyRepositoryError, type AcademyRepository } from './academyRepository';
import { apiRequest } from '@/lib/api/client';

const STORAGE_KEY = 'pf_admin_academies_v1';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = (ms = 90) => new Promise((resolve) => window.setTimeout(resolve, ms));
const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');
const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const fallbackAcademies: Academy[] = [
  {
    id: 'academy-ink-001', name: 'Ink Academy', email: 'hello@inkacademy.in', phone: '+91 98765 43210',
    address: '14 Knowledge Park, Indiranagar', city: 'Bengaluru', state: 'Karnataka', country: 'India', postalCode: '560038',
    website: 'https://inkacademy.in', description: 'A technology academy focused on practical, industry-ready learning journeys.',
    status: 'ACTIVE', adminName: 'John Doe', adminEmail: 'john@inkacademy.in', adminPhone: '+91 98450 11223',
    studentCount: 124, activeStudentCount: 116, courseCount: 8, activeCourseCount: 6, packageCount: 4, orderCount: 286, revenue: 248500,
    courses: [{ id: 'ink-course-1', name: 'Full Stack Development', studentCount: 124, status: 'ACTIVE' }],
    students: [{ id: 'ink-student-1', name: 'Rahul Kumar', email: 'rahul@example.com', status: 'ACTIVE' }],
    recentActivity: [{ id: 'ink-activity-1', label: 'New course created', occurredAt: '2026-08-14T10:20:00.000Z' }],
    createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-14T10:20:00.000Z',
  },
];

interface BackendAcademyDto {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  website?: string | null;
  description?: string | null;
  status: string;
  adminName?: string;
  adminEmail?: string;
  adminPhone?: string;
  studentCount?: number;
  activeStudentCount?: number;
  courseCount?: number;
  createdAt: string;
  updatedAt: string;
}

function adaptBackendAcademy(dto: BackendAcademyDto): Academy {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
    city: dto.city,
    state: dto.state,
    country: dto.country || 'India',
    postalCode: dto.postalCode,
    website: dto.website || '',
    description: dto.description || '',
    status: (dto.status === 'SUSPENDED' ? 'SUSPENDED' : dto.status === 'PENDING' ? 'PENDING' : 'ACTIVE') as AcademyStatus,
    adminName: dto.adminName || 'Academy Admin',
    adminEmail: dto.adminEmail || dto.email,
    adminPhone: dto.adminPhone || dto.phone,
    studentCount: dto.studentCount ?? 0,
    activeStudentCount: dto.activeStudentCount ?? 0,
    courseCount: dto.courseCount ?? 0,
    activeCourseCount: dto.courseCount ?? 0,
    packageCount: 0,
    orderCount: 0,
    revenue: 0,
    courses: [],
    students: [],
    recentActivity: [],
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export class MockAcademyRepository implements AcademyRepository {
  async list(): Promise<Academy[]> {
    try {
      const response = await apiRequest<{ data: BackendAcademyDto[] }>('/api/admin/academies?limit=100');
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map(adaptBackendAcademy);
      }
    } catch {
      // Fall back if unauthenticated
    }
    return clone(fallbackAcademies);
  }

  async get(academyId: string): Promise<Academy> {
    try {
      const dto = await apiRequest<BackendAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}`);
      if (dto && dto.id) {
        return adaptBackendAcademy(dto);
      }
    } catch {
      // Fall back
    }
    const found = fallbackAcademies.find((a) => a.id === academyId);
    if (!found) throw new AcademyRepositoryError('NOT_FOUND', 'Academy not found.');
    return clone(found);
  }

  async create(input: AcademyInput): Promise<Academy> {
    try {
      const dto = await apiRequest<BackendAcademyDto>('/api/admin/academies', {
        method: 'POST',
        body: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country || 'India',
          postalCode: input.postalCode,
          website: input.website || undefined,
          description: input.description || undefined,
          adminName: input.adminName,
          adminEmail: input.adminEmail,
          adminPhone: input.adminPhone || undefined,
        },
      });
      if (dto && dto.id) {
        return adaptBackendAcademy(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new AcademyRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new AcademyRepositoryError('STORAGE_ERROR', 'Failed to create academy on backend.');
  }

  async update(academyId: string, input: AcademyInput): Promise<Academy> {
    try {
      const dto = await apiRequest<BackendAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}`, {
        method: 'PATCH',
        body: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country || 'India',
          postalCode: input.postalCode,
          website: input.website || undefined,
          description: input.description || undefined,
          adminName: input.adminName,
          adminEmail: input.adminEmail,
          adminPhone: input.adminPhone || undefined,
        },
      });
      if (dto && dto.id) {
        return adaptBackendAcademy(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new AcademyRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new AcademyRepositoryError('STORAGE_ERROR', 'Failed to update academy on backend.');
  }

  async updateStatus(academyId: string, status: AcademyStatus): Promise<Academy> {
    const action = status === 'SUSPENDED' ? 'suspend' : 'restore';
    try {
      const dto = await apiRequest<BackendAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}/${action}`, {
        method: 'POST',
      });
      if (dto && dto.id) {
        return adaptBackendAcademy(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new AcademyRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new AcademyRepositoryError('STORAGE_ERROR', `Failed to ${action} academy on backend.`);
  }
}

export const mockAcademyRepository = new MockAcademyRepository();
