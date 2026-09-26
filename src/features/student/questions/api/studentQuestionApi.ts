import { apiRequest } from '@/lib/api/client';

export interface StudentOption {
  id: 'A' | 'B' | 'C' | 'D';
  optionLabel: 'A' | 'B' | 'C' | 'D';
  html: string;
  displayOrder: number;
}

export interface StudentSubQuestion {
  id: string;
  questionHtml: string;
  answerHtml?: string;
  options: StudentOption[];
  displayOrder: number;
}

export interface StudentQuestionClassification {
  courseId?: string;
  subjectId?: string;
  chapterId?: string;
  lessonId?: string;
  topicId?: string;
  courseName?: string;
  subjectName?: string;
  chapterName?: string;
  lessonName?: string;
  topicName?: string;
}

export interface StudentQuestionRecord {
  id: string;
  kind: 'NORMAL_MCQ' | 'NORMAL_DESCRIPTIVE' | 'CASE_MCQ' | 'CASE_DESCRIPTIVE';
  difficulty: 'FOUNDATION' | 'INTERMEDIATE' | 'ADVANCED';
  questionHtml: string;
  answerHtml?: string;
  caseHtml?: string;
  caseId?: string;
  classificationMode: 'ENTIRE_CASE' | 'INDIVIDUAL_SUB_QUESTIONS';
  options: StudentOption[];
  subQuestions: StudentSubQuestion[];
  classification: StudentQuestionClassification;
  createdAt: string;
  updatedAt: string;
}

export interface StudentQuestionsFilter {
  courseId?: string;
  subjectId?: string;
  chapterId?: string;
  lessonId?: string;
  topicId?: string;
  kind?: string;
  difficulty?: string;
  page?: number;
  limit?: number;
}

export const studentQuestionApi = {
  async listQuestions(filters: StudentQuestionsFilter = {}): Promise<{
    data: StudentQuestionRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.subjectId) params.set('subjectId', filters.subjectId);
    if (filters.chapterId) params.set('chapterId', filters.chapterId);
    if (filters.lessonId) params.set('lessonId', filters.lessonId);
    if (filters.topicId) params.set('topicId', filters.topicId);
    if (filters.kind) params.set('kind', filters.kind);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const response = await apiRequest<{
      data: StudentQuestionRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/student/questions?${params.toString()}`);
    if (!Array.isArray(response.data)) throw new Error('The question service returned an invalid response.');
    return response;
  },
};
