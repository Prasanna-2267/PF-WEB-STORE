export type ContentItemKind = 'folder' | 'file';

export type ContentAccessType = 'FREE' | 'PAID';

export interface ContentSampleImage {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  order: number;
}

export interface ContentStoreSection {
  id: string;
  heading: string;
  content: string;
  order: number;
}

export type ContentFileCategory =
  | 'pdf'
  | 'document'
  | 'presentation'
  | 'image'
  | 'video'
  | 'archive'
  | 'other';

export type ContentEntityType =
  | 'exam'
  | 'stage'
  | 'subject'
  | 'chapter'
  | 'course'
  | 'category'
  | 'lesson'
  | 'study-material'
  | 'government-document'
  | 'question-paper'
  | 'reference-material'
  | 'premium-note'
  | 'media'
  | 'other';

export interface ContentItem {
  id: string;
  courseId: string;
  name: string;
  kind: ContentItemKind;
  parentId: string | null;
  size: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  owner: string;
  mimeType: string | null;
  storagePath: string | null;
  description: string;
  entityType: ContentEntityType | null;
  accessType: ContentAccessType;
  price: number | null;
  sampleImages: ContentSampleImage[];
  storeSections: ContentStoreSection[];
  displayOrder: number;
}

export interface ContentBreadcrumb {
  id: string | null;
  name: string;
}

export interface ContentSearchResult {
  item: ContentItem;
  path: ContentBreadcrumb[];
}

export interface ContentFolderSummary {
  files: number;
  folders: number;
  totalSize: number;
}

export interface ContentLocationSettings {
  courseId: string;
  folderId: string | null;
  pageHeading: string;
  childOrder: string[];
}

export interface ContentUploadInput {
  courseId: string;
  name: string;
  size: number;
  mimeType: string;
  sourceFile?: File;
  entityType?: ContentEntityType | null;
  accessType?: ContentAccessType;
  price?: number | null;
  description?: string;
  sampleImages?: ContentSampleImage[];
  storeSections?: ContentStoreSection[];
  displayOrder?: number;
}

export interface ContentPublishEntry {
  temporaryId: string;
  parentTemporaryId: string | null;
  relativePath: string;
  kind: ContentItemKind;
  name: string;
  size: number;
  mimeType: string | null;
  sourceFile?: File;
  entityType?: ContentEntityType | null;
  accessType: ContentAccessType;
  price: number | null;
  description: string;
  pageHeading?: string;
  sampleImages: ContentSampleImage[];
  storeSections: ContentStoreSection[];
  displayOrder: number;
}

export interface ContentPublishInput {
  courseId: string;
  destinationId: string | null;
  entries: ContentPublishEntry[];
}

export interface ContentUploadTask {
  id: string;
  name: string;
  progress: number;
  status: 'queued' | 'preparing' | 'uploading' | 'publishing' | 'complete' | 'error';
  error?: string;
}

export type ContentSortField = 'manual' | 'name' | 'type' | 'updatedAt' | 'createdAt' | 'size';
export type ContentSortDirection = 'asc' | 'desc';
export type ContentViewMode = 'list' | 'grid';

export interface ContentSort {
  field: ContentSortField;
  direction: ContentSortDirection;
}

export interface CreateContentFolderInput {
  courseId: string;
  name: string;
  parentId: string | null;
  entityType?: ContentEntityType | null;
}

export interface ContentMutationResult {
  items: ContentItem[];
  message: string;
}
