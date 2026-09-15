import { apiRequest } from '@/lib/api/client';
import { retryUploadStep } from '@/lib/api/uploadRetry';

export interface PageResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AcademyContentItem {
  id: string;
  courseId: string;
  parentId: string | null;
  kind: 'FOLDER' | 'FILE';
  name: string;
  size: number;
  mimeType: string | null;
  description: string;
  entityType: string | null;
  accessType: 'FREE' | 'PAID';
  price: number | null;
  accessDurationValue: number | null;
  accessDurationUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  status: 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AcademyContentCopyResult = AcademyContentItem | {
  accepted: true;
  job: { id: string; status: string; runAt: string };
};

export interface AcademyQuestion {
  id: string;
  kind: 'NORMAL_MCQ' | 'NORMAL_DESCRIPTIVE' | 'CASE_MCQ' | 'CASE_DESCRIPTIVE';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  difficulty: 'FOUNDATION' | 'INTERMEDIATE' | 'ADVANCED';
  questionHtml: string;
  caseHtml: string;
  answerHtml: string;
  correctExplanationHtml: string;
  classificationMode: 'ENTIRE_CASE' | 'INDIVIDUAL_SUB_QUESTIONS';
  correctOptionId: string | null;
  courseId: string | null;
  course?: { id: string; name: string } | null;
  _count?: { options: number; subQuestions: number };
  options?: Array<{ optionLabel: string; html: string }>;
  subQuestions?: Array<{
    questionHtml: string;
    answerHtml: string;
    correctOptionId: string | null;
    correctExplanationHtml: string;
    options: Array<{ optionLabel: string; html: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionDraft {
  kind: 'NORMAL_MCQ' | 'NORMAL_DESCRIPTIVE' | 'CASE_MCQ' | 'CASE_DESCRIPTIVE';
  difficulty: 'FOUNDATION' | 'INTERMEDIATE' | 'ADVANCED';
  courseId?: string;
  questionHtml?: string;
  answerHtml?: string;
  caseHtml?: string;
  classificationMode?: 'ENTIRE_CASE' | 'INDIVIDUAL_SUB_QUESTIONS';
  correctOptionId?: string;
  correctExplanationHtml?: string;
  options?: Array<{ optionLabel: string; html: string }>;
  subQuestions?: Array<{
    questionHtml: string;
    answerHtml?: string;
    correctOptionId?: string;
    correctExplanationHtml?: string;
    options?: Array<{ optionLabel: string; html: string }>;
  }>;
}

export interface AcademyBroadcast {
  id: string;
  title: string;
  subtitle: string;
  message: string;
  type: 'ANNOUNCEMENT' | 'IMPORTANT_NOTICE' | 'UPDATE' | 'MAINTENANCE' | 'FEATURE_UPDATE' | 'ACADEMIC' | 'GENERAL' | 'CRITICAL_ALERT';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED' | 'DISABLED' | 'EXPIRED';
  audienceKind: 'ACADEMY_STUDENTS' | 'COURSES';
  courseTargets: Array<{ course: { id: string; name: string } }>;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AcademyBroadcastDraft = Pick<AcademyBroadcast, 'title' | 'subtitle' | 'message' | 'type' | 'priority'> & {
  targetCourseId: string | null;
};

const query = (values: Record<string, string | number | boolean | null | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  return params.toString();
};

export const academyContentApi = {
  location: (courseId: string, folderId: string | null, signal?: AbortSignal) => apiRequest<{ courseId: string; folderId: string | null; pageHeading: string }>(
    `/api/academy/content/locations?${query({ courseId, folderId })}`, { signal },
  ),
  updateLocation: (courseId: string, folderId: string | null, pageHeading: string) => apiRequest<{ courseId: string; folderId: string | null; pageHeading: string }>('/api/academy/content/locations', {
    method: 'PATCH', body: { courseId, folderId, pageHeading },
  }),
  list: (courseId: string, parentId: string | null | 'all', search = '', includeArchived = false, signal?: AbortSignal) => apiRequest<PageResult<AcademyContentItem>>(
    `/api/academy/content?${query({ courseId, parentId: parentId === null ? undefined : parentId, search: search.trim() || undefined, includeArchived, page: 1, limit: 1000 })}`,
    { signal },
  ),
  get: (contentId: string, signal?: AbortSignal) => apiRequest<AcademyContentItem>(`/api/academy/content/${encodeURIComponent(contentId)}`, { signal }),
  createFolder: (courseId: string, parentId: string | null, name: string) => apiRequest<AcademyContentItem>('/api/academy/content/folders', {
    method: 'POST', body: { courseId, parentId, name },
  }),
  update: (contentId: string, body: { name?: string; description?: string; displayOrder?: number; accessType?: 'FREE' | 'PAID'; price?: number | null; accessDurationValue?: number | null; accessDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null }) => apiRequest<AcademyContentItem>(`/api/academy/content/${encodeURIComponent(contentId)}`, {
    method: 'PATCH', body,
  }),
  rename: (contentId: string, name: string) => academyContentApi.update(contentId, { name }),
  move: (contentId: string, parentId: string | null) => apiRequest<AcademyContentItem>(`/api/academy/content/${encodeURIComponent(contentId)}/move`, {
    method: 'POST', body: { parentId },
  }),
  copy: (contentId: string, parentId: string | null) => apiRequest<AcademyContentCopyResult>(`/api/academy/content/${encodeURIComponent(contentId)}/copy`, {
    method: 'POST', body: { parentId },
  }),
  updateOrder: (courseId: string, folderId: string | null, itemIds: string[]) => apiRequest<{ success: true }>('/api/academy/content/display-orders', {
    method: 'PATCH', body: { courseId, folderId, itemIds },
  }),
  archive: (contentId: string) => apiRequest<AcademyContentItem>(`/api/academy/content/${encodeURIComponent(contentId)}`, { method: 'DELETE' }),
  restore: (contentId: string) => apiRequest<AcademyContentItem>(`/api/academy/content/${encodeURIComponent(contentId)}/restore`, { method: 'POST' }),
  access: (contentId: string, mode: 'preview' | 'download') => apiRequest<{ url: string }>(`/api/academy/content/${encodeURIComponent(contentId)}/${mode}`),
  upload: async (
    courseId: string,
    parentId: string | null,
    file: File,
    metadata: { description?: string; entityType?: string; displayOrder?: number; accessType?: 'FREE' | 'PAID'; price?: number; accessDurationValue?: number | null; accessDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null } = {},
  ) => {
    const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const intent = await apiRequest<{ uploadId: string }>('/api/academy/content/upload-intents', {
      method: 'POST',
      body: { courseId, parentId, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, checksumSha256 },
      timeoutMs: 300_000,
    });
    await retryUploadStep(() => apiRequest(`/api/academy/content/uploads/${encodeURIComponent(intent.uploadId)}/binary`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
      timeoutMs: 600_000,
    }));
    return retryUploadStep(() => apiRequest<AcademyContentItem>(`/api/academy/content/uploads/${encodeURIComponent(intent.uploadId)}/finalize`, {
      method: 'POST',
      body: {
        parentId,
        entityType: metadata.entityType ?? 'STUDY_MATERIAL',
        description: metadata.description,
        displayOrder: metadata.displayOrder,
        accessType: metadata.accessType ?? 'FREE',
        price: metadata.accessType === 'PAID' ? metadata.price : undefined,
        accessDurationValue: metadata.accessType === 'PAID' ? metadata.accessDurationValue : null,
        accessDurationUnit: metadata.accessType === 'PAID' ? metadata.accessDurationUnit : null,
      },
      timeoutMs: 300_000,
    }));
  },
};

export const academyQuestionApi = {
  list: (filters: { search?: string; courseId?: string; status?: string; page?: number; limit?: number }, signal?: AbortSignal) => apiRequest<PageResult<AcademyQuestion>>(
    `/api/academy/questions?${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 25 })}`, { signal },
  ),
  create: (draft: QuestionDraft) => apiRequest<AcademyQuestion>('/api/academy/questions', { method: 'POST', body: { ...draft, status: 'DRAFT' } }),
  get: (id: string) => apiRequest<AcademyQuestion>(`/api/academy/questions/${encodeURIComponent(id)}`),
  update: (id: string, draft: QuestionDraft) => apiRequest<AcademyQuestion>(`/api/academy/questions/${encodeURIComponent(id)}`, { method: 'PUT', body: { ...draft, status: 'DRAFT' } }),
  lifecycle: (id: string, action: 'publish' | 'archive' | 'restore' | 'clone') => apiRequest<AcademyQuestion>(`/api/academy/questions/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  remove: (id: string) => apiRequest<{ id: string; deleted: boolean }>(`/api/academy/questions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const academyBroadcastApi = {
  list: (filters: { search?: string; status?: AcademyBroadcast['status']; type?: AcademyBroadcast['type']; page?: number; limit?: number }, signal?: AbortSignal) => apiRequest<PageResult<AcademyBroadcast>>(`/api/academy/broadcasts?${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 25 })}`, { signal }),
  get: (id: string) => apiRequest<AcademyBroadcast>(`/api/academy/broadcasts/${encodeURIComponent(id)}`),
  create: (draft: AcademyBroadcastDraft) => apiRequest<AcademyBroadcast>('/api/academy/broadcasts', { method: 'POST', body: draft }),
  update: (id: string, draft: AcademyBroadcastDraft) => apiRequest<AcademyBroadcast>(`/api/academy/broadcasts/${encodeURIComponent(id)}`, { method: 'PATCH', body: draft }),
  lifecycle: (id: string, action: 'publish' | 'cancel' | 'archive' | 'restore') => apiRequest<AcademyBroadcast>(`/api/academy/broadcasts/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
  schedule: (id: string, startAt: string) => apiRequest<AcademyBroadcast>(`/api/academy/broadcasts/${encodeURIComponent(id)}/schedule`, { method: 'POST', body: { startAt } }),
  remove: (id: string) => apiRequest<{ id: string; deletedAt: string }>(`/api/academy/broadcasts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
