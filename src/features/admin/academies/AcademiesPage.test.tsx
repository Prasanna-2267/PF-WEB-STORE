import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listHook, detailHook, detailResourceHook, createMutation, updateMutation, lifecycleMutation } = vi.hoisted(() => ({
  listHook: vi.fn(),
  detailHook: vi.fn(),
  detailResourceHook: vi.fn(),
  createMutation: { isPending: false, mutateAsync: vi.fn() },
  updateMutation: { isPending: false, mutateAsync: vi.fn() },
  lifecycleMutation: { isPending: false, mutateAsync: vi.fn() },
}));

vi.mock('@/app/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'super-admin-a' } }),
}));

vi.mock('../readOnly/adminReadOnlyApi', () => ({
  useAdminAcademiesReadOnly: listHook,
  useAdminAcademyReadOnly: detailHook,
  useAdminAcademyDetailResource: detailResourceHook,
  useCreateAdminAcademy: () => createMutation,
  useUpdateAdminAcademy: () => updateMutation,
  useAcademyLifecycle: () => lifecycleMutation,
}));

import AcademiesPage, { AcademyDetailsPage } from './AcademiesPage';

const academy = {
  id: 'academy-a',
  name: 'Notification Academy A',
  email: 'notification-academy-with-a-very-long-identifier@example.test',
  phone: '9000000001',
  address: '1 Main Street',
  city: 'Chennai',
  state: 'Tamil Nadu',
  country: 'India',
  postalCode: '600001',
  website: '',
  description: '',
  status: 'ACTIVE',
  adminName: 'Admin A',
  adminEmail: 'academy-administrator-with-a-long-address@example.test',
  adminPhone: '',
  studentCount: 3,
  activeStudentCount: 3,
  courseCount: 1,
  activeCourseCount: 1,
  packageCount: 0,
  orderCount: 0,
  revenue: 0,
  createdAt: '2026-08-25T05:00:00.000Z',
  updatedAt: '2026-08-25T05:00:00.000Z',
};

const detailAcademy = {
  ...academy,
  administrator: {
    id: 'admin-a',
    name: 'Admin A',
    email: 'admin-a@example.test',
    phone: null,
    identityStatus: 'ACTIVE',
    membershipStatus: 'ACTIVE',
  },
  metrics: {
    studentsCount: 3,
    activeStudentsCount: 2,
    coursesCount: 1,
    publishedCoursesCount: 1,
    contentCount: 2,
    publishedContentCount: 2,
    packagesCount: 7,
    questionsCount: 4,
    broadcastCount: 2,
    activeBroadcastCount: 1,
    ordersCount: 9,
    revenue: 12000,
  },
  admins: [],
  students: [{ id: 'membership-1', joinedAt: academy.createdAt, user: { id: 'student-1', fullName: 'Student One', email: 'student@example.test', status: 'ACTIVE' } }],
  memberships: [],
  invitations: [],
  courses: [],
  tenantCourses: [{ id: 'course-1', code: 'PF101', name: 'Foundations', status: 'ACTIVE', createdAt: academy.createdAt }],
  contentItems: [
    { id: 'folder-1', name: 'Foundation resources', kind: 'FOLDER', mimeType: null, size: 0, status: 'PUBLISHED', createdAt: academy.createdAt, course: { id: 'course-1', name: 'Foundations' } },
    { id: 'content-1', name: 'Study guide.pdf', kind: 'FILE', mimeType: 'application/pdf', size: 2048, status: 'PUBLISHED', createdAt: academy.createdAt, course: { id: 'course-1', name: 'Foundations' } },
  ],
  questions: [{ id: 'question-1', kind: 'NORMAL_MCQ', status: 'PUBLISHED', difficulty: 'FOUNDATION', questionHtml: '<p>What is Parallax?</p>', caseHtml: '', createdAt: academy.createdAt, course: { id: 'course-1', name: 'Foundations' } }],
  packages: [{ id: 'package-1' }],
  orders: [{ id: 'order-1' }],
  broadcasts: [{ id: 'broadcast-1', title: 'Welcome students', status: 'ACTIVE', priority: 'NORMAL', publishedAt: academy.createdAt, createdAt: academy.createdAt }],
  systemAuditLogs: [{ id: 'audit-1', action: 'ACADEMY_CREATED', entityType: 'Academy', description: 'Created academy', occurredAt: academy.createdAt }],
};

describe('Academies production list layout', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    listHook.mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [academy], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } },
      refetch: vi.fn(),
    });
    detailHook.mockReturnValue({ isPending: false, isError: false, data: detailAcademy });
    detailResourceHook.mockImplementation((_userId: string, _academyId: string, resource?: string) => {
      const dataByResource: Record<string, unknown[]> = {
        students: detailAcademy.students,
        courses: detailAcademy.tenantCourses,
        content: detailAcademy.contentItems,
        questions: detailAcademy.questions,
        broadcasts: detailAcademy.broadcasts,
        audit: detailAcademy.systemAuditLogs,
      };
      return {
        isPending: false,
        isError: false,
        data: resource ? { data: dataByResource[resource], pagination: { page: 1, limit: 25, total: dataByResource[resource].length, totalPages: 1 } } : undefined,
        refetch: vi.fn(),
      };
    });
  });

  it('renders the operational Academy Details architecture with real counts and no commerce modules', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/academies/academy-a']}>
        <Routes><Route path="/admin/academies/:academyId" element={<AcademyDetailsPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Notification Academy A' })).toBeInTheDocument();
    expect(screen.getByText('Admin A')).toBeInTheDocument();
    expect(screen.getByText('Operational State')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Content (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Questions (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Broadcasts (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /admins/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /packages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /orders/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Orders & Revenue')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Students (3)' }));
    expect(screen.getByText('Student One')).toBeInTheDocument();
    expect(screen.getByText('student@example.test', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Courses (1)' }));
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Content (2)' }));
    expect(screen.getByText('Study guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('Foundation resources')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Questions (4)' }));
    expect(screen.getByText('What is Parallax?')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Broadcasts (2)' }));
    expect(screen.getByText('Welcome students')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Audit Log (1)' }));
    expect(screen.getByText('ACADEMY_CREATED: Created academy')).toBeInTheDocument();
  });

  it('keeps Academy editing and suspension behind explicit UI actions and confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/academies/academy-a']}>
        <Routes><Route path="/admin/academies/:academyId" element={<AcademyDetailsPage />} /></Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit Academy' }));
    expect(screen.getByRole('dialog', { name: 'Edit Academy' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close modal' }));

    await user.click(screen.getByRole('button', { name: 'Suspend Academy' }));
    const suspendDialog = screen.getByRole('dialog', { name: 'Suspend Notification Academy A?' });
    expect(suspendDialog).toBeInTheDocument();
    expect(lifecycleMutation.mutateAsync).not.toHaveBeenCalled();
    await user.click(within(suspendDialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Suspend Notification Academy A?' })).not.toBeInTheDocument());
  });

  it('renders the compact real-data columns and toolbar without the removed contact column', () => {
    render(<MemoryRouter><AcademiesPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Academies' })).toBeInTheDocument();
    expect(screen.getByText('Manage and oversee all academies on the platform.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add academy/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Academy' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Courses' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /contact/i })).not.toBeInTheDocument();
    expect(screen.getByText('Notification Academy A')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('preserves search, status, sorting, add, and row action behavior', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AcademiesPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('Search name, admin, email, or city'), 'notification{Enter}');
    await waitFor(() => expect(listHook).toHaveBeenLastCalledWith(
      'super-admin-a',
      expect.objectContaining({ search: 'notification' }),
    ));

    await user.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    await waitFor(() => expect(listHook).toHaveBeenLastCalledWith(
      'super-admin-a',
      expect.objectContaining({ status: 'PENDING' }),
    ));

    await user.selectOptions(screen.getByLabelText('Sort'), 'oldest');
    await waitFor(() => expect(listHook).toHaveBeenLastCalledWith(
      'super-admin-a',
      expect.objectContaining({ sort: 'oldest' }),
    ));

    await user.click(screen.getByRole('button', { name: /add academy/i }));
    expect(screen.getByRole('dialog', { name: 'New Academy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close modal' }));
    await user.click(screen.getByLabelText('Actions for Notification Academy A'));
    expect(screen.getByRole('link', { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit academy/i })).toBeInTheDocument();
  });
});
