import type { QuestionRecord, QuestionStatus } from '../types/question';
import { apiRequest } from '@/lib/api/client';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const questionPlainText = (input: QuestionRecord | string | null | undefined): string => {
  if (!input) return '';
  if (typeof input === 'string') return plain(input);
  if (input.kind.startsWith('CASE_')) return plain(input.caseHtml || input.questionHtml);
  return plain(input.questionHtml);
};

export const validateQuestion = (question: QuestionRecord, intent?: 'publish' | 'draft'): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!question.kind) errors.kind = 'Question kind is required.';
  return errors;
};

const fixtures: QuestionRecord[] = [
  {
    id: 'question-audit-evidence-1',
    kind: 'NORMAL_MCQ',
    status: 'PUBLISHED',
    difficulty: 'INTERMEDIATE',
    questionHtml: '<p>Which evidence is generally considered the most reliable?</p>',
    answerHtml: '',
    options: [
      { id: 'A', html: '<p>Oral representation by management</p>' },
      { id: 'B', html: '<p>Internally generated document without controls</p>' },
      { id: 'C', html: '<p>External confirmation received directly by the auditor</p>' },
      { id: 'D', html: '<p>Photocopy supplied by an employee</p>' },
    ],
    correctOptionId: 'C',
    correctExplanationHtml: '<p>Independent external evidence obtained directly is ordinarily more reliable.</p>',
    premiumWrongOptionsExplanationHtml: '<p>The other options depend more heavily on internal sources or oral assertions.</p>',
    caseHtml: '',
    caseId: null,
    classificationMode: 'ENTIRE_CASE',
    classification: { courseId: 'course-chartered-accountancy', subjectId: 'subject-ca-audit', chapterId: 'chapter-audit-evidence', lessonId: 'lesson-audit-procedures', topicId: 'topic-sufficient-evidence' },
    subQuestions: [],
    createdAt: '2026-08-02T06:00:00.000Z',
    updatedAt: '2026-08-18T08:30:00.000Z',
    deletedAt: null,
  },
];

interface BackendQuestionDto {
  id: string;
  kind: string;
  status: string;
  difficulty: string;
  questionHtml?: string | null;
  answerHtml?: string | null;
  options?: any[];
  correctOptionId?: any;
  correctExplanationHtml?: string | null;
  premiumWrongOptionsExplanationHtml?: string | null;
  caseHtml?: string | null;
  caseId?: string | null;
  classificationMode?: string;
  classification?: any;
  subQuestions?: any[];
  courseId?: string | null;
  subjectId?: string | null;
  chapterId?: string | null;
  lessonId?: string | null;
  topicId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export function adaptBackendQuestion(dto: BackendQuestionDto): QuestionRecord {
  const optId = dto.correctOptionId === 'A' || dto.correctOptionId === 'B' || dto.correctOptionId === 'C' || dto.correctOptionId === 'D' ? dto.correctOptionId : null;

  const rawOptions = Array.isArray(dto.options) ? dto.options : [];
  const mappedOptions = rawOptions.map((opt) => ({
    id: String(opt.optionLabel || opt.id || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D',
    html: String(opt.html || ''),
  }));

  const rawSubs = Array.isArray(dto.subQuestions) ? dto.subQuestions : [];
  const mappedSubs = rawSubs.map((sub) => ({
    ...sub,
    id: sub.id || `sub-${Math.random().toString(36).slice(2)}`,
    questionHtml: sub.questionHtml || '',
    answerHtml: sub.answerHtml || '',
    correctOptionId: sub.correctOptionId || null,
    correctExplanationHtml: sub.correctExplanationHtml || '',
    premiumWrongOptionsExplanationHtml: sub.premiumWrongOptionsExplanationHtml || '',
    options: Array.isArray(sub.options)
      ? sub.options.map((opt: any) => ({
          id: String(opt.optionLabel || opt.id || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D',
          html: String(opt.html || ''),
        }))
      : [],
    classification: sub.classification || {
      courseId: sub.courseId || dto.courseId || '',
      subjectId: sub.subjectId || dto.subjectId || '',
      chapterId: sub.chapterId || dto.chapterId || '',
      lessonId: sub.lessonId || dto.lessonId || '',
      topicId: sub.topicId || dto.topicId || '',
    },
  }));

  const classification = dto.classification || {
    courseId: dto.courseId || '',
    subjectId: dto.subjectId || '',
    chapterId: dto.chapterId || '',
    lessonId: dto.lessonId || '',
    topicId: dto.topicId || '',
  };

  return {
    id: dto.id,
    kind: (dto.kind || 'NORMAL_MCQ') as any,
    status: (dto.status || 'DRAFT') as QuestionStatus,
    difficulty: (dto.difficulty || 'INTERMEDIATE') as any,
    questionHtml: dto.questionHtml || '',
    answerHtml: dto.answerHtml || '',
    options: mappedOptions,
    correctOptionId: optId,
    correctExplanationHtml: dto.correctExplanationHtml || '',
    premiumWrongOptionsExplanationHtml: dto.premiumWrongOptionsExplanationHtml || '',
    caseHtml: dto.caseHtml || '',
    caseId: dto.caseId || null,
    classificationMode: (dto.classificationMode || 'ENTIRE_CASE') as any,
    classification,
    subQuestions: mappedSubs,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    deletedAt: dto.deletedAt || null,
  };
}

export const questionRepository = {
  async list(includeDeleted = false): Promise<QuestionRecord[]> {
    try {
      const response = await apiRequest<{ data: BackendQuestionDto[] }>('/api/admin/questions?limit=100');
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map(adaptBackendQuestion);
      }
    } catch {
      // Unauthenticated fallback
    }
    return clone(fixtures);
  },

  async get(questionId: string): Promise<QuestionRecord> {
    try {
      const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}`);
      if (dto && dto.id) {
        return adaptBackendQuestion(dto);
      }
    } catch {
      // Fallback
    }
    const found = fixtures.find((q) => q.id === questionId);
    if (found) return clone(found);
    throw new Error('Question not found.');
  },

  async save(question: QuestionRecord): Promise<QuestionRecord> {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(question.id);
      const isExisting = isUUID || (question.id && !question.id.startsWith('temp-') && !question.id.startsWith('new-') && !question.id.startsWith('question-') && fixtures.some((q) => q.id === question.id));
      const url = isExisting ? `/api/admin/questions/${encodeURIComponent(question.id)}` : '/api/admin/questions';
      const method = isExisting ? 'PUT' : 'POST';

      const payload = {
        kind: question.kind,
        status: question.status,
        difficulty: question.difficulty,
        questionHtml: question.questionHtml,
        answerHtml: question.answerHtml,
        caseHtml: question.caseHtml,
        classificationMode: question.classificationMode,
        correctOptionId: question.correctOptionId,
        correctExplanationHtml: question.correctExplanationHtml,
        premiumWrongOptionsExplanationHtml: question.premiumWrongOptionsExplanationHtml,
        classification: question.classification,
        options: question.options.map((opt) => ({
          optionLabel: opt.id,
          html: opt.html,
        })),
        subQuestions: question.subQuestions.map((sub) => ({
          questionHtml: sub.questionHtml,
          answerHtml: sub.answerHtml,
          correctOptionId: sub.correctOptionId,
          correctExplanationHtml: sub.correctExplanationHtml,
          premiumWrongOptionsExplanationHtml: sub.premiumWrongOptionsExplanationHtml,
          classification: sub.classification,
          options: (sub.options || []).map((opt) => ({
            optionLabel: opt.id,
            html: opt.html,
          })),
        })),
      };

      const dto = await apiRequest<BackendQuestionDto>(url, {
        method,
        body: payload,
      });
      if (dto && dto.id) {
        return adaptBackendQuestion(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }
    return clone(question);
  },

  async saveMany(records: QuestionRecord[]): Promise<QuestionRecord[]> {
    const saved: QuestionRecord[] = [];
    for (const r of records) {
      saved.push(await this.save(r));
    }
    return saved;
  },

  async duplicate(questionId: string): Promise<QuestionRecord> {
    try {
      const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}/clone`, {
        method: 'POST',
      });
      if (dto && dto.id) {
        return adaptBackendQuestion(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }
    const existing = await this.get(questionId);
    const copy = clone(existing);
    copy.id = `question-${Date.now()}`;
    return copy;
  },

  async moveToTrash(questionId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}/archive`, {
        method: 'POST',
      });
    } catch {
      // Fallback
    }
  },

  async restore(questionId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}/restore`, {
        method: 'POST',
      });
    } catch {
      // Fallback
    }
  },

  async permanentDelete(questionId: string): Promise<void> {
    try {
      await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}`, {
        method: 'DELETE',
      });
    } catch {
      // Fallback
    }
  },

  async setStatus(questionId: string, status: QuestionStatus): Promise<QuestionRecord> {
    const action = status === 'PUBLISHED' ? 'publish' : 'archive';
    try {
      const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}/${action}`, {
        method: 'POST',
      });
      if (dto && dto.id) {
        return adaptBackendQuestion(dto);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }
    const existing = await this.get(questionId);
    existing.status = status;
    return existing;
  },
};
