import { apiRequest } from '@/lib/api/client';

export type QuestionMode = 'normal' | 'case';
export type QuestionKind = 'NORMAL_MCQ' | 'CASE_MCQ';
export type QuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LinkedFile = { id: string; name: string; mimeType: string | null; accessType: 'FREE' | 'PAID'; status: string; parentId?: string | null };
export type Option = { optionLabel: string; html: string };
export type SubQuestion = { id?: string; questionHtml: string; options: Option[]; correctOptionId: string | null; correctExplanationHtml?: string; premiumWrongOptionsExplanationHtml: string; examName: string; chapterName: string; conceptName: string };
export type WorkspaceQuestion = {
  id: string; kind: QuestionKind; status: QuestionStatus; difficulty: string;
  questionHtml: string; caseHtml: string; correctOptionId: string | null;
  practiceCollection: 'PYQ' | 'RTP' | 'MTP' | 'ORIGINAL' | 'QUESTION_BANK';
  correctExplanationHtml: string; premiumWrongOptionsExplanationHtml: string;
  examName: string; chapterName: string; conceptName: string;
  options: Option[]; subQuestions: SubQuestion[]; courseId: string;
  contentLinks: Array<{ contentItemId: string; contentItem: LinkedFile }>;
  questionBankId: string | null;
  questionBank: { id: string; name: string; accessType: 'FREE' | 'PAID'; status: string } | null;
  _count?: { options: number; subQuestions: number };
  createdAt: string; updatedAt: string;
};
export type QuestionPayload = {
  kind: QuestionKind; status: 'DRAFT' | 'PUBLISHED'; courseId: string; contentItemIds: string[];
  practiceCollection?: 'ORIGINAL' | 'QUESTION_BANK';
  questionBankId?: string;
  questionHtml?: string; caseHtml?: string; correctOptionId?: string;
  correctExplanationHtml?: string; premiumWrongOptionsExplanationHtml?: string;
  examName?: string; chapterName?: string; conceptName?: string;
  options?: Option[]; subQuestions?: Omit<SubQuestion, 'id'>[];
};
export type QuestionBank = {
  id: string; courseId: string; subjectFolderId: string | null; name: string; slug: string; description: string;
  questionKinds?: QuestionKind[];
  accessType: 'FREE' | 'PAID'; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  price: number | string;
  accessDurationValue: number | null;
  accessDurationUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  subjectFolder: { id: string; name: string } | null;
  _count: { questions: number; practiceSessions: number };
};
export type QuestionBankSubjectFolder = { id: string; name: string };
export type QuestionBankPayload = {
  courseId: string; name: string; description?: string; accessType: 'FREE' | 'PAID';
  price?: number | null; accessDurationValue?: number | null;
  accessDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
};
export type ImportValidation = { valid: boolean; totalRows: number; questionCount: number; errors: Array<{ row: number; field: string; problem: string }>; validationDigest: string };

export type BulkQuestionAction = 'publish' | 'archive' | 'restore' | 'delete' | 'update-classification';
export type BulkQuestionSelection =
  | { mode: 'ids'; courseId: string; ids: string[] }
  | { mode: 'filter'; filters: Record<string, string>; excludeIds?: string[] };
export type BulkQuestionResult = {
  action: BulkQuestionAction;
  requested: number;
  succeeded: Array<{ id: string }>;
  failed: Array<{ id: string; code: string; message: string }>;
};

const base = (scope: 'platform' | 'academy') => scope === 'academy' ? '/api/academy/questions' : '/api/admin/questions';
const academy = (scope: 'platform' | 'academy', academyId?: string | null) => scope === 'academy' ? { academyId } : {};
const normalizeQuestion = (question: WorkspaceQuestion): WorkspaceQuestion => ({
  ...question,
  options: Array.isArray(question.options) ? question.options : [],
  subQuestions: Array.isArray(question.subQuestions) ? question.subQuestions : [],
  contentLinks: Array.isArray(question.contentLinks) ? question.contentLinks : [],
});

export const questionWorkspaceApi = {
  courses: async (scope: 'platform' | 'academy', academyId?: string | null) => {
    const response = await apiRequest<any>(scope === 'academy' ? '/api/academy/courses?limit=100' : '/api/admin/courses?limit=100', academy(scope, academyId));
    return (Array.isArray(response) ? response : response.data ?? response.items ?? []).map((course: any) => ({ id: course.id, name: course.name, code: course.code }));
  },
  files: (scope: 'platform' | 'academy', academyId: string | null | undefined, courseId: string) => apiRequest<LinkedFile[]>(`${base(scope)}/files?courseId=${encodeURIComponent(courseId)}`, academy(scope, academyId)),
  banks: (scope: 'platform' | 'academy', academyId: string | null | undefined, courseId: string) => apiRequest<QuestionBank[]>(`${base(scope)}/banks?courseId=${encodeURIComponent(courseId)}&includeArchived=true`, academy(scope, academyId)),
  bankSubjectFolders: (scope: 'platform' | 'academy', academyId: string | null | undefined, courseId: string) => apiRequest<QuestionBankSubjectFolder[]>(`${base(scope)}/bank-subject-folders?courseId=${encodeURIComponent(courseId)}`, academy(scope, academyId)),
  createBank: (scope: 'platform' | 'academy', academyId: string | null | undefined, payload: QuestionBankPayload) => apiRequest<QuestionBank>(`${base(scope)}/banks`, { ...academy(scope, academyId), method: 'POST', body: payload }),
  updateBank: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string, payload: QuestionBankPayload) => apiRequest<QuestionBank>(`${base(scope)}/banks/${id}`, { ...academy(scope, academyId), method: 'PATCH', body: payload }),
  bankLifecycle: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string, action: 'publish' | 'archive' | 'restore', subjectFolderId?: string) => apiRequest<QuestionBank>(`${base(scope)}/banks/${id}/${action}`, { ...academy(scope, academyId), method: 'POST', body: action === 'publish' ? { subjectFolderId } : {} }),
  removeBank: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string) => apiRequest<{ id: string; deleted: true }>(`${base(scope)}/banks/${id}`, { ...academy(scope, academyId), method: 'DELETE' }),
  list: async (scope: 'platform' | 'academy', academyId: string | null | undefined, params: URLSearchParams) => { const response = await apiRequest<{ data: WorkspaceQuestion[]; pagination: { page: number; total: number; totalPages: number } }>(`${base(scope)}?${params}`, academy(scope, academyId)); return { ...response, data: response.data.map(normalizeQuestion) }; },
  get: async (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string) => normalizeQuestion(await apiRequest<WorkspaceQuestion>(`${base(scope)}/${id}`, academy(scope, academyId))),
  save: (scope: 'platform' | 'academy', academyId: string | null | undefined, payload: QuestionPayload, id?: string) => apiRequest<WorkspaceQuestion>(id ? `${base(scope)}/${id}` : base(scope), { ...academy(scope, academyId), method: id ? 'PUT' : 'POST', body: payload }),
  lifecycle: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string, action: 'publish' | 'archive' | 'restore') => apiRequest<WorkspaceQuestion>(`${base(scope)}/${id}/${action}`, { ...academy(scope, academyId), method: 'POST' }),
  bulk: (scope: 'platform' | 'academy', academyId: string | null | undefined, payload: { selection: BulkQuestionSelection; action: BulkQuestionAction; classification?: { examName?: string; chapterName?: string; conceptName?: string } }) => apiRequest<BulkQuestionResult>(`${base(scope)}/bulk`, { ...academy(scope, academyId), method: 'POST', body: payload }),
  duplicate: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string) => apiRequest<WorkspaceQuestion>(`${base(scope)}/${id}/clone`, { ...academy(scope, academyId), method: 'POST' }),
  remove: (scope: 'platform' | 'academy', academyId: string | null | undefined, id: string) => apiRequest<{ id: string; deleted: true }>(`${base(scope)}/${id}`, { ...academy(scope, academyId), method: 'DELETE' }),
  template: (scope: 'platform' | 'academy', academyId: string | null | undefined, mode: QuestionMode) => apiRequest<{ fileName: string; mimeType: string; contentBase64: string }>(`${base(scope)}/templates/${mode}`, academy(scope, academyId)),
  validateImport: (scope: 'platform' | 'academy', academyId: string | null | undefined, payload: object) => apiRequest<ImportValidation>(`${base(scope)}/imports/validate`, { ...academy(scope, academyId), method: 'POST', body: payload, timeoutMs: 60_000 }),
  commitImport: (scope: 'platform' | 'academy', academyId: string | null | undefined, payload: object) => apiRequest<{ imported: number }>(`${base(scope)}/imports/commit`, { ...academy(scope, academyId), method: 'POST', body: payload, timeoutMs: 90_000 }),
};
