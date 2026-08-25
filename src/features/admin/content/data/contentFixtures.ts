import type { ContentItem } from '../types/content';

const now = '2026-08-15T09:30:00.000Z';
const earlier = '2026-08-10T08:00:00.000Z';
const owner = 'Parallax Flow Admin';
const CA = 'course-chartered-accountancy';
const JEE = 'course-jee';

const folder = (
  id: string,
  name: string,
  parentId: string | null,
  entityType: ContentItem['entityType'] = null,
  courseId = CA,
): ContentItem => ({
  id,
  courseId,
  name,
  kind: 'folder',
  parentId,
  size: 0,
  createdAt: earlier,
  updatedAt: now,
  lastOpenedAt: null,
  owner,
  mimeType: null,
  storagePath: null,
  description: '',
  entityType,
  accessType: 'FREE',
  price: null,
  sampleImages: [],
  storeSections: [],
  displayOrder: 0,
});

const file = (
  id: string,
  name: string,
  parentId: string,
  size: number,
  mimeType: string,
  entityType: ContentItem['entityType'] = 'study-material',
  courseId = CA,
): ContentItem => ({
  id,
  courseId,
  name,
  kind: 'file',
  parentId,
  size,
  createdAt: earlier,
  updatedAt: now,
  lastOpenedAt: null,
  owner,
  mimeType,
  storagePath: `mock://parallax-flow/${id}/${encodeURIComponent(name)}`,
  description: '',
  entityType,
  accessType: entityType === 'premium-note' ? 'PAID' : 'FREE',
  price: entityType === 'premium-note' ? 499 : null,
  sampleImages: [],
  storeSections: [],
  displayOrder: 0,
});

export const CONTENT_FIXTURES: ContentItem[] = [];
