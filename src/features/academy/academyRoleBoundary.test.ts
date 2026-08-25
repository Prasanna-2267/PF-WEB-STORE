import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/lib/api/client';
import { academyBroadcastApi, academyContentApi, academyQuestionApi } from './api/academyAcademicApi';

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);

describe('Academy Admin academic-only API boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); request.mockResolvedValue({}); });

  it('uses the server-derived Academy scope for content without an academyId payload or header', async () => {
    await academyContentApi.createFolder('course-a', null, 'Module 1');
    expect(request).toHaveBeenCalledWith('/api/academy/content/folders', {
      method: 'POST',
      body: { courseId: 'course-a', parentId: null, name: 'Module 1' },
    });
  });

  it('keeps the full Drive workflow on Academy routes without a client-selected tenant', async () => {
    await academyContentApi.list('course-a', 'all', 'ledger', true);
    await academyContentApi.move('content-a', 'folder-a');
    await academyContentApi.copy('content-a', null);
    await academyContentApi.update('content-a', { description: 'Academy notes' });
    await academyContentApi.updateOrder('course-a', 'folder-a', ['content-a', 'content-b']);

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/academy/content?courseId=course-a&parentId=all&search=ledger&includeArchived=true&page=1&limit=1000',
      '/api/academy/content/content-a/move',
      '/api/academy/content/content-a/copy',
      '/api/academy/content/content-a',
      '/api/academy/content/display-orders',
    ]);
    expect(request).toHaveBeenNthCalledWith(2, '/api/academy/content/content-a/move', { method: 'POST', body: { parentId: 'folder-a' } });
    expect(request).toHaveBeenNthCalledWith(3, '/api/academy/content/content-a/copy', { method: 'POST', body: { parentId: null } });
    expect(request).toHaveBeenNthCalledWith(5, '/api/academy/content/display-orders', { method: 'PATCH', body: { courseId: 'course-a', folderId: 'folder-a', itemIds: ['content-a', 'content-b'] } });
    expect(JSON.stringify(request.mock.calls)).not.toContain('academyId');
    expect(JSON.stringify(request.mock.calls)).not.toContain('/api/admin/');
  });

  it('creates questions only through the Academy question bank contract', async () => {
    await academyQuestionApi.create({ kind: 'NORMAL_DESCRIPTIVE', difficulty: 'FOUNDATION', questionHtml: 'Explain accrual accounting.' });
    expect(request).toHaveBeenCalledWith('/api/academy/questions', {
      method: 'POST',
      body: expect.objectContaining({ kind: 'NORMAL_DESCRIPTIVE', status: 'DRAFT' }),
    });
    expect(request.mock.calls[0]?.[0]).not.toContain('/api/admin/');
  });

  it('supports Academy-scoped case questions without a client tenant selector', async () => {
    await academyQuestionApi.create({
      kind: 'CASE_MCQ',
      difficulty: 'ADVANCED',
      courseId: 'course-a',
      caseHtml: 'Read this case.',
      classificationMode: 'ENTIRE_CASE',
      subQuestions: [{ questionHtml: 'Choose one.', correctOptionId: 'A', options: [{ optionLabel: 'A', html: 'Yes' }, { optionLabel: 'B', html: 'No' }] }],
    });
    expect(request).toHaveBeenCalledWith('/api/academy/questions', {
      method: 'POST',
      body: expect.objectContaining({ kind: 'CASE_MCQ', courseId: 'course-a', status: 'DRAFT' }),
    });
    expect(JSON.stringify(request.mock.calls)).not.toContain('academyId');
  });

  it('creates Academy-scoped announcements without commerce audience fields', async () => {
    await academyBroadcastApi.create({ title: 'Exam update', subtitle: '', message: 'The timetable is available.', type: 'ACADEMIC', priority: 'NORMAL', targetCourseId: 'course-a' });
    expect(request).toHaveBeenCalledWith('/api/academy/broadcasts', {
      method: 'POST',
      body: { title: 'Exam update', subtitle: '', message: 'The timetable is available.', type: 'ACADEMIC', priority: 'NORMAL', targetCourseId: 'course-a' },
    });
    expect(JSON.stringify(request.mock.calls)).not.toContain('academyId');
  });
});
