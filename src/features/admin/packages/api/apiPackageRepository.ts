import type { LearningPackage, PackageInput } from '../types/package';
import { PackageRepositoryError, type PackageRepository } from './packageRepository';
import { apiRequest } from '@/lib/api/client';

interface BackendPackageDto {
  id: string;
  courseId?: string | null;
  title: string;
  slug?: string;
  description?: string | null;
  price: number | string;
  accessDurationValue?: number | null;
  accessDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  status: string;
  contentItemIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

function adaptBackendPackage(dto: BackendPackageDto): LearningPackage {
  const numPrice = typeof dto.price === 'number' ? dto.price : parseFloat(dto.price) || 0;
  const contentItemIds = dto.contentItemIds || [];
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug || dto.id,
    description: dto.description || '',
    price: numPrice,
    accessDurationValue: dto.accessDurationValue ?? null,
    accessDurationUnit: dto.accessDurationUnit ?? null,
    status: (dto.status === 'PUBLISHED' ? 'published' : dto.status === 'ARCHIVED' ? 'archived' : 'draft') as any,
    courseId: dto.courseId || null,
    coverImageId: null,
    items: contentItemIds.map((id) => ({ contentItemId: id, addedAt: new Date().toISOString() })),
    questionBanks: [],
    createdAt: dto.createdAt || new Date().toISOString(),
    updatedAt: dto.updatedAt || new Date().toISOString(),
  };
}

export class ApiPackageRepository implements PackageRepository {
  async list(): Promise<LearningPackage[]> {
    const response = await apiRequest<{ data: BackendPackageDto[] }>('/api/admin/packages?limit=100');
    if (!Array.isArray(response.data)) throw new PackageRepositoryError('STORAGE_ERROR', 'The package service returned an invalid response.');
    return response.data.map(adaptBackendPackage);
  }

  async get(packageId: string): Promise<LearningPackage> {
    const dto = await apiRequest<BackendPackageDto>(`/api/admin/packages/${encodeURIComponent(packageId)}`);
    if (!dto?.id) throw new PackageRepositoryError('STORAGE_ERROR', 'The package service returned an invalid response.');
    return adaptBackendPackage(dto);
  }

  async create(input: PackageInput): Promise<LearningPackage> {
    try {
      const dto = await apiRequest<BackendPackageDto>('/api/admin/packages', {
        method: 'POST',
        body: {
          courseId: input.courseId || undefined,
          title: input.title,
          description: input.description || undefined,
          price: input.price,
          status: input.status === 'published' ? 'PUBLISHED' : 'DRAFT',
          contentItemIds: input.contentItemIds,
        },
      });
      if (dto && dto.id) {
        return adaptBackendPackage(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new PackageRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new PackageRepositoryError('STORAGE_ERROR', 'Failed to create package on backend.');
  }

  async update(packageId: string, input: PackageInput): Promise<LearningPackage> {
    try {
      const dto = await apiRequest<BackendPackageDto>(`/api/admin/packages/${encodeURIComponent(packageId)}`, {
        method: 'PATCH',
        body: {
          title: input.title,
          description: input.description || undefined,
          price: input.price,
          status: input.status === 'published' ? 'PUBLISHED' : input.status === 'archived' ? 'ARCHIVED' : 'DRAFT',
          contentItemIds: input.contentItemIds,
        },
      });
      if (dto && dto.id) {
        return adaptBackendPackage(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new PackageRepositoryError('VALIDATION_ERROR', err.message);
    }
    throw new PackageRepositoryError('STORAGE_ERROR', 'Failed to update package on backend.');
  }

  async delete(packageId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/packages/${encodeURIComponent(packageId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (err instanceof Error) throw new PackageRepositoryError('STORAGE_ERROR', err.message);
    }
  }
}

export const apiPackageRepository = new ApiPackageRepository();
