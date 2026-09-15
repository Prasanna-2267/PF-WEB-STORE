import type {
  ContentAccessType,
  ContentBreadcrumb,
  ContentFolderSummary,
  ContentItem,
  ContentLocationSettings,
  ContentPublishInput,
  ContentSampleImage,
  ContentSearchResult,
  ContentStoreSection,
  AccessDurationUnit,
  ContentUploadInput,
  CreateContentFolderInput,
} from '../types/content';

export type ContentRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INVALID_MOVE'
  | 'STORAGE_ERROR';

export class ContentRepositoryError extends Error {
  readonly code: ContentRepositoryErrorCode;

  constructor(code: ContentRepositoryErrorCode, message: string) {
    super(message);
    this.name = 'ContentRepositoryError';
    this.code = code;
  }
}

/**
 * UI-facing content contract. A production adapter can replace the mock with
 * authenticated APIs and object storage without changing the file-manager UI.
 */
export interface ContentRepository {
  getAllItems(courseId?: string): Promise<ContentItem[]>;
  getChildren(parentId: string | null, courseId?: string): Promise<ContentItem[]>;
  getItem(itemId: string, courseId?: string): Promise<ContentItem>;
  getBreadcrumb(folderId: string | null, courseId?: string): Promise<ContentBreadcrumb[]>;
  getFolders(courseId?: string): Promise<ContentItem[]>;
  getFolderSummary(folderId: string, courseId?: string): Promise<ContentFolderSummary>;
  getLocationSettings(courseId: string, folderId: string | null): Promise<ContentLocationSettings>;
  updatePageHeading(courseId: string, folderId: string | null, pageHeading: string): Promise<ContentLocationSettings>;
  saveChildOrder(courseId: string, folderId: string | null, childOrder: string[]): Promise<ContentLocationSettings>;
  searchItems(query: string, courseId?: string): Promise<ContentSearchResult[]>;
  createFolder(input: CreateContentFolderInput): Promise<ContentItem>;
  uploadFile(parentId: string | null, input: ContentUploadInput): Promise<ContentItem>;
  publishContent(input: ContentPublishInput): Promise<ContentItem[]>;
  renameItem(itemId: string, name: string): Promise<ContentItem>;
  deleteItems(itemIds: string[]): Promise<void>;
  copyItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]>;
  moveItems(itemIds: string[], destinationId: string | null): Promise<ContentItem[]>;
  updateDescription(itemId: string, description: string): Promise<ContentItem>;
  updateAccessType(
    itemId: string,
    accessType: ContentAccessType,
    price?: number | null,
    applyToChildren?: boolean,
    description?: string,
    sampleImages?: ContentSampleImage[],
    storeSections?: ContentStoreSection[],
    accessDurationValue?: number | null,
    accessDurationUnit?: AccessDurationUnit | null
  ): Promise<ContentItem>;
  markOpened(itemId: string): Promise<void>;
  getFileSource(itemId: string): File | undefined;
}
