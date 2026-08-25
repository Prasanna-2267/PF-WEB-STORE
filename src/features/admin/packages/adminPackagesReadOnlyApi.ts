import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { LearningPackage, PackageInput, PackageStatus } from './types/package';

export interface BackendPackageDto {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string;
  price: number | string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  course?: { id: string; name: string; academyId?: string | null };
  items?: Array<{
    id?: string;
    packageId?: string;
    contentItemId: string;
    displayOrder: number;
    addedAt?: string;
    contentItem?: {
      id: string;
      name: string;
      accessType: 'FREE' | 'PAID';
      status: string;
      kind?: string;
      size?: number;
    };
  }>;
}

export interface AdminPackagesQueryResponse {
  data: BackendPackageDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminPackageFilters {
  page?: number;
  limit?: number;
  courseId?: string | null;
  status?: 'all' | PackageStatus;
  search?: string;
}

export function adaptBackendPackage(dto: BackendPackageDto): LearningPackage {
  const numPrice = typeof dto.price === 'number' ? dto.price : parseFloat(dto.price) || 0;
  const items = dto.items || [];
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug || dto.id,
    description: dto.description || '',
    price: numPrice,
    status: (dto.status === 'PUBLISHED' ? 'published' : dto.status === 'ARCHIVED' ? 'archived' : 'draft'),
    courseId: dto.courseId,
    coverImageId: null,
    items: items.map((item) => ({
      contentItemId: item.contentItemId,
      addedAt: item.addedAt || new Date().toISOString(),
      displayOrder: item.displayOrder ?? 0,
    })),
    createdAt: dto.createdAt || new Date().toISOString(),
    updatedAt: dto.updatedAt || new Date().toISOString(),
  };
}

export const adminPackageKeys = {
  all: (userId: string) => ['admin', userId, 'packages'] as const,
  lists: (userId: string) => [...adminPackageKeys.all(userId), 'list'] as const,
  list: (userId: string, filters: AdminPackageFilters) => [...adminPackageKeys.lists(userId), filters] as const,
  detail: (userId: string, packageId: string) => [...adminPackageKeys.all(userId), 'detail', packageId] as const,
};

export async function fetchAdminPackages(filters: AdminPackageFilters): Promise<{ packages: LearningPackage[]; pagination: AdminPackagesQueryResponse['pagination'] }> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.courseId) params.set('courseId', filters.courseId);
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status === 'published' ? 'PUBLISHED' : filters.status === 'archived' ? 'ARCHIVED' : 'DRAFT');
  }
  if (filters.search) params.set('search', filters.search);

  const response = await apiRequest<AdminPackagesQueryResponse>(`/api/admin/packages?${params.toString()}`);
  const packages = (response?.data || []).map(adaptBackendPackage);
  const pagination = response?.pagination || { page: filters.page || 1, limit: filters.limit || 50, total: packages.length, totalPages: 1 };
  return { packages, pagination };
}

export async function fetchAdminPackage(packageId: string): Promise<LearningPackage> {
  const dto = await apiRequest<BackendPackageDto>(`/api/admin/packages/${encodeURIComponent(packageId)}`);
  if (dto && dto.id) {
    return adaptBackendPackage(dto);
  }
  throw new Error('Package not found.');
}

export async function createAdminPackage(input: PackageInput): Promise<LearningPackage> {
  const dto = await apiRequest<BackendPackageDto>('/api/admin/packages', {
    method: 'POST',
    body: {
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status === 'published' ? 'PUBLISHED' : 'DRAFT',
      contentItemIds: input.contentItemIds,
    },
  });
  return adaptBackendPackage(dto);
}

export async function updateAdminPackage(packageId: string, input: PackageInput): Promise<LearningPackage> {
  const dto = await apiRequest<BackendPackageDto>(`/api/admin/packages/${encodeURIComponent(packageId)}`, {
    method: 'PATCH',
    body: {
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status === 'published' ? 'PUBLISHED' : input.status === 'archived' ? 'ARCHIVED' : 'DRAFT',
      contentItemIds: input.contentItemIds,
    },
  });
  return adaptBackendPackage(dto);
}

export async function deleteAdminPackage(packageId: string): Promise<void> {
  await apiRequest(`/api/admin/packages/${encodeURIComponent(packageId)}`, {
    method: 'DELETE',
  });
}

export function useAdminPackagesReadOnly(userId: string | null, filters: AdminPackageFilters) {
  return useQuery({
    queryKey: adminPackageKeys.list(userId ?? 'anonymous', filters),
    queryFn: () => fetchAdminPackages(filters),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useAdminPackageReadOnly(userId: string | null, packageId?: string) {
  return useQuery({
    queryKey: adminPackageKeys.detail(userId ?? 'anonymous', packageId ?? 'missing'),
    queryFn: () => fetchAdminPackage(packageId!),
    enabled: Boolean(userId && packageId),
    staleTime: 30_000,
  });
}

export function useCreateAdminPackage(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PackageInput) => createAdminPackage(input),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: adminPackageKeys.all(userId) });
      }
    },
  });
}

export function useUpdateAdminPackage(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, input }: { packageId: string; input: PackageInput }) => updateAdminPackage(packageId, input),
    onSuccess: (_, variables) => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: adminPackageKeys.all(userId) });
        void queryClient.invalidateQueries({ queryKey: adminPackageKeys.detail(userId, variables.packageId) });
      }
    },
  });
}

export function useDeleteAdminPackage(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => deleteAdminPackage(packageId),
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: adminPackageKeys.all(userId) });
      }
    },
  });
}
