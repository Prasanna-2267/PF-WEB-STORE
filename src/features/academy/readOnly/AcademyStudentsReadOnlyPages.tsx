import { AppSelect } from '@/components/ui/AppSelect';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Gift, KeyRound, Search, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { buildAcademyStudentPath, ROUTES } from '@/config/routes';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminToast, type AdminToastData } from '@/features/admin/AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import { GrantAccessDialog } from '@/features/admin/readOnly/GrantAccessDialog';
import {
  type AcademyMembershipStatus,
  type AccountStatus,
  enrollAcademyStudent,
  fetchAcademyCourses,
  mutateAcademyStudentStatus,
  useAcademyStudentReadOnly,
  useAcademyStudentsReadOnly,
  approveAcademyStudentDeviceReset,
  mutateAcademyStudentAccountStatus,
  permanentlyDeleteAcademyStudent,
  fetchAcademyStudentEntitlements,
  revokeAcademyStudentEntitlement,
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
            <AppSelect
              className="pf-admin-select"
              value={status}
              onChange={(event) => { setStatus(event.target.value as AcademyMembershipStatus | ''); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INVITED">Invited</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </AppSelect>
          </label>
          <label className="pf-admin-field">
            <span>Account status</span>
            <AppSelect className="pf-admin-select" value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value as AccountStatus | ''); setPage(1); }}>
              <option value="">All account statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </AppSelect>
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
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const { activeAcademyId, activeAcademy } = useAcademyTenantStore();
  const query = useAcademyStudentReadOnly(activeAcademyId, studentId);
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'REVOKED' | null>(null);
  const [courseId, setCourseId] = useState('');
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [deviceApprovalOpen, setDeviceApprovalOpen] = useState(false);
  const [grantAccessOpen, setGrantAccessOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; title: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [toast, setToast] = useState<AdminToastData | null>(null);
  const courses = useQuery({ queryKey: ['academy', activeAcademyId, 'student-enrollment-courses'], queryFn: ({ signal }) => fetchAcademyCourses({ page: 1, limit: 100 }, signal), enabled: Boolean(activeAcademyId) });
  const entitlements = useQuery({ queryKey: ['academy', activeAcademyId, 'students', studentId, 'entitlements'], queryFn: ({ signal }) => fetchAcademyStudentEntitlements(studentId!, signal), enabled: Boolean(activeAcademyId && studentId) });
  const revokeAccess = useMutation({
    mutationFn: () => revokeAcademyStudentEntitlement(revokeTarget!.id, revokeReason.trim()),
    onSuccess: async () => { await entitlements.refetch(); setRevokeTarget(null); setRevokeReason(''); setToast({ id: Date.now(), tone: 'success', title: 'Access revoked', message: 'Usable manual access was removed and its history was retained.' }); },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Access not revoked', message: error instanceof Error ? error.message : 'The server rejected the change.' }),
  });
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
        actions={<div className="pf-admin-table-actions"><button className="pf-admin-button pf-admin-button--primary" type="button" disabled={student.membershipStatus !== 'ACTIVE' || student.accountStatus !== 'ACTIVE'} onClick={() => setGrantAccessOpen(true)}>Grant access</button>{student.membershipStatus !== 'ACTIVE' ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setPendingStatus('ACTIVE')}>Activate</button> : <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setPendingStatus('SUSPENDED')}>Suspend</button>}<button className="pf-admin-button pf-admin-button--danger" type="button" disabled={student.membershipStatus === 'REVOKED'} onClick={() => setPendingStatus('REVOKED')}>Revoke</button><Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ACADEMY_STUDENTS}><ArrowLeft size={15} /> Back to Students</Link></div>}
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
          <header className="pf-admin-section__header"><div><h2>Learning signals</h2><p>Based on real practice attempts after at least {student.performanceInsights.minimumAttempts} attempts per concept.</p></div></header>
          <div className="pf-admin-detail-layout" style={{ padding: 18 }}><div><h3>Weak concepts</h3>{student.performanceInsights.weakConcepts.length ? student.performanceInsights.weakConcepts.map((item) => <p key={`${item.courseId}:${item.chapterName}:${item.conceptName}`} className="pf-admin-muted-copy"><strong>{item.conceptName}</strong> · {item.chapterName} · {item.accuracyPercent}%</p>) : <p className="pf-admin-muted-copy">No weak signals yet.</p>}</div><div><h3>Strong concepts</h3>{student.performanceInsights.strongConcepts.length ? student.performanceInsights.strongConcepts.map((item) => <p key={`${item.courseId}:${item.chapterName}:${item.conceptName}`} className="pf-admin-muted-copy"><strong>{item.conceptName}</strong> · {item.chapterName} · {item.accuracyPercent}%</p>) : <p className="pf-admin-muted-copy">No strong signals yet.</p>}</div></div>
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
          <header className="pf-admin-section__header"><div><h2>Existing / Granted Access</h2><p>Manual access history is separate from Store purchases and is retained after expiry or revocation.</p></div><button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={student.membershipStatus !== 'ACTIVE' || student.accountStatus !== 'ACTIVE'} onClick={() => setGrantAccessOpen(true)}><Gift size={15} /> Grant access</button></header>
          {entitlements.isPending ? <AdminSkeleton rows={3} variant="detail" label="Loading granted access" /> : entitlements.isError ? <ReadOnlyQueryState error={entitlements.error} onRetry={() => void entitlements.refetch()} resource="Granted access" /> : entitlements.data?.length ? <ul className="pf-admin-record-list">{entitlements.data.map((item) => <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="pf-admin-record-list__icon"><KeyRound size={17} /></span><div><strong>{item.resourceTitle}</strong><p>{item.resourceType.replaceAll('_', ' ')} · {item.course?.name ?? 'Course unavailable'}</p><small>Granted {formatDate(item.grantedAt)} · {item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : 'No expiry'}</small></div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'danger'}>{item.status}</AdminStatusBadge>{item.status === 'ACTIVE' ? <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => { revokeAccess.reset(); setRevokeReason(''); setRevokeTarget({ id: item.id, title: item.resourceTitle }); }}>Revoke</button> : null}</div></li>)}</ul> : <AdminEmptyState compact icon={<KeyRound size={20} />} title="No granted access" description="No Academy-scoped resource has been manually granted to this student." />}
        </section>
        <aside className="pf-admin-detail-side">
          <section className="pf-admin-card pf-admin-student-governance">
            <h2>Account & device</h2>
            <button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={governanceBusy} onClick={async () => { setGovernanceBusy(true); try { await mutateAcademyStudentAccountStatus(student.studentId, student.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'); await query.refetch(); } finally { setGovernanceBusy(false); } }}>{student.accountStatus === 'ACTIVE' ? 'Disable account' : 'Enable account'}</button>
            <button className="pf-admin-button pf-admin-button--secondary" type="button" disabled={governanceBusy} onClick={() => setDeviceApprovalOpen(true)}>{governanceBusy ? 'Approving…' : 'Approve device change'}</button>
            <button className="pf-admin-button pf-admin-button--danger" type="button" disabled={governanceBusy} onClick={async () => {
              if (window.prompt('Type PERMANENTLY DELETE to confirm.') !== 'PERMANENTLY DELETE') return;
              setGovernanceBusy(true);
              try {
                await queryClient.cancelQueries({ queryKey: ['academy', activeAcademyId, 'students', 'detail', student.studentId] });
                await permanentlyDeleteAcademyStudent(student.studentId);
                queryClient.removeQueries({ queryKey: ['academy', activeAcademyId, 'students', 'detail', student.studentId] });
                navigate(ROUTES.ACADEMY_STUDENTS, { replace: true });
                await queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'students'] });
              } catch (error) {
                setToast({ id: Date.now(), tone: 'error', title: 'Student not deleted', message: error instanceof Error ? error.message : 'The server rejected the deletion.' });
              } finally { setGovernanceBusy(false); }
            }}>Permanently delete</button>
          </section>
          <section className="pf-admin-card"><h2>Membership record</h2><p className="pf-admin-muted-copy">Phone: {student.phone || 'Unavailable'}</p><p className="pf-admin-muted-copy">Joined: {formatDate(student.joinedAt)}</p><p className="pf-admin-muted-copy">Last login: {student.lastLoginAt ? formatDate(student.lastLoginAt) : 'Never'}</p></section>
          <section className="pf-admin-card"><h2>Enroll in course</h2><label className="pf-admin-field"><span>Active Academy course</span><AppSelect className="pf-admin-select" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course</option>{courses.data?.items.filter((course) => course.status === 'ACTIVE' && !student.enrollments.some((enrollment) => enrollment.courseId === course.id && enrollment.status === 'ACTIVE')).map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</AppSelect></label><button className="pf-admin-button pf-admin-button--primary" type="button" disabled={!courseId || enrollmentMutation.isPending || student.membershipStatus !== 'ACTIVE'} onClick={() => enrollmentMutation.mutate()}>{enrollmentMutation.isPending ? 'Enrolling…' : 'Enroll student'}</button></section>
        </aside>
      </div>
      <AdminDialog
        open={deviceApprovalOpen}
        onClose={() => { if (!governanceBusy) setDeviceApprovalOpen(false); }}
        title="Approve device change?"
        description={`Authorize one different replacement device for ${student.name}.`}
        icon={<div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}><ShieldCheck size={22} /></div>}
        size="small"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={governanceBusy} onClick={() => setDeviceApprovalOpen(false)}>Cancel</button><button className="pf-admin-button pf-admin-button--primary" type="button" disabled={governanceBusy} onClick={async () => {
          setGovernanceBusy(true);
          try {
            const result = await approveAcademyStudentDeviceReset(student.studentId);
            await query.refetch();
            setDeviceApprovalOpen(false);
            setToast({ id: Date.now(), tone: 'success', title: result.state === 'RESET_APPROVED' ? 'Device change approved' : 'Device ready to link', message: result.message });
          } catch (error) {
            setToast({ id: Date.now(), tone: 'error', title: 'Device change not approved', message: error instanceof Error ? error.message : 'The server rejected the approval.' });
          } finally { setGovernanceBusy(false); }
        }}>{governanceBusy ? 'Approving…' : 'Approve device change'}</button></>}
      >
        <div style={{ display: 'grid', gap: 12, color: '#475569', fontSize: 14, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>All current sessions will be revoked immediately.</p>
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #dbeafe', background: '#f8fbff' }}>
            <strong style={{ color: '#1e3a8a' }}>What happens next</strong>
            <p style={{ margin: '5px 0 0' }}>The learner must sign in from a different replacement device within 7 days. The currently linked device remains blocked and cannot consume this approval.</p>
          </div>
        </div>
      </AdminDialog>
      <AdminDialog open={Boolean(pendingStatus)} onClose={() => !statusMutation.isPending && setPendingStatus(null)} title={`${pendingStatus === 'ACTIVE' ? 'Activate' : pendingStatus === 'SUSPENDED' ? 'Suspend' : 'Revoke'} student membership?`} description={pendingStatus === 'REVOKED' ? 'This removes the student’s active access to this Academy. The action is audited.' : 'This changes Academy access immediately after backend confirmation.'} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={statusMutation.isPending} onClick={() => setPendingStatus(null)}>Cancel</button><button className={`pf-admin-button ${pendingStatus === 'REVOKED' ? 'pf-admin-button--danger' : 'pf-admin-button--primary'}`} type="button" disabled={statusMutation.isPending} onClick={() => pendingStatus && statusMutation.mutate(pendingStatus)}>{statusMutation.isPending ? 'Working…' : 'Confirm'}</button></>} />
      <GrantAccessDialog open={grantAccessOpen} userId={activeAcademyId} student={{ id: student.studentId, name: student.name, email: student.email }} scope="academy" onClose={() => setGrantAccessOpen(false)} onGranted={() => { void query.refetch(); void entitlements.refetch(); void queryClient.invalidateQueries({ queryKey: ['academy', activeAcademyId, 'students'] }); }} />
      <AdminDialog open={Boolean(revokeTarget)} onClose={() => !revokeAccess.isPending && setRevokeTarget(null)} title="Revoke Granted Access" description={`Revoke access to “${revokeTarget?.title ?? ''}” while retaining its audit history.`} size="small" footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled={revokeAccess.isPending} onClick={() => setRevokeTarget(null)}>Cancel</button><button className="pf-admin-button pf-admin-button--danger" type="button" disabled={revokeReason.trim().length < 3 || revokeAccess.isPending} onClick={() => revokeAccess.mutate()}>{revokeAccess.isPending ? 'Revoking…' : 'Revoke access'}</button></>}><label className="pf-admin-field"><span>Reason</span><input className="pf-admin-input" value={revokeReason} minLength={3} maxLength={500} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Mandatory audit note" /></label></AdminDialog>
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};
