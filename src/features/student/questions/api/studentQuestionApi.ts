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

    try {
      const response = await apiRequest<{
        data: StudentQuestionRecord[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/student/questions?${params.toString()}`);
      if (response && Array.isArray(response.data)) {
        return response;
      }
    } catch {
      // Fallback response for unauthenticated practice view
    }

    return {
      data: [
        {
          id: 'sq-demo-1',
          kind: 'NORMAL_MCQ',
          difficulty: 'INTERMEDIATE',
          questionHtml: '<p>Which audit evidence is generally considered the most reliable during an independent audit?</p>',
          classificationMode: 'ENTIRE_CASE',
          options: [
            { id: 'A', optionLabel: 'A', html: '<p>Oral representation by management</p>', displayOrder: 0 },
            { id: 'B', optionLabel: 'B', html: '<p>Internally generated document without controls</p>', displayOrder: 1 },
            { id: 'C', optionLabel: 'C', html: '<p>External confirmation received directly by the auditor</p>', displayOrder: 2 },
            { id: 'D', optionLabel: 'D', html: '<p>Photocopy supplied by an employee</p>', displayOrder: 3 },
          ],
          subQuestions: [],
          classification: {
            courseName: 'Chartered Accountancy',
            subjectName: 'Auditing',
            chapterName: 'Audit Evidence',
            lessonName: 'Audit Procedures',
            topicName: 'Reliability of Evidence',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
  },
};
