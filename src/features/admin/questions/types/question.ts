export type QuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuestionDifficulty = 'FOUNDATION' | 'INTERMEDIATE' | 'ADVANCED';
export type QuestionKind = 'NORMAL_MCQ' | 'NORMAL_DESCRIPTIVE' | 'CASE_MCQ' | 'CASE_DESCRIPTIVE';
export type CaseClassificationMode = 'ENTIRE_CASE' | 'INDIVIDUAL_SUB_QUESTIONS';

export interface QuestionClassification {
  courseId: string;
  subjectId: string;
  chapterId: string;
  lessonId: string;
  topicId: string;
}

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  html: string;
}

export interface CaseSubQuestion {
  id: string;
  questionHtml: string;
  options: QuestionOption[];
  correctOptionId: QuestionOption['id'] | null;
  correctExplanationHtml: string;
  premiumWrongOptionsExplanationHtml: string;
  answerHtml: string;
  classification: QuestionClassification | null;
}

export interface QuestionRecord {
  id: string;
  kind: QuestionKind;
  status: QuestionStatus;
  difficulty: QuestionDifficulty;
  questionHtml: string;
  answerHtml: string;
  options: QuestionOption[];
  correctOptionId: QuestionOption['id'] | null;
  correctExplanationHtml: string;
  premiumWrongOptionsExplanationHtml: string;
  caseHtml: string;
  caseId: string | null;
  classificationMode: CaseClassificationMode;
  classification: QuestionClassification | null;
  subQuestions: CaseSubQuestion[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaxonomyCourse { id: string; name: string; }
export interface TaxonomySubject { id: string; courseId: string; name: string; }
export interface TaxonomyChapter { id: string; subjectId: string; name: string; }
export interface TaxonomyLesson { id: string; chapterId: string; name: string; }
export interface TaxonomyTopic { id: string; lessonId: string; name: string; }

export interface QuestionTaxonomy {
  courses: TaxonomyCourse[];
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  lessons: TaxonomyLesson[];
  topics: TaxonomyTopic[];
}

export type TaxonomyLevel = 'subject' | 'chapter' | 'lesson' | 'topic';

export interface TaxonomyPathNames {
  course: string;
  subject: string;
  chapter: string;
  lesson: string;
  topic: string;
}

export interface QuestionFilters {
  search: string;
  courseId: string;
  subjectId: string;
  chapterId: string;
  lessonId: string;
  topicId: string;
  kind: QuestionKind | 'ALL';
  status: QuestionStatus | 'ALL';
  difficulty: QuestionDifficulty | 'ALL';
  sort: 'updated-desc' | 'updated-asc' | 'created-desc' | 'question-asc';
}

export interface ImportRowValues {
  questionId: string;
  questionType: string;
  caseType: string;
  caseId: string;
  caseText: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  correctExplanation: string;
  wrongOptionsExplanation: string;
  answer: string;
  keywords: string;
  classificationMode: string;
  course: string;
  subject: string;
  chapter: string;
  lesson: string;
  topic: string;
  status: string;
}

export type ImportRowState = 'VALID' | 'WARNING' | 'ERROR';

export interface QuestionImportRow {
  rowNumber: number;
  values: ImportRowValues;
  state: ImportRowState;
  errors: string[];
  warnings: string[];
}

export interface QuestionImportResult {
  fileName: string;
  fileSize: number;
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  rows: QuestionImportRow[];
}

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  NORMAL_MCQ: 'MCQ',
  NORMAL_DESCRIPTIVE: 'Descriptive',
  CASE_MCQ: 'Case-based MCQ',
  CASE_DESCRIPTIVE: 'Case-based descriptive',
};

export const emptyOptions = (): QuestionOption[] => (['A', 'B', 'C', 'D'] as const).map((id) => ({ id, html: '' }));

export const emptyClassification = (): QuestionClassification => ({
  courseId: '', subjectId: '', chapterId: '', lessonId: '', topicId: '',
});

export const emptySubQuestion = (kind: QuestionKind): CaseSubQuestion => ({
  id: `sub-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
  questionHtml: '',
  options: kind === 'CASE_MCQ' ? emptyOptions() : [],
  correctOptionId: null,
  correctExplanationHtml: '',
  premiumWrongOptionsExplanationHtml: '',
  answerHtml: '',
  classification: null,
});

export const emptyQuestion = (kind: QuestionKind = 'NORMAL_MCQ'): QuestionRecord => {
  const now = new Date().toISOString();
  return {
    id: '', kind, status: 'DRAFT', difficulty: 'INTERMEDIATE', questionHtml: '', answerHtml: '',
    options: kind === 'NORMAL_MCQ' ? emptyOptions() : [], correctOptionId: null,
    correctExplanationHtml: '', premiumWrongOptionsExplanationHtml: '', caseHtml: '', caseId: null,
    classificationMode: 'ENTIRE_CASE', classification: null,
    subQuestions: kind.startsWith('CASE_') ? [emptySubQuestion(kind)] : [],
    createdAt: now, updatedAt: now, deletedAt: null,
  };
};
