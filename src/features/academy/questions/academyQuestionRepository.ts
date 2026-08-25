import { apiRequest } from '@/lib/api/client';
import { adaptBackendQuestion } from '@/features/admin/questions/api/questionRepository';
import type { QuestionDataRepository } from '@/app/store/useQuestionStore';
import type { QuestionRecord, QuestionStatus } from '@/features/admin/questions/types/question';

const basePath = '/api/academy/questions';

const payloadFor = (question: QuestionRecord) => ({
  kind: question.kind,
  status: question.status === 'ARCHIVED' ? 'DRAFT' : question.status,
  difficulty: question.difficulty,
  questionHtml: question.questionHtml,
  answerHtml: question.answerHtml,
  caseHtml: question.caseHtml,
  classificationMode: question.classificationMode,
  correctOptionId: question.correctOptionId,
  correctExplanationHtml: question.correctExplanationHtml,
  premiumWrongOptionsExplanationHtml: question.premiumWrongOptionsExplanationHtml,
  classification: question.classification,
  options: question.options.map((option) => ({ optionLabel: option.id, html: option.html })),
  subQuestions: question.subQuestions.map((subQuestion) => ({
    questionHtml: subQuestion.questionHtml,
    answerHtml: subQuestion.answerHtml,
    correctOptionId: subQuestion.correctOptionId,
    correctExplanationHtml: subQuestion.correctExplanationHtml,
    premiumWrongOptionsExplanationHtml: subQuestion.premiumWrongOptionsExplanationHtml,
    classification: subQuestion.classification,
    options: subQuestion.options.map((option) => ({ optionLabel: option.id, html: option.html })),
  })),
});

export const academyQuestionRepository: QuestionDataRepository = {
  async list(includeDeleted = false) {
    const response = await apiRequest<{ data: any[] }>(`${basePath}?limit=100&includeDeleted=${includeDeleted}`);
    return response.data.map(adaptBackendQuestion);
  },
  async save(question) {
    const existing = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(question.id);
    const dto = await apiRequest<any>(existing ? `${basePath}/${encodeURIComponent(question.id)}` : basePath, {
      method: existing ? 'PUT' : 'POST',
      body: payloadFor(question),
    });
    return adaptBackendQuestion(dto);
  },
  async saveMany(records) {
    const saved: QuestionRecord[] = [];
    for (const record of records) saved.push(await this.save(record));
    return saved;
  },
  async duplicate(questionId) {
    return adaptBackendQuestion(await apiRequest<any>(`${basePath}/${encodeURIComponent(questionId)}/clone`, { method: 'POST' }));
  },
  async moveToTrash(questionId) {
    await apiRequest(`${basePath}/${encodeURIComponent(questionId)}/archive`, { method: 'POST' });
  },
  async restore(questionId) {
    await apiRequest(`${basePath}/${encodeURIComponent(questionId)}/restore`, { method: 'POST' });
  },
  async permanentDelete(questionId) {
    await apiRequest(`${basePath}/${encodeURIComponent(questionId)}`, { method: 'DELETE' });
  },
  async setStatus(questionId, status: QuestionStatus) {
    const action = status === 'PUBLISHED' ? 'publish' : status === 'ARCHIVED' ? 'archive' : 'restore';
    return adaptBackendQuestion(await apiRequest<any>(`${basePath}/${encodeURIComponent(questionId)}/${action}`, { method: 'POST' }));
  },
};

