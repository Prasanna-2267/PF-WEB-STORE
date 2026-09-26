import type { Academy, AcademyInput, AcademyStatus } from '../types/academy';
import { AcademyRepositoryError, type AcademyRepository } from './academyRepository';
import { apiRequest } from '@/lib/api/client';

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

export class ApiAcademyRepository implements AcademyRepository {
  async list(): Promise<Academy[]> {
    const response = await apiRequest<{ data: BackendAcademyDto[] }>('/api/admin/academies?limit=100');
    if (!Array.isArray(response.data)) throw new AcademyRepositoryError('STORAGE_ERROR', 'The academy service returned an invalid response.');
    return response.data.map(adaptBackendAcademy);
  }

  async get(academyId: string): Promise<Academy> {
    const dto = await apiRequest<BackendAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}`);
    if (!dto?.id) throw new AcademyRepositoryError('STORAGE_ERROR', 'The academy service returned an invalid response.');
    return adaptBackendAcademy(dto);
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

export const apiAcademyRepository = new ApiAcademyRepository();
