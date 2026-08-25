import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Search, UserPlus, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { buildAcademyStudentPath, ROUTES } from '@/config/routes';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminToast, type AdminToastData } from '@/features/admin/AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import {
  type AcademyMembershipStatus,
  type AccountStatus,
  enrollAcademyStudent,
  fetchAcademyCourses,
  mutateAcademyStudentStatus,
  useAcademyStudentReadOnly,
  useAcademyStudentsReadOnly,
} from './academyReadOnlyApi';
import '@/features/admin/admin-pages.css';

const PAGE_LIMIT = 25;
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Unavailable';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const statusTone = (status: string) => status === 'ACTIVE' || status === 'COMPLETED' ? 'success' : status === 'INVITED' ? 'warning' : 'danger';

export const AcademyStudentsReadOnlyPage: React.FC = () => {
  const { activeAcademyId, activeAcademy } = useAcademyTenantStore();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<AcademyMembershipStatus | ''>('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | ''>('');
  const query = useAcademyStudentsReadOnly(activeAcademyId, {
    page,
    limit: PAGE_LIMIT,
    search: searchInput.trim() || undefined,
    status: status || undefined,
    accountStatus: accountStatus || undefined,
  });

  return (
    <div className="pf-admin-page">
      <AdminPageHeader
        title="Students"
        description={`Manage the live student memberships belonging to ${activeAcademy?.name || 'your Academy'}.`}
        actions={<Link className="pf-admin-button pf-admin-button--primary" to={ROUTES.ACADEMY_ADMISSIONS}><UserPlus size={16} /> Admit students</Link>}
      />
      <section className="pf-admin-table-card">
        <div className="pf-admin-table-card__header pf-admin-student-toolbar">
          <form className="pf-admin-search-field" onSubmit={(event) => event.preventDefault()}>
            <Search size={17} aria-hidden="true" />
            <label className="pf-admin-sr-only" htmlFor="academy-student-search">Search students</label>
            <input
              id="academy-student-search"
              className="pf-admin-input"
              type="search"
              value={searchInput}
              placeholder="Search by name, email, or phone..."
              onChange={(event) => { setSearchInput(event.target.value); setPage(1); }}
            />
          </form>
          <label className="pf-admin-field">
            <span>Membership status</span>
            <select
              className="pf-admin-select"
              value={status}
              onChange={(event) => { setStatus(event.target.value as AcademyMembershipStatus | ''); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </label>
          <label className="pf-admin-field">
            <span>Account status</span>
            <select className="pf-admin-select" value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value as AccountStatus | ''); setPage(1); }}>
              <option value="">All account statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
          <div className="pf-admin-field"><span>Academy role</span><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled>Academy Student</button></div>
        </div>

        {query.isPending ? (
          <AdminSkeleton rows={8} variant="table" label="Loading Academy students" />
        ) : query.isError ? (
          <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Academy students" />
        ) : query.data.items.length === 0 ? (
          <AdminEmptyState
            icon={<UsersRound size={22} />}
            title="No students found"
            description={searchInput || status || accountStatus ? 'No server records match the current filters.' : 'This Academy has no student memberships.'}
          />
        ) : (
          <>
            <div className="pf-admin-table-scroll">
              <table className="pf-admin-table pf-admin-students-table">
                <thead><tr><th>STUDENT</th><th>ROLE</th><th>MEMBERSHIP</th><th>ACCOUNT</th><th>JOINED</th><th>LAST LOGIN</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {query.data.items.map((student) => (
                    <tr key={student.membershipId}>
                      <td>
                        <span className="pf-admin-person">
                          <span className="pf-admin-avatar">{initials(student.name)}</span>
                          <span><strong>{student.name}</strong><small>{student.email}</small></span>
                        </span>
                      </td>
                      <td><AdminStatusBadge tone="neutral">ACADEMY STUDENT</AdminStatusBadge></td>
                      <td><AdminStatusBadge tone={statusTone(student.membershipStatus)}>{student.membershipStatus}</AdminStatusBadge></td>
                      <td><AdminStatusBadge tone={student.accountStatus === 'ACTIVE' ? 'success' : 'danger'}>{student.accountStatus}</AdminStatusBadge></td>
                      <td>{formatDate(student.joinedAt)}</td>
                      <td>{student.lastLoginAt ? formatDate(student.lastLoginAt) : 'Never'}</td>
                      <td><Link className="pf-admin-details-button" to={buildAcademyStudentPath(student.studentId)}>Manage</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ReadOnlyPagination
              page={query.data.pagination.page}
              totalPages={query.data.pagination.totalPages}
              total={query.data.pagination.total}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
};

export const AcademyStudentReadOnlyDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { activeAcademyId, activeAcademy } = useAcademyTenantStore();
  const query = useAcademyStudentReadOnly(activeAcademyId, studentId);
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'REVOKED' | null>(null);
  const [courseId, setCourseId] = useState('');
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const courses = useQuery({ queryKey: ['academy', activeAcademyId, 'student-enrollment-courses'], queryFn: ({ signal }) => fetchAcademyCourses({ page: 1, limit: 100 }, signal), enabled: Boolean(activeAcademyId) });
  const statusMutation = useMutation({
    mutationFn: (status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => mutateAcademyStudentStatus(studentId!, status),
    onSuccess: async (_, status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'students'] }),
        queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'overview'] }),
      ]);
      setPendingStatus(null);
      setToast({ id: Date.now(), tone: 'success', title: 'Membership updated', message: `The backend changed this membership to ${status}.` });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Membership not updated', message: error instanceof Error ? error.message : 'The server rejected the change.' }),
  });
  const enrollmentMutation = useMutation({
    mutationFn: () => enrollAcademyStudent(studentId!, courseId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'students', 'detail', studentId] }); setCourseId(''); setToast({ id: Date.now(), tone: 'success', title: 'Student enrolled', message: 'The course enrollment is active in PostgreSQL.' }); },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Enrollment failed', message: error instanceof Error ? error.message : 'The server rejected the enrollment.' }),
  });

  if (query.isPending) return <AdminSkeleton rows={7} variant="detail" label="Loading Academy student" />;
  if (query.isError) {
    return <div className="pf-admin-page"><ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Academy student" /></div>;
  }
  const student = query.data;
  return (
    <div className="pf-admin-page">
      <AdminPageHeader
        title={student.name}
        description={`Server-owned membership details for ${activeAcademy?.name || 'this Academy'}.`}
        breadcrumbs={[{ label: 'Students', to: ROUTES.ACADEMY_STUDENTS }, { label: student.name }]}
        actions={<div className="pf-admin-table-actions">{student.membershipStatus !== 'ACTIVE' ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setPendingStatus('ACTIVE')}>Activate</button> : <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setPendingStatus('SUSPENDED')}>Suspend</button>}<button className="pf-admin-button pf-admin-button--danger" type="button" disabled={student.membershipStatus === 'REVOKED'} onClick={() => setPendingStatus('REVOKED')}>Revoke</button><Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ACADEMY_STUDENTS}><ArrowLeft size={15} /> Back to Students</Link></div>}
      />
      <article className="pf-admin-card pf-admin-student-hero">
        <div className="pf-admin-student-hero__identity">
          <div className="pf-admin-student-hero__avatar"><span className="pf-admin-avatar">{initials(student.name)}</span></div>
          <div><p>STUDENT MEMBERSHIP</p><h2>{student.name}</h2><span>{student.email}</span></div>
        </div>
        <div className="pf-admin-student-hero__badges">
          <AdminStatusBadge tone="neutral">ACADEMY STUDENT</AdminStatusBadge>
          <AdminStatusBadge tone={statusTone(student.membershipStatus)}>MEMBERSHIP {student.membershipStatus}</AdminStatusBadge>
          <AdminStatusBadge tone={student.accountStatus === 'ACTIVE' ? 'success' : 'danger'}>ACCOUNT {student.accountStatus}</AdminStatusBadge>
        </div>
      </article>
      <div className="pf-admin-detail-layout">
        <section className="pf-admin-table-card">
          <header className="pf-admin-section__header"><div><h2>Course enrollments</h2><p>Only enrollments returned by the Academy detail endpoint.</p></div></header>
          {student.enrollments.length ? (
            <div className="pf-admin-table-scroll">
              <table className="pf-admin-table"><thead><tr><th>COURSE</th><th>STATUS</th><th>ENROLLED</th><th>COMPLETED</th></tr></thead>
                <tbody>{student.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td><strong>{enrollment.courseName}</strong><small className="pf-course-table__description">{enrollment.courseCode}</small></td>
                    <td><AdminStatusBadge tone={statusTone(enrollment.status)}>{enrollment.status}</AdminStatusBadge></td>
                    <td>{formatDate(enrollment.enrolledAt)}</td><td>{formatDate(enrollment.completedAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <AdminEmptyState compact icon={<BookOpen size={20} />} title="No enrollments" description="The backend returned no course enrollments for this student." />}
        </section>
        <aside className="pf-admin-detail-side">
          <section className="pf-admin-card"><h2>Membership record</h2><p className="pf-admin-muted-copy">Phone: {student.phone || 'Unavailable'}</p><p className="pf-admin-muted-copy">Joined: {formatDate(student.joinedAt)}</p><p className="pf-admin-muted-copy">Last login: {student.lastLoginAt ? formatDate(student.lastLoginAt) : 'Never'}</p></section>
          <section className="pf-admin-card"><h2>Enroll in course</h2><label className="pf-admin-field"><span>Active Academy course</span><select className="pf-admin-select" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course</option>{courses.data?.items.filter((course) => course.status === 'ACTIVE' && !student.enrollments.some((enrollment) => enrollment.courseId === course.id && enrollment.status === 'ACTIVE')).map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</select></label><button className="pf-admin-button pf-admin-button--primary" type="button" disabled={!courseId || enrollmentMutation.isPending || student.membershipStatus !== 'ACTIVE'} onClick={() => enrollmentMutation.mutate()}>{enrollmentMutation.isPending ? 'Enrolling…' : 'Enroll student'}</button></section>
        </aside>
      </div>
      <AdminDialog open={Boolean(pendingStatus)} onClose={() => !statusMutation.isPending && setPendingStatus(null)} title={`${pendingStatus === 'ACTIVE' ? 'Activate' : pendingStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke'} student membership?`} description={pendingStatus === 'REVOKED' ? 'This removes the student’s active access to this Academy. The action is audited.' : 'This changes Academy access immediately after backend confirmation.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={statusMutation.isPending} onClick={() => setPendingStatus(null)}>Cancel</button><button className={`pf-admin-button ${pendingStatus === 'REVOKED' ? 'pf-admin-button--danger' : 'pf-admin-button--primary'}`} type="button" disabled={statusMutation.isPending} onClick={() => pendingStatus && statusMutation.mutate(pendingStatus)}>{statusMutation.isPending ? 'Working…' : 'Confirm'}</button></>} />
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};
