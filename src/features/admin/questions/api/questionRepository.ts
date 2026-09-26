import type { QuestionRecord, QuestionStatus } from '../types/question';
import { apiRequest } from '@/lib/api/client';

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
    const response = await apiRequest<{ data: BackendQuestionDto[] }>(`/api/admin/questions?limit=100${includeDeleted ? '&includeDeleted=true' : ''}`);
    return Array.isArray(response.data) ? response.data.map(adaptBackendQuestion) : [];
  },

  async get(questionId: string): Promise<QuestionRecord> {
    const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}`);
    return adaptBackendQuestion(dto);
  },

  async save(question: QuestionRecord): Promise<QuestionRecord> {
      const isExisting = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(question.id);
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
      return adaptBackendQuestion(dto);
  },

  async saveMany(records: QuestionRecord[]): Promise<QuestionRecord[]> {
    const saved: QuestionRecord[] = [];
    for (const r of records) {
      saved.push(await this.save(r));
    }
    return saved;
  },

  async duplicate(questionId: string): Promise<QuestionRecord> {
    const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}/clone`, {
        method: 'POST',
      });
    return adaptBackendQuestion(dto);
  },

  async moveToTrash(questionId: string): Promise<void> {
    await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}/archive`, {
        method: 'POST',
      });
  },

  async restore(questionId: string): Promise<void> {
    await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}/restore`, {
        method: 'POST',
      });
  },

  async permanentDelete(questionId: string): Promise<void> {
    await apiRequest(`/api/admin/questions/${encodeURIComponent(questionId)}`, {
        method: 'DELETE',
      });
  },

  async setStatus(questionId: string, status: QuestionStatus): Promise<QuestionRecord> {
    const action = status === 'PUBLISHED' ? 'publish' : 'archive';
    const dto = await apiRequest<BackendQuestionDto>(`/api/admin/questions/${encodeURIComponent(questionId)}/${action}`, {
        method: 'POST',
      });
    return adaptBackendQuestion(dto);
  },
};
