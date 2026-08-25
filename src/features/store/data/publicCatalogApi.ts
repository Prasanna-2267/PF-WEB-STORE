import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { StoreProduct } from '../types/catalog';

export interface CatalogPackageDto {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  course?: { id: string; name: string; slug?: string; academy?: { id: string; name: string; slug: string } };
  _count?: { items: number };
  items?: Array<{
    id: string;
    displayOrder: number;
    contentItem: {
      id: string;
      name: string;
      description?: string;
      entityType?: string;
      mimeType?: string;
      kind?: string;
      size?: number;
      accessType?: string;
    };
  }>;
}

export interface CatalogPaidItemDto {
  id: string;
  courseId: string;
  name: string;
  description: string;
  price: number;
  accessType: 'PAID';
  entityType?: string;
  kind?: string;
  mimeType?: string;
  size?: number;
  course?: { id: string; name: string; code?: string; slug?: string; academy?: { id: string; name: string; slug: string } };
  sampleImages?: Array<{ id: string; name: string; displayOrder: number; url?: string; role?: string }>;
  storeSections?: Array<{ id: string; heading: string; content: string; displayOrder: number }>;
  highlights?: Array<{ id: string; heading: string; content: string; displayOrder: number }>;
}

export interface PublicCatalogResponse {
  courses: Array<{
    id: string;
    slug: string;
    code: string;
    name: string;
    description: string;
    academy?: { id: string; name: string; slug: string; logoUrl?: string | null };
    _count?: { subjects: number; contentItems: number; packages: number };
  }>;
  packages: CatalogPackageDto[];
  paidItems?: CatalogPaidItemDto[];
  pagination: {
    page: number;
    limit: number;
    totalCourses: number;
    totalPackages: number;
    totalPaidItems?: number;
  };
}

export function adaptCatalogPackageToProduct(dto: CatalogPackageDto): StoreProduct {
  const items = dto.items || [];
  const itemCount = dto._count?.items ?? items.length;

  return {
    id: dto.id,
    slug: dto.slug || dto.id,
    courseId: dto.courseId,
    title: dto.title,
    faculty: dto.course?.academy?.name || 'Parallax Flow Faculty',
    subject: dto.course?.name || 'Bundle Resource',
    course: (dto.course?.slug || dto.courseId || 'ca-intermediate') as any,
    productType: 'bundle',
    price: typeof dto.price === 'number' ? dto.price : parseFloat(String(dto.price)) || 0,
    currency: 'INR',
    discount: {
      originalPrice: Math.round((typeof dto.price === 'number' ? dto.price : parseFloat(String(dto.price)) || 0) * 1.3),
      percentage: 23,
      label: 'Special Bundle Discount',
    },
    language: 'English',
    difficulty: 'intermediate',
    releaseDate: new Date().toISOString(),
    version: 'Latest Edition',
    shortDescription: dto.description || `Complete learning package containing ${itemCount} resource files and folders.`,
    description: dto.description || `Comprehensive bundle for ${dto.course?.name || 'your preparation'}. Access all included materials inside the Parallax Flow student application after purchase.`,
    tags: ['Package', 'Bundle', dto.course?.name || 'Course'].filter(Boolean),
    collections: ['best-sellers', 'recommended'],
    rating: 4.9,
    ratingCount: 128,
    previewImages: items.slice(0, 3).map((item, index) => ({
      id: item.id || `preview-${index}`,
      src: '',
      alt: item.contentItem.name,
      kind: 'sample-page' as const,
    })),
    chapters: items.map((i) => i.contentItem.name),
    learningOutcomes: [
      `Access ${itemCount} curated study resources`,
      'Structured learning path designed for exam success',
      'Download and view offline inside the Parallax Flow App',
    ],
    included: items.map((i) => `${i.contentItem.name} (${i.contentItem.kind === 'FOLDER' ? 'Folder' : 'File'})`),
    audience: ['Students preparing for upcoming examinations', 'Learners looking for structured bundles'],
    deepLink: `parallaxflow://packages/${dto.id}`,
    isPremium: true,
    isActive: true,
  };
}

/**
 * Clean up raw content item names (which are often raw filenames) into
 * a human-readable display title.
 * e.g. "Apply_AI-_Analyze_Customer_gmail-com_6607a746-2b35-4eed.pdf"
 *   → "Apply AI Analyze Customer"
 */
function sanitizeContentName(raw: string): string {
  let name = raw;
  // Remove file extension
  name = name.replace(/\.[a-zA-Z0-9]{2,5}$/, '');
  // Remove UUID segments (8-4-4-4-12 hex)
  name = name.replace(/[_-]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  // Remove short hex IDs at end (e.g. _6607a746)
  name = name.replace(/[_-][0-9a-f]{6,}/gi, '');
  // Remove email-like fragments (e.g. gmail-com, yahoo-com)
  name = name.replace(/[_-]?[a-z0-9.]+-(com|org|net|in|io)[_-]?/gi, ' ');
  // Replace underscores and hyphens with spaces
  name = name.replace(/[_-]+/g, ' ');
  // Collapse multiple spaces
  name = name.replace(/\s{2,}/g, ' ').trim();
  return name || raw;
}

export function adaptCatalogItemToProduct(dto: CatalogPaidItemDto): StoreProduct {
  const highlights = dto.highlights || dto.storeSections || [];
  const sampleImages = dto.sampleImages || [];
  // Sort: PDF_FIRST_PAGE first, then by displayOrder
  const sortedImages = [...sampleImages].sort((a, b) => {
    if (a.role === 'PDF_FIRST_PAGE' && b.role !== 'PDF_FIRST_PAGE') return -1;
    if (a.role !== 'PDF_FIRST_PAGE' && b.role === 'PDF_FIRST_PAGE') return 1;
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });

  const priceNum = typeof dto.price === 'number' ? dto.price : parseFloat(String(dto.price)) || 0;

  return {
    id: dto.id,
    slug: dto.id,
    courseId: dto.courseId,
    title: sanitizeContentName(dto.name),
    faculty: dto.course?.academy?.name || 'Parallax Flow Faculty',
    subject: dto.course?.name || 'Paid Resource',
    course: (dto.course?.slug || dto.courseId || 'ca-intermediate') as any,
    productType: 'revision-notes',
    price: priceNum,
    currency: 'INR',
    discount: priceNum > 0
      ? {
          originalPrice: Math.round(priceNum * 1.25),
          percentage: 20,
          label: 'Early Bird',
        }
      : null,
    language: 'English',
    difficulty: 'intermediate',
    releaseDate: new Date().toISOString(),
    version: 'Latest Edition',
    shortDescription: dto.description || '',
    description: dto.description || '',
    tags: [dto.entityType, dto.course?.name].filter(Boolean) as string[],
    collections: ['most-popular'],
    rating: 4.8,
    ratingCount: 94,
    previewImages: sortedImages.map((img) => ({
      id: img.id,
      src: img.url || '',
      alt: img.name,
      kind: 'sample-page' as const,
    })),
    // storeSections used for real highlights — kept empty here; populated in detail view
    storeSections: highlights,
    chapters: [],
    learningOutcomes: highlights.map((h) => `${h.heading}: ${h.content}`),
    included: [],
    audience: [],
    deepLink: `parallaxflow://content/${dto.id}`,
    isPremium: true,
    isActive: true,
  };
}

export const publicCatalogKeys = {
  all: ['public', 'catalog'] as const,
  list: (params: { page?: number; limit?: number; search?: string; academyId?: string }) =>
    [...publicCatalogKeys.all, 'list', params] as const,
  packageDetail: (packageId: string) => [...publicCatalogKeys.all, 'package', packageId] as const,
  contentDetail: (contentId: string) => [...publicCatalogKeys.all, 'content', contentId] as const,
};

export async function fetchPublicCatalog(params: { page?: number; limit?: number; search?: string; academyId?: string } = {}): Promise<PublicCatalogResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.academyId) query.set('academyId', params.academyId);

  return apiRequest<PublicCatalogResponse>(`/api/catalog?${query.toString()}`);
}

export async function fetchPublicCatalogPackage(packageId: string): Promise<CatalogPackageDto> {
  return apiRequest<CatalogPackageDto>(`/api/catalog/packages/${encodeURIComponent(packageId)}`);
}

export async function fetchPublicCatalogContent(contentId: string): Promise<CatalogPaidItemDto> {
  return apiRequest<CatalogPaidItemDto>(`/api/catalog/content/${encodeURIComponent(contentId)}`);
}

export function usePublicCatalog(params: { page?: number; limit?: number; search?: string; academyId?: string } = {}) {
  return useQuery({
    queryKey: publicCatalogKeys.list(params),
    queryFn: () => fetchPublicCatalog(params),
    staleTime: 60_000,
  });
}

export function usePublicCatalogPackage(packageId?: string) {
  return useQuery({
    queryKey: publicCatalogKeys.packageDetail(packageId ?? 'missing'),
    queryFn: () => fetchPublicCatalogPackage(packageId!),
    enabled: Boolean(packageId),
    staleTime: 60_000,
  });
}

export function usePublicCatalogContent(contentId?: string) {
  return useQuery({
    queryKey: publicCatalogKeys.contentDetail(contentId ?? 'missing'),
    queryFn: () => fetchPublicCatalogContent(contentId!),
    enabled: Boolean(contentId),
    staleTime: 60_000,
  });
}

export async function fetchPublicCatalogCollection(key: string, courseSlug = 'all') {
  const query = new URLSearchParams({ courseSlug });
  return apiRequest<{ section: any; products: any[] }>(`/api/catalog/collections/${encodeURIComponent(key)}?${query.toString()}`);
}

export function usePublicCatalogCollection(key: string, courseSlug = 'all', userId?: string) {
  return useQuery({
    queryKey: [...publicCatalogKeys.all, 'collection', key, courseSlug, userId],
    queryFn: () => fetchPublicCatalogCollection(key, courseSlug),
    staleTime: 30_000,
  });
}

export async function fetchPublicCatalogUserCourses() {
  return apiRequest<{ courses: Array<{ id: string; name: string; slug: string; code: string }> }>('/api/catalog/user-courses');
}

export function usePublicCatalogUserCourses(enabled = true) {
  return useQuery({
    queryKey: [...publicCatalogKeys.all, 'user-courses'],
    queryFn: fetchPublicCatalogUserCourses,
    enabled,
    staleTime: 60_000,
  });
}
