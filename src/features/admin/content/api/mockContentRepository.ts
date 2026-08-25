import { CONTENT_FIXTURES } from '../data/contentFixtures';
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
  ContentUploadInput,
  CreateContentFolderInput,
} from '../types/content';
import {
  ContentRepositoryError,
  type ContentRepository,
} from './contentRepository';
import { apiRequest } from '@/lib/api/client';
import { retryUploadStep } from '@/lib/api/uploadRetry';

const STORAGE_KEY = 'pf_admin_content_v1';
const ROOT_NAME = 'My Flow';
const fileSources = new Map<string, File>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const allowOfflineFixtures = import.meta.env.MODE === 'test';

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

function requireBackend(error: unknown, fallbackMessage: string): void {
  if (!allowOfflineFixtures) throw repositoryFailure(error, fallbackMessage);
}

interface LocalItemMetadata {
  description?: string;
  sampleImages?: any[];
  storeSections?: any[];
}

function getItemMetadata(itemId: string): LocalItemMetadata | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`pf_item_meta_${itemId}`);
      if (raw) return JSON.parse(raw) as LocalItemMetadata;
    }
  } catch {
    // Fallback
  }
  return null;
}

export function saveItemMetadata(itemId: string, metadata: LocalItemMetadata): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = getItemMetadata(itemId) || {};
      const next = { ...existing, ...metadata };
      localStorage.setItem(`pf_item_meta_${itemId}`, JSON.stringify(next));
    }
  } catch {
    // Fallback
  }
}

let items: ContentItem[] = clone(CONTENT_FIXTURES);

interface BackendContentDto {
  id: string;
  courseId?: string;
  parentId?: string | null;
  name: string;
  kind?: string;
  entityType?: string;
  accessType?: string;
  price?: number | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

function adaptBackendContent(dto: BackendContentDto): ContentItem {
  const isFolder = dto.kind === 'FOLDER' || dto.entityType === 'FOLDER' || dto.kind === 'folder';
  const meta = getItemMetadata(dto.id);
  const localItem = items.find((i) => i.id === dto.id);
  return {
    id: dto.id,
    courseId: dto.courseId || 'course-chartered-accountancy',
    parentId: dto.parentId || null,
    name: dto.name,
    kind: isFolder ? 'folder' : 'file',
    size: isFolder ? 0 : 1024 * 1024,
    createdAt: dto.createdAt || new Date().toISOString(),
    updatedAt: dto.updatedAt || new Date().toISOString(),
    lastOpenedAt: null,
    owner: 'Super Admin',
    mimeType: isFolder ? null : 'application/pdf',
    storagePath: null,
    description: meta?.description ?? localItem?.description ?? '',
    entityType: isFolder ? null : 'study-material',
    accessType: (dto.accessType || 'FREE') as any,
    price: dto.price ?? null,
    sampleImages: (dto as any).sampleImages ?? meta?.sampleImages ?? localItem?.sampleImages ?? [],
    storeSections: (dto as any).storeSections ?? meta?.storeSections ?? localItem?.storeSections ?? [],
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
  } catch {
    // Fallback if subtle crypto unavailable
  }
  return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
}

export class MockContentRepository implements ContentRepository {
  async getAllItems(courseId?: string): Promise<ContentItem[]> {
    const targetCourse = courseId || 'course-chartered-accountancy';
    try {
      const response = await apiRequest<{ data: BackendContentDto[] }>(`/api/admin/content?courseId=${encodeURIComponent(targetCourse)}&parentId=all&limit=1000`);
      if (response && Array.isArray(response.data)) {
        return clone(response.data.map(adaptBackendContent));
      }
    } catch (error) {
      requireBackend(error, 'Content could not be loaded from the server.');
    }
    const localForCourse = items.filter((item) => !item.courseId || item.courseId === targetCourse);
    return clone(localForCourse);
  }

  async getChildren(parentId: string | null, courseId?: string): Promise<ContentItem[]> {
    const targetCourse = courseId || 'course-chartered-accountancy';
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
    const all = items.filter((item) => (!item.courseId || item.courseId === targetCourse) && (item.parentId ?? null) === parentId);
    return clone(sortWithOrder(all));
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
    const found = items.find((i) => i.id === itemId);
    if (found) return clone(found);
    throw new ContentRepositoryError('NOT_FOUND', 'Item not found.');
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
            break;
          }
        } catch {
          break;
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
      const existing = this.locationSettingsMap.get(key);
      if (existing) {
        pageHeading = existing.pageHeading;
        childOrder = existing.childOrder;
      }
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

    // Update displayOrder in local items
    const orderMap = new Map(childOrder.map((id, index) => [id, index]));
    items.forEach((item) => {
      if ((!item.courseId || item.courseId === courseId) && (item.parentId ?? null) === folderId && orderMap.has(item.id)) {
        item.displayOrder = orderMap.get(item.id)!;
      }
    });

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
      if (dto && dto.id) {
        const item = adaptBackendContent(dto);
        items.push(item);
        return item;
      }
    } catch (error) {
      requireBackend(error, 'The folder could not be created on the server.');
    }
    const folder: ContentItem = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      courseId: input.courseId,
      parentId: input.parentId || null,
      name: input.name,
      kind: 'folder',
      size: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: null,
      owner: 'Super Admin',
      mimeType: null,
      storagePath: null,
      description: '',
      entityType: null,
      accessType: 'FREE',
      price: null,
      sampleImages: [],
      storeSections: [],
      displayOrder: 0,
    };
    items.push(folder);
    return folder;
  }

  async uploadFile(parentId: string | null, input: ContentUploadInput): Promise<ContentItem> {
    const item: ContentItem = {
      id: `content-${Date.now()}`,
      courseId: input.courseId,
      parentId: parentId,
      name: input.name,
      kind: 'file',
      size: input.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: null,
      owner: 'Super Admin',
      mimeType: input.mimeType,
      storagePath: null,
      description: input.description || '',
      entityType: input.entityType || 'study-material',
      accessType: input.accessType || 'FREE',
      price: input.price ?? null,
      sampleImages: input.sampleImages || [],
      storeSections: input.storeSections || [],
      displayOrder: input.displayOrder || 0,
    };
    items.push(item);
    return item;
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

      if (!createdItem) {
        createdItem = {
          id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          courseId: input.courseId,
          parentId: parentId || null,
          name: folderEntry.name,
          kind: 'folder',
          size: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: null,
          owner: 'Super Admin',
          mimeType: null,
          storagePath: null,
          description: folderEntry.description || '',
          entityType: null,
          accessType: 'FREE',
          price: null,
          sampleImages: [],
          storeSections: [],
          displayOrder: folderEntry.displayOrder || 0,
        };
      }

      if (folderEntry.pageHeading) {
        try {
          await this.updatePageHeading(input.courseId, createdItem.id, folderEntry.pageHeading);
        } catch {
          // Ignore
        }
      }

      temporaryToRealId.set(folderEntry.temporaryId, createdItem.id);
      results.push(createdItem);
      items.push(createdItem);
    }

    // 2. Process Files next using the resolved folder parentIds
    for (const fileEntry of fileEntries) {
      const parentId = fileEntry.parentTemporaryId
        ? temporaryToRealId.get(fileEntry.parentTemporaryId) || input.destinationId
        : input.destinationId;

      let createdItem: ContentItem | null = null;
      try {
        if (!fileEntry.sourceFile && !allowOfflineFixtures) {
          throw new ContentRepositoryError('VALIDATION_ERROR', `The source file for "${fileEntry.name}" is no longer available. Please select it again.`);
        }
        const filePayload = fileEntry.sourceFile || new Blob(['Parallax Flow content file binary'], { type: fileEntry.mimeType || 'application/pdf' });
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
            },
            timeoutMs: 300_000,
          }));

          if (dto && dto.id) {
            createdItem = adaptBackendContent(dto);
          }
        }
      } catch (error) {
        requireBackend(error, `The file "${fileEntry.name}" could not be published. Please try again.`);
      }

      if (!createdItem) {
        createdItem = {
          id: `content-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          courseId: input.courseId,
          parentId: parentId || null,
          name: fileEntry.name,
          kind: 'file',
          size: fileEntry.size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: null,
          owner: 'Super Admin',
          mimeType: fileEntry.mimeType,
          storagePath: null,
          description: fileEntry.description,
          entityType: fileEntry.entityType || 'study-material',
          accessType: fileEntry.accessType,
          price: fileEntry.price,
          sampleImages: fileEntry.sampleImages,
          storeSections: fileEntry.storeSections,
          displayOrder: fileEntry.displayOrder,
        };
      }

      if (fileEntry.sampleImages?.length || fileEntry.storeSections?.length || fileEntry.description) {
        saveItemMetadata(createdItem.id, {
          description: fileEntry.description ?? '',
          sampleImages: fileEntry.sampleImages ?? [],
          storeSections: fileEntry.storeSections ?? [],
        });
      }
      results.push(createdItem);
      items.push(createdItem);
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
      try {
        await apiRequest(`/api/admin/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        // Ignore
      }
      for (const [key] of this.locationSettingsMap.entries()) {
        if (key.includes(id)) {
          this.locationSettingsMap.delete(key);
        }
      }
      const index = items.findIndex((i) => i.id === id);
      if (index !== -1) {
        items.splice(index, 1);
      }
    }
  }

  async restoreItem(item: ContentItem): Promise<void> {
    const existing = items.find((i) => i.id === item.id);
    if (!existing) {
      items.push(item);
    }
  }

  async copyItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]> {
    const results: ContentItem[] = [];
    for (const id of itemIds) {
      try {
        const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(id)}/copy`, {
          method: 'POST',
          body: { parentId: destinationId },
        });
        if (dto && dto.id) results.push(adaptBackendContent(dto));
      } catch {
        // Ignore
      }
    }
    return results;
  }

  async moveItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]> {
    const results: ContentItem[] = [];
    for (const id of itemIds) {
      try {
        const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(id)}/move`, {
          method: 'POST',
          body: { parentId: destinationId },
        });
        if (dto && dto.id) results.push(adaptBackendContent(dto));
      } catch {
        // Ignore
      }
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
    storeSections?: ContentStoreSection[]
  ): Promise<ContentItem> {
    saveItemMetadata(itemId, {
      description: description ?? '',
      sampleImages: sampleImages ?? [],
      storeSections: storeSections ?? [],
    });
    try {
      const dto = await apiRequest<BackendContentDto>(`/api/admin/content/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: {
          accessType,
          price: accessType === 'FREE' ? null : (price ?? undefined),
          applyToChildren,
          ...(description !== undefined ? { description } : {}),
          ...(storeSections !== undefined ? { storeSections: storeSections.map((s, idx) => ({ heading: s.heading, content: s.content, displayOrder: idx })) } : {}),
        },
      });
      if (dto && dto.id) {
        const item = adaptBackendContent(dto);
        const idx = items.findIndex((i) => i.id === itemId);
        const merged: ContentItem = {
          ...item,
          accessType,
          price: accessType === 'FREE' ? null : price ?? null,
          ...(description !== undefined ? { description } : {}),
          ...(sampleImages ? { sampleImages } : {}),
          ...(storeSections ? { storeSections } : {}),
        };
        if (idx !== -1) {
          items[idx] = merged;
        }
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

export const mockContentRepository = new MockContentRepository();
