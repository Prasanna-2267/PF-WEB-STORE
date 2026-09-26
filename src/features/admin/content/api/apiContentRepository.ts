import type {
  ContentAccessType,
  ContentBreadcrumb,
  ContentFolderSummary,
  ContentItem,
  ContentItemKind,
  ContentEntityType,
  ContentLocationSettings,
  ContentPublishInput,
  ContentSampleImage,
  ContentSearchResult,
  ContentStoreSection,
  AccessDurationUnit,
  ContentUploadInput,
  CreateContentFolderInput,
} from '../types/content';
import {
  ContentRepositoryError,
  type ContentRepository,
} from './contentRepository';
import { apiRequest } from '@/lib/api/client';
import { retryUploadStep } from '@/lib/api/uploadRetry';

const ROOT_NAME = 'My Flow';
const fileSources = new Map<string, File>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Content is course-scoped and the production API accepts database UUIDs only.
 * The repository is initialized before the asynchronously loaded course picker,
 * so an absent course must mean "not ready" rather than the legacy fixture id.
 */
function resolveTargetCourse(courseId?: string): string | null {
  return courseId && UUID_PATTERN.test(courseId) ? courseId : null;
}

function repositoryFailure(error: unknown, fallbackMessage: string): ContentRepositoryError {
  if (error instanceof ContentRepositoryError) return error;
  const response = error && typeof error === 'object'
    ? error as { status?: number; code?: string; message?: string }
    : undefined;
  const code = response?.status === 409 ? 'CONFLICT'
    : response?.status === 400 || response?.status === 422 ? 'VALIDATION_ERROR'
      : 'STORAGE_ERROR';
  return new ContentRepositoryError(code, response?.message || fallbackMessage);
}

function requireBackend(error: unknown, message: string): never {
  throw repositoryFailure(error, message);
}

interface BackendContentDto {
  id: string;
  courseId?: string;
  parentId?: string | null;
  name: string;
  size?: number;
  mimeType?: string | null;
  description?: string;
  kind?: string;
  entityType?: string;
  accessType?: string;
  price?: number | null;
  accessDurationValue?: number | null;
  accessDurationUnit?: AccessDurationUnit | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  sampleImages?: Array<{
    id: string;
    role?: 'ADMIN_PREVIEW' | 'PDF_FIRST_PAGE';
    name: string;
    mimeType: string;
    size?: number;
    displayOrder: number;
    url?: string;
    dataUrl?: string;
  }>;
  storeSections?: Array<{ id: string; heading: string; content: string; displayOrder: number }>;
}

function adaptBackendContent(dto: BackendContentDto): ContentItem {
  const isFolder = dto.kind === 'FOLDER' || dto.entityType === 'FOLDER' || dto.kind === 'folder';
  const backendSampleImages = dto.sampleImages
    ?.filter((image) => image.role !== 'PDF_FIRST_PAGE')
    .map((image) => ({
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      size: Number(image.size ?? 0),
      dataUrl: image.url || image.dataUrl || '',
      order: image.displayOrder,
    })) ?? [];
  const backendStoreSections = dto.storeSections
    ?.map((section) => ({ ...section, order: section.displayOrder })) ?? [];
  return {
    id: dto.id,
    courseId: dto.courseId || '',
    parentId: dto.parentId || null,
    name: dto.name,
    kind: isFolder ? 'folder' : 'file',
    size: isFolder ? 0 : Number(dto.size ?? 0),
    createdAt: dto.createdAt || '',
    updatedAt: dto.updatedAt || '',
    lastOpenedAt: null,
    owner: '',
    mimeType: isFolder ? null : dto.mimeType ?? null,
    storagePath: null,
    description: dto.description ?? '',
    entityType: isFolder ? null : 'study-material',
    accessType: (dto.accessType || 'FREE') as any,
    price: dto.price ?? null,
    accessDurationValue: dto.accessDurationValue ?? null,
    accessDurationUnit: dto.accessDurationUnit ?? null,
    sampleImages: backendSampleImages,
    storeSections: backendStoreSections,
    displayOrder: 0,
  };
}

async function calculateSha256(blob: Blob): Promise<string> {
  try {
    if (typeof globalThis.crypto?.subtle?.digest === 'function') {
      const buffer = await blob.arrayBuffer();
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (error) {
    throw repositoryFailure(error, 'The selected file checksum could not be calculated. Please try again in a supported browser.');
  }
  throw new ContentRepositoryError('STORAGE_ERROR', 'This browser cannot securely calculate file checksums. Please update the browser and try again.');
}

const isNewSampleImage = (image: ContentSampleImage): boolean => image.dataUrl.startsWith('data:');

async function uploadSampleImage(contentId: string, image: ContentSampleImage, displayOrder: number) {
  const response = await fetch(image.dataUrl);
  if (!response.ok) throw new ContentRepositoryError('STORAGE_ERROR', `The preview image "${image.name}" could not be read.`);
  const blob = await response.blob();
  const mimeType = (image.mimeType === 'image/jpg' ? 'image/jpeg' : image.mimeType) || blob.type;
  const checksumSha256 = await calculateSha256(blob);
  const intent = await apiRequest<{ uploadId: string }>(`/api/admin/content/${encodeURIComponent(contentId)}/sample-images/upload-intent`, {
    method: 'POST',
    body: { fileName: image.name, mimeType, sizeBytes: blob.size, checksumSha256 },
    timeoutMs: 300_000,
  });

  await retryUploadStep(() => apiRequest(`/api/admin/content/uploads/${encodeURIComponent(intent.uploadId)}/binary`, {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: blob,
    timeoutMs: 300_000,
  }));

  return retryUploadStep(() => apiRequest<NonNullable<BackendContentDto['sampleImages']>[number]>(`/api/admin/content/${encodeURIComponent(contentId)}/sample-images/finalize`, {
    method: 'POST',
    body: { uploadId: intent.uploadId, displayOrder: displayOrder + 1 },
    timeoutMs: 300_000,
  }));
}

async function syncSampleImages(contentId: string, desiredImages: ContentSampleImage[]) {
  const detail = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(contentId)}`);
  const currentImages = (detail.sampleImages || []).filter((image) => image.role !== 'PDF_FIRST_PAGE');
  const preservedIds = new Set(desiredImages.filter((image) => !isNewSampleImage(image)).map((image) => image.id));

  await Promise.all(currentImages
    .filter((image) => !preservedIds.has(image.id))
    .map((image) => apiRequest(`/api/admin/content/${encodeURIComponent(contentId)}/sample-images/${encodeURIComponent(image.id)}`, { method: 'DELETE' })));

  const persisted: NonNullable<BackendContentDto['sampleImages']> = [];
  for (const [index, image] of desiredImages.slice(0, 3).entries()) {
    const existing = currentImages.find((candidate) => candidate.id === image.id && !isNewSampleImage(image));
    if (existing) persisted.push({ ...existing, displayOrder: index + 1, url: image.dataUrl || existing.url });
    else persisted.push({ ...(await uploadSampleImage(contentId, image, index)), url: image.dataUrl });
  }
  return persisted;
}

export class ApiContentRepository implements ContentRepository {
  async getAllItems(courseId?: string): Promise<ContentItem[]> {
    const targetCourse = resolveTargetCourse(courseId);
    if (!targetCourse) return [];
    try {
      const response = await apiRequest<{ data: BackendContentDto[] }>(`/api/admin/content?courseId=${encodeURIComponent(targetCourse)}&parentId=all&limit=1000`);
      if (response && Array.isArray(response.data)) {
        return clone(response.data.map(adaptBackendContent));
      }
    } catch (error) {
      requireBackend(error, 'Content could not be loaded from the server.');
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'The server returned an invalid content list.');
  }

  async getChildren(parentId: string | null, courseId?: string): Promise<ContentItem[]> {
    const targetCourse = resolveTargetCourse(courseId);
    if (!targetCourse) return [];
    const key = this.getLocationKey(targetCourse, parentId);
    const childOrder = this.locationSettingsMap.get(key)?.childOrder;
    const sortWithOrder = (list: ContentItem[]): ContentItem[] => {
      if (childOrder && childOrder.length > 0) {
        const orderMap = new Map(childOrder.map((id, index) => [id, index]));
        return list.sort((a, b) => {
          const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
          const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
          if (indexA !== indexB) return indexA - indexB;
          return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        });
      }
      return list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    };

    try {
      const url = `/api/admin/content?courseId=${encodeURIComponent(targetCourse)}${parentId ? `&parentId=${encodeURIComponent(parentId)}` : ''}`;
      const response = await apiRequest<{ data: BackendContentDto[] }>(url);
      if (response && Array.isArray(response.data)) {
        const remoteItems = response.data.map(adaptBackendContent);
        return clone(sortWithOrder(remoteItems));
      }
    } catch (error) {
      requireBackend(error, 'This content folder could not be loaded from the server.');
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'The server returned an invalid folder listing.');
  }

  async getItem(itemId: string, courseId?: string): Promise<ContentItem> {
    try {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(itemId)}`);
      if (dto && dto.id) {
        return adaptBackendContent(dto);
      }
    } catch (error) {
      requireBackend(error, 'The content item could not be loaded from the server.');
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'The server returned an invalid content item.');
  }

  async getBreadcrumb(folderId: string | null, courseId?: string): Promise<ContentBreadcrumb[]> {
    const rootCrumb: ContentBreadcrumb = { id: null, name: ROOT_NAME };
    if (!folderId) return [rootCrumb];

    const all = await this.getAllItems(courseId);
    const itemMap = new Map(all.map((item) => [item.id, item]));

    const path: ContentBreadcrumb[] = [];
    let currentId: string | null = folderId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId) && visited.size < 30) {
      visited.add(currentId);
      const item = itemMap.get(currentId);
      if (item) {
        path.push({ id: item.id, name: item.name });
        currentId = item.parentId;
      } else {
        try {
          const fetched = await this.getItem(currentId, courseId);
          if (fetched) {
            path.push({ id: fetched.id, name: fetched.name });
            currentId = fetched.parentId;
          } else {
            throw new ContentRepositoryError('NOT_FOUND', 'A folder in this content path no longer exists.');
          }
        } catch (error) {
          throw repositoryFailure(error, 'The content path could not be loaded from the server.');
        }
      }
    }

    path.reverse();
    return [rootCrumb, ...path];
  }

  async getFolders(courseId?: string): Promise<ContentItem[]> {
    const all = await this.getAllItems(courseId);
    return all.filter((item) => item.kind === 'folder');
  }

  async getFolderSummary(folderId: string, courseId?: string): Promise<ContentFolderSummary> {
    const all = await this.getAllItems(courseId);
    let files = 0;
    let folders = 0;
    let totalSize = 0;

    const countSubtree = (parentId: string) => {
      const children = all.filter((item) => item.parentId === parentId);
      children.forEach((child) => {
        if (child.kind === 'folder') {
          folders += 1;
          countSubtree(child.id);
        } else {
          files += 1;
          totalSize += child.size;
        }
      });
    };

    countSubtree(folderId);
    return { files, folders, totalSize };
  }

  private locationSettingsMap = new Map<string, { pageHeading: string; childOrder: string[] }>();

  private getLocationKey(courseId: string, folderId: string | null): string {
    const norm = (!folderId || folderId === 'null' || folderId === 'undefined') ? 'root' : folderId;
    return `${courseId}:${norm}`;
  }

  async getLocationSettings(courseId: string, folderId: string | null): Promise<ContentLocationSettings> {
    const key = this.getLocationKey(courseId, folderId);
    let pageHeading = 'Untitled Page';
    let childOrder: string[] = [];

    try {
      const url = `/api/admin/content/locations?courseId=${encodeURIComponent(courseId)}${folderId ? `&folderId=${encodeURIComponent(folderId)}` : ''}`;
      const res = await apiRequest<{ id?: string; courseId: string; folderId: string | null; pageHeading: string }>(url);
      if (res && res.pageHeading) {
        pageHeading = res.pageHeading;
      }
    } catch (error) {
      requireBackend(error, 'The page heading could not be loaded from the server.');
    }

    const existingMap = this.locationSettingsMap.get(key);
    if (existingMap) childOrder = existingMap.childOrder;

    this.locationSettingsMap.set(key, { pageHeading, childOrder });
    return {
      courseId,
      folderId,
      pageHeading,
      childOrder,
    };
  }

  async updatePageHeading(courseId: string, folderId: string | null, pageHeading: string): Promise<ContentLocationSettings> {
    const key = this.getLocationKey(courseId, folderId);
    const trimmed = pageHeading.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === 'untitled page' || lower === 'untitled_page') {
      throw new ContentRepositoryError('VALIDATION_ERROR', 'Please enter a valid page heading.');
    }

    let updatedHeading = trimmed;
    try {
      const res = await apiRequest<{ id?: string; courseId: string; folderId: string | null; pageHeading: string }>('/api/admin/content/locations', {
        method: 'PATCH',
        body: {
          courseId,
          folderId: folderId ?? null,
          pageHeading: trimmed,
        },
      });
      if (res && res.pageHeading) {
        updatedHeading = res.pageHeading;
      }
    } catch (error) {
      requireBackend(error, 'Failed to update the page heading on the server.');
    }

    const existing = this.locationSettingsMap.get(key);
    const updated = {
      pageHeading: updatedHeading,
      childOrder: existing?.childOrder ?? [],
    };
    this.locationSettingsMap.set(key, updated);
    return {
      courseId,
      folderId,
      pageHeading: updatedHeading,
      childOrder: updated.childOrder,
    };
  }

  async saveChildOrder(courseId: string, folderId: string | null, childOrder: string[]): Promise<ContentLocationSettings> {
    const key = this.getLocationKey(courseId, folderId);
    try {
      await apiRequest('/api/admin/content/display-orders', {
        method: 'PATCH',
        body: {
          courseId,
          folderId: folderId ?? null,
          itemIds: childOrder,
        },
      });
    } catch (error) {
      requireBackend(error, 'The content order could not be saved on the server.');
    }


    const existing = this.locationSettingsMap.get(key);
    const pageHeading = existing?.pageHeading ?? 'Untitled Page';
    this.locationSettingsMap.set(key, { pageHeading, childOrder });
    return {
      courseId,
      folderId,
      pageHeading,
      childOrder,
    };
  }

  async searchItems(query: string, courseId?: string): Promise<ContentSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await this.getAllItems(courseId);
    const matches = all.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q));

    const results: ContentSearchResult[] = [];
    for (const item of matches) {
      const path = await this.getBreadcrumb(item.parentId, courseId);
      results.push({ item, path });
    }
    return results;
  }

  async createFolder(input: CreateContentFolderInput): Promise<ContentItem> {
    try {
      const dto = await apiRequest<BackendContentDto>('/api/admin/content/folders', {
        method: 'POST',
        body: {
          courseId: input.courseId,
          parentId: input.parentId || undefined,
          name: input.name,
        },
      });
      return adaptBackendContent(dto);
    } catch (error) {
      requireBackend(error, 'The folder could not be created on the server.');
    }
  }

  async uploadFile(parentId: string | null, input: ContentUploadInput): Promise<ContentItem> {
    if (!input.sourceFile) throw new ContentRepositoryError('VALIDATION_ERROR', 'The selected file is no longer available. Please select it again.');
    const [uploaded] = await this.publishContent({
      courseId: input.courseId,
      destinationId: parentId,
      entries: [{
        temporaryId: crypto.randomUUID(),
        parentTemporaryId: null,
        relativePath: input.name,
        kind: 'file',
        name: input.name,
        size: input.size,
        mimeType: input.mimeType,
        sourceFile: input.sourceFile,
        entityType: input.entityType,
        accessType: input.accessType ?? 'FREE',
        price: input.price ?? null,
        accessDurationValue: input.accessDurationValue ?? null,
        accessDurationUnit: input.accessDurationUnit ?? null,
        description: input.description ?? '',
        sampleImages: input.sampleImages ?? [],
        storeSections: input.storeSections ?? [],
        displayOrder: input.displayOrder ?? 0,
      }],
    });
    if (!uploaded) throw new ContentRepositoryError('STORAGE_ERROR', 'The server did not return the uploaded content item.');
    return uploaded;
  }

  async publishContent(input: ContentPublishInput): Promise<ContentItem[]> {
    const temporaryToRealId = new Map<string, string>();
    const results: ContentItem[] = [];

    const folderEntries = input.entries.filter((e) => e.kind === 'folder');
    const fileEntries = input.entries.filter((e) => e.kind === 'file');

    // 1. Process Folders first and build temporaryToRealId mapping
    for (const folderEntry of folderEntries) {
      const parentId = folderEntry.parentTemporaryId
        ? temporaryToRealId.get(folderEntry.parentTemporaryId) || input.destinationId
        : input.destinationId;

      let createdItem: ContentItem | null = null;
      try {
        const createdFolderDto = await apiRequest<BackendContentDto>('/api/admin/content/folders', {
          method: 'POST',
          body: {
            courseId: input.courseId,
            parentId: parentId || undefined,
            name: folderEntry.name,
            description: folderEntry.description || undefined,
            displayOrder: folderEntry.displayOrder || 0,
          },
        });
        if (createdFolderDto && createdFolderDto.id) {
          createdItem = adaptBackendContent(createdFolderDto);
        }
      } catch (error) {
        requireBackend(error, `The folder "${folderEntry.name}" could not be created.`);
      }
      if (!createdItem) throw new ContentRepositoryError('STORAGE_ERROR', `The server did not return the created folder "${folderEntry.name}".`);


      if (folderEntry.pageHeading) {
        await this.updatePageHeading(input.courseId, createdItem.id, folderEntry.pageHeading);
      }

      temporaryToRealId.set(folderEntry.temporaryId, createdItem.id);
      results.push(createdItem);
    }

    // 2. Process Files next using the resolved folder parentIds
    for (const fileEntry of fileEntries) {
      const parentId = fileEntry.parentTemporaryId
        ? temporaryToRealId.get(fileEntry.parentTemporaryId) || input.destinationId
        : input.destinationId;

      let createdItem: ContentItem | null = null;
      try {
        if (!fileEntry.sourceFile) {
          throw new ContentRepositoryError('VALIDATION_ERROR', `The source file for "${fileEntry.name}" is no longer available. Please select it again.`);
        }
        const filePayload = fileEntry.sourceFile;
        const checksumSha256 = await calculateSha256(filePayload);
        const intent = await apiRequest<{ uploadId: string; uploadUrl: string; headers: Record<string, string>; objectKey: string }>('/api/admin/content/upload-intents', {
          method: 'POST',
          body: {
            courseId: input.courseId,
            parentId: parentId || undefined,
            fileName: fileEntry.name,
            mimeType: fileEntry.mimeType || 'application/pdf',
            sizeBytes: filePayload.size || fileEntry.size || 1024,
            checksumSha256,
          },
          timeoutMs: 300_000,
        });

        if (intent?.uploadId) {
          // Upload binary payload directly via server proxy to eliminate browser CORS errors
          await retryUploadStep(() => apiRequest<{ uploadId: string }>(`/api/admin/content/uploads/${encodeURIComponent(intent.uploadId)}/binary`, {
            method: 'POST',
            headers: {
              'Content-Type': fileEntry.mimeType || 'application/octet-stream',
            },
            body: filePayload,
            timeoutMs: 600_000,
          }));

          const dto = await retryUploadStep(() => apiRequest<BackendContentDto>(`/api/admin/content/uploads/${encodeURIComponent(intent.uploadId)}/finalize`, {
            method: 'POST',
            body: {
              parentId: parentId || undefined,
              description: fileEntry.description,
              accessType: fileEntry.accessType,
              price: fileEntry.price ?? undefined,
              accessDurationValue: fileEntry.accessDurationValue,
              accessDurationUnit: fileEntry.accessDurationUnit,
            },
            timeoutMs: 300_000,
          }));

          if (dto && dto.id) {
            const metadataDto = fileEntry.accessType === 'PAID'
              ? await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(dto.id)}`, {
                  method: 'PATCH',
                  body: {
                    storeSections: fileEntry.storeSections.map((section, index) => ({
                      heading: section.heading,
                      content: section.content,
                      displayOrder: index,
                    })),
                  },
                })
              : dto;
            const persistedImages = fileEntry.accessType === 'PAID'
              ? await syncSampleImages(dto.id, fileEntry.sampleImages)
              : [];
            createdItem = adaptBackendContent({ ...metadataDto, sampleImages: persistedImages });
          }
        }
      } catch (error) {
        requireBackend(error, `The file "${fileEntry.name}" could not be published. Please try again.`);
      }
      if (!createdItem) throw new ContentRepositoryError('STORAGE_ERROR', `The server did not return the published file "${fileEntry.name}".`);


      results.push(createdItem);
    }

    return results;
  }

  async renameItem(itemId: string, name: string): Promise<ContentItem> {
    try {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: { name },
      });
      if (dto && dto.id) {
        return adaptBackendContent(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new ContentRepositoryError('STORAGE_ERROR', err.message);
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'Failed to rename content on backend.');
  }

  async deleteItems(itemIds: string[]): Promise<void> {
    for (const id of itemIds) {
      await apiRequest(`/api/admin/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
      for (const [key] of this.locationSettingsMap.entries()) {
        if (key.includes(id)) {
          this.locationSettingsMap.delete(key);
        }
      }
    }
  }

  async restoreItem(item: ContentItem): Promise<void> {
    const restored = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(item.id)}/restore`, { method: 'POST' });
    if (!restored?.id) throw new ContentRepositoryError('STORAGE_ERROR', `The server did not confirm that "${item.name}" was restored.`);
  }

  async copyItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]> {
    const results: ContentItem[] = [];
    for (const id of itemIds) {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(id)}/copy`, {
        method: 'POST', body: { parentId: destinationId },
      });
      results.push(adaptBackendContent(dto));
    }
    return results;
  }

  async moveItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]> {
    const results: ContentItem[] = [];
    for (const id of itemIds) {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(id)}/move`, {
        method: 'POST', body: { parentId: destinationId },
      });
      results.push(adaptBackendContent(dto));
    }
    return results;
  }

  async updateDescription(itemId: string, description: string): Promise<ContentItem> {
    try {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: { description },
      });
      if (dto && dto.id) {
        return adaptBackendContent(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw new ContentRepositoryError('STORAGE_ERROR', err.message);
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'Failed to update description.');
  }

  async updateAccessType(
    itemId: string,
    accessType: ContentAccessType,
    price?: number | null,
    applyToChildren = false,
    description?: string,
    sampleImages?: ContentSampleImage[],
    storeSections?: ContentStoreSection[],
    accessDurationValue: number | null = null,
    accessDurationUnit: AccessDurationUnit | null = null
  ): Promise<ContentItem> {
    try {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: {
          accessType,
          price: accessType === 'FREE' ? null : (price ?? undefined),
          applyToChildren,
          accessDurationValue: accessType === 'PAID' ? accessDurationValue : null,
          accessDurationUnit: accessType === 'PAID' ? accessDurationUnit : null,
          ...(description !== undefined ? { description } : {}),
          ...(storeSections !== undefined ? { storeSections: storeSections.map((s, idx) => ({ heading: s.heading, content: s.content, displayOrder: idx })) } : {}),
        },
      });
      if (dto && dto.id) {
        const persistedImages = await syncSampleImages(itemId, accessType === 'PAID' ? (sampleImages ?? []) : []);
        const item = adaptBackendContent({ ...dto, sampleImages: persistedImages });
        const merged: ContentItem = {
          ...item,
          accessType,
          price: accessType === 'FREE' ? null : price ?? null,
          accessDurationValue: accessType === 'PAID' ? accessDurationValue : null,
          accessDurationUnit: accessType === 'PAID' ? accessDurationUnit : null,
          ...(description !== undefined ? { description } : {}),
          ...(sampleImages ? { sampleImages } : {}),
          ...(storeSections ? { storeSections } : {}),
        };
        return merged;
      }
    } catch (err) {
      if (err instanceof Error) throw new ContentRepositoryError('STORAGE_ERROR', err.message);
    }
    throw new ContentRepositoryError('STORAGE_ERROR', 'Failed to update access type on backend.');
  }

  async markOpened(itemId: string): Promise<void> {
    // No-op
  }

  getFileSource(itemId: string): File | undefined {
    return fileSources.get(itemId);
  }
}

export const apiContentRepository = new ApiContentRepository();
