import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api/client';
import QuestionsPage from './QuestionsPage';

const academyId = '11111111-1111-4111-8111-111111111111';
const courseId = '22222222-2222-4222-8222-222222222222';
const now = '2026-10-19T10:00:00.000Z';

const questions = [
  { id: '33333333-3333-4333-8333-333333333331', text: 'First bulk question' },
  { id: '33333333-3333-4333-8333-333333333332', text: 'Second bulk question' },
].map(({ id, text }) => ({
  id, kind: 'NORMAL_MCQ', status: 'DRAFT', difficulty: 'INTERMEDIATE', practiceCollection: 'ORIGINAL',
  questionHtml: `<p>${text}</p>`, caseHtml: '', correctOptionId: 'A', correctExplanationHtml: '', premiumWrongOptionsExplanationHtml: '',
  examName: 'Final', chapterName: 'Accounts', conceptName: 'Revenue', questionBankId: null,
  options: [{ optionLabel: 'A', html: '<p>Yes</p>' }, { optionLabel: 'B', html: '<p>No</p>' }], subQuestions: [],
  courseId, contentLinks: [{ contentItemId: 'file-a', contentItem: { id: 'file-a', name: 'Note.pdf', mimeType: 'application/pdf', accessType: 'FREE', status: 'PUBLISHED' } }],
  createdAt: now, updatedAt: now,
}));

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={client}><QuestionsPage scope="academy" academyId={academyId} /></QueryClientProvider></MemoryRouter>);
};

describe('Questions overview bulk selection and actions', () => {
  beforeEach(() => {
    vi.spyOn(api, 'apiRequest').mockImplementation(async (path: string) => {
      if (path.startsWith('/api/academy/courses')) return { data: [{ id: courseId, name: 'Course A', slug: 'course-a', code: 'A', status: 'ACTIVE', createdAt: now, updatedAt: now }] } as never;
      if (path.includes('/questions/files')) return [] as never;
      if (path.includes('/questions/banks')) return [] as never;
      if (path.startsWith('/api/academy/questions?')) return { data: questions, pagination: { page: 1, total: 30, totalPages: 2 } } as never;
      if (path.endsWith('/questions/bulk')) return { action: 'archive', requested: 30, succeeded: questions.map(({ id }) => ({ id })), failed: [] } as never;
      return {} as never;
    });
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('supports indeterminate page selection and a server-side all-matching action with active filters', async () => {
    const user = userEvent.setup();
    renderPage();
    const first = await screen.findByRole('checkbox', { name: 'Select First bulk question' });
    const header = screen.getByRole('checkbox', { name: 'Select all questions on this page' }) as HTMLInputElement;

    await user.click(first);
    expect(header.indeterminate).toBe(true);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(first).not.toBeChecked();

    await user.type(screen.getByPlaceholderText('Search question or linked file'), 'revenue');
    await user.type(screen.getByPlaceholderText('Exam name'), 'Final');
    await user.type(screen.getByPlaceholderText('Chapter name'), 'Accounts');
    await user.click(screen.getByRole('checkbox', { name: 'Select all questions on this page' }));
    await user.click(await screen.findByRole('button', { name: 'Select all 30 matching questions' }));
    expect(screen.getByText('30 selected')).toBeInTheDocument();

    await user.click(within(screen.getByRole('region', { name: 'Bulk question actions' })).getByRole('button', { name: 'Archive' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm action' }));

    await waitFor(() => expect(api.apiRequest).toHaveBeenCalledWith('/api/academy/questions/bulk', expect.objectContaining({
      academyId,
      method: 'POST',
      body: expect.objectContaining({ action: 'archive', selection: expect.objectContaining({ mode: 'filter', filters: expect.objectContaining({ courseId, search: 'revenue', examName: 'Final', chapterName: 'Accounts' }) }) }),
    })));
  });

  it('removes successes and keeps only failed questions selected after a partial result', async () => {
    vi.mocked(api.apiRequest).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/academy/courses')) return { data: [{ id: courseId, name: 'Course A', slug: 'course-a', code: 'A', status: 'ACTIVE', createdAt: now, updatedAt: now }] } as never;
      if (path.includes('/questions/files') || path.includes('/questions/banks')) return [] as never;
      if (path.startsWith('/api/academy/questions?')) return { data: questions, pagination: { page: 1, total: 2, totalPages: 1 } } as never;
      if (path.endsWith('/questions/bulk')) return { action: 'publish', requested: 2, succeeded: [{ id: questions[0]!.id }], failed: [{ id: questions[1]!.id, code: 'INVALID_QUESTION_TRANSITION', message: 'Could not publish.' }] } as never;
      return {} as never;
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('checkbox', { name: 'Select First bulk question' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Second bulk question' }));
    await user.click(within(screen.getByRole('region', { name: 'Bulk question actions' })).getByRole('button', { name: 'Publish' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm action' }));

    await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Select First bulk question' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Second bulk question' })).toBeChecked();
    expect(screen.getByText('Bulk action partially completed')).toBeInTheDocument();
  });
});
