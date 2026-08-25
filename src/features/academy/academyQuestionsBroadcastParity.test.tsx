import React from 'react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcademyQuestionStore } from './questions/academyQuestionStore';
import QuestionsPage from '@/features/admin/questions/QuestionsPage';
import { BroadcastPage } from '@/features/admin/broadcast/BroadcastPage';
import type { BroadcastState } from '@/app/store/useBroadcastStore';
import type { Broadcast } from '@/features/admin/broadcast/types/broadcast';
import type { AdminCourse } from '@/features/admin/types/admin';

const academyId = '11111111-1111-4111-8111-111111111111';
const courseId = '22222222-2222-4222-8222-222222222222';
const now = '2026-08-25T10:00:00.000Z';

const renderPage = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={queryClient}>{ui}</QueryClientProvider></MemoryRouter>);
};

const academyCourse: AdminCourse = {
  id: courseId,
  slug: 'academy-course',
  code: 'ACA-101',
  name: 'Academy Course',
  description: 'Tenant-owned course',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
};

const academyBroadcast: Broadcast = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Academy examination notice',
  subtitle: 'Current Academy only',
  message: 'The examination timetable is available.',
  type: 'ACADEMIC',
  priority: 'HIGH',
  status: 'DRAFT',
  disabledFrom: null,
  image: null,
  cta: { enabled: false, text: '', action: 'INTERNAL_ROUTE', destination: '' },
  audience: { kind: 'ACADEMY_STUDENTS', courseIds: [], packageIds: [], academyIds: [] },
  platform: 'BOTH',
  placements: ['NOTIFICATION'],
  startAt: null,
  endAt: null,
  frequency: 'ONCE',
  dismissible: true,
  presentation: 'NOTIFICATION',
  displayOrder: 'AUTOMATIC',
  customOrderWeight: 50,
  acknowledgementRequired: false,
  repeatBehavior: 'NEVER',
  showInWhatsNew: false,
  timeline: [],
  analytics: { reached: 0, viewed: 0, uniqueViews: 0, clicked: 0, dismissed: 0, acknowledged: 0, ctr: 0 },
  createdAt: now,
  updatedAt: now,
  publishedAt: null,
};

const broadcastStore = (): BroadcastState => ({
  status: 'ready',
  error: null,
  broadcasts: [academyBroadcast],
  pendingId: null,
  initialize: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
  createDraft: vi.fn(),
  updateBroadcast: vi.fn(),
  publishNow: vi.fn(),
  scheduleBroadcast: vi.fn(),
  duplicateBroadcast: vi.fn(),
  disableBroadcast: vi.fn(),
  enableBroadcast: vi.fn(),
  cancelSchedule: vi.fn(),
  archiveBroadcast: vi.fn(),
  restoreBroadcast: vi.fn(),
  deleteBroadcast: vi.fn(),
});

describe('Academy Questions and Broadcast shared-module parity', () => {
  beforeEach(() => {
    useAcademyQuestionStore.setState({
      scopeKey: `academy:${academyId}`,
      loading: false,
      error: null,
      taxonomy: {
        courses: [{ id: courseId, name: 'Academy Course' }],
        subjects: [{ id: 'subject-a', courseId, name: 'Academy Subject' }],
        chapters: [],
        lessons: [],
        topics: [],
      },
      questions: [{
        id: 'question-a',
        kind: 'NORMAL_DESCRIPTIVE',
        status: 'PUBLISHED',
        difficulty: 'INTERMEDIATE',
        questionHtml: '<p>Academy-scoped question?</p>',
        answerHtml: '<p>Yes.</p>',
        options: [],
        correctOptionId: null,
        correctExplanationHtml: '',
        premiumWrongOptionsExplanationHtml: '',
        caseHtml: '',
        caseId: null,
        classificationMode: 'ENTIRE_CASE',
        classification: { courseId, subjectId: 'subject-a', chapterId: '', lessonId: '', topicId: '' },
        subQuestions: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }],
    });
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    useAcademyQuestionStore.setState({ scopeKey: '', questions: [], taxonomy: null, loading: false, error: null });
  });

  it('renders the complete shared Questions workspace with only Academy taxonomy', () => {
    renderPage(<QuestionsPage scope="academy" academyId={academyId} academyName="Academy A" />);

    expect(screen.getByRole('button', { name: /Import questions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add new question/i })).toBeInTheDocument();
    for (const label of ['Question Bank', 'Add Question', 'Excel Import', 'Taxonomy', 'Trash (0)']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('Academy-scoped question?')).toBeInTheDocument();
    expect(screen.getByText('Academy Course › Academy Subject')).toBeInTheDocument();
    const courseFilter = screen.getByRole('combobox', { name: 'Filter by course' });
    expect(within(courseFilter).getByRole('option', { name: 'Academy Course' })).toBeInTheDocument();
    expect(within(courseFilter).queryByRole('option', { name: /Platform/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by subject' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by chapter' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by lesson' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by topic' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by question type' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by difficulty' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeInTheDocument();
  });

  it('renders shared Broadcast stats, filters, listing, and Academy-only editor choices', async () => {
    const user = userEvent.setup();
    renderPage(<BroadcastPage scope="academy" academyId={academyId} academyName="Academy A" storeOverride={broadcastStore()} academyCourses={[academyCourse]} />);

    const summary = screen.getByRole('region', { name: 'Broadcast summary' });
    expect(summary).toBeInTheDocument();
    for (const label of ['Total', 'Active', 'Scheduled', 'Drafts', 'Expired', 'Archived']) expect(within(summary).getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search broadcasts' })).toBeInTheDocument();
    expect(screen.getAllByText('Academy examination notice').length).toBeGreaterThan(0);

    const typeFilter = screen.getAllByRole('combobox').find((select) => within(select).queryByRole('option', { name: 'All types' }));
    expect(typeFilter).toBeDefined();
    expect(within(typeFilter!).queryByRole('option', { name: 'Store' })).not.toBeInTheDocument();
    expect(within(typeFilter!).queryByRole('option', { name: 'Promotion' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New broadcast/i }));
    const dialog = screen.getByRole('dialog', { name: 'New broadcast' });
    for (const step of ['Basic', 'Content', 'Audience', 'Display', 'Schedule', 'Behavior', 'Review']) {
      expect(within(dialog).getByRole('button', { name: new RegExp(step) })).toBeInTheDocument();
    }
    await user.click(within(dialog).getByRole('button', { name: /Audience/ }));
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Who should receive this?' })).toBeInTheDocument());
    expect(within(dialog).getByRole('button', { name: /Academy students only/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Specific courses/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /All Parallax Flow users/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Specific packages/i })).not.toBeInTheDocument();
  });
});
