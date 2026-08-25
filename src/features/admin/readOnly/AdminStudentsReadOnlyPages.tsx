import React, { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Gift, Info, KeyRound, Lock, MonitorSmartphone, Search, ShieldCheck, ShieldX, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { buildAdminStudentPath, ROUTES } from '@/config/routes';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge } from '@/features/admin/AdminUi';
import { CourseFilterDropdown } from '@/features/admin/CourseFilterDropdown';
import { courseRepository } from '@/features/admin/courses/courseRepository';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { getReadOnlyErrorCopy, ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import { ApiError } from '@/lib/api/client';
import {
  type AdminAccountStatus,
  type EntitlementResourceType,
  useAdminEntitlements,
  useAdminEntitlementResources,
  useAdminStudentReadOnly,
  useAdminStudentsReadOnly,
  useGrantEntitlement,
  useRevokeAdminStudentSessions,
  useRevokeEntitlement,
  useUpdateAdminStudentStatus,
} from './adminReadOnlyApi';
import '@/features/admin/admin-pages.css';

const PAGE_LIMIT = 25;
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Never';
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const MutationErrorNotice: React.FC<{ error: unknown; action: string }> = ({ error, action }) => {
  if (!error) return null;
  const copy = getReadOnlyErrorCopy(error, action);
  const fieldDetails = error instanceof ApiError && error.fieldErrors
    ? Object.entries(error.fieldErrors).flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
    : [];
  return (
    <div className="pf-admin-mutation-error" role="alert">
      <strong>{copy.title}</strong>
      <span>{copy.description}</span>
      {fieldDetails.length ? <ul>{fieldDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
    </div>
  );
};

export const AdminStudentsReadOnlyPage: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminAccountStatus | ''>('');
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'list'],
    queryFn: () => courseRepository.list(),
  });

  const query = useAdminStudentsReadOnly(userId, {
    page,
    limit: PAGE_LIMIT,
    search: search || undefined,
    status: status || undefined,
    courseId: selectedCourseId !== 'ALL' ? selectedCourseId : undefined,
  });
  const updateStatusMutation = useUpdateAdminStudentStatus(userId);

  const [statusTarget, setStatusTarget] = useState<{ id: string; name: string; currentStatus: AdminAccountStatus } | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    setPage(1);
    setSearch(val.trim());
  };

  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };

  const confirmToggleStatus = async () => {
    if (!statusTarget) return;
    try {
      const nextStatus = statusTarget.currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await updateStatusMutation.mutateAsync({ targetUserId: statusTarget.id, status: nextStatus });
      setStatusTarget(null);
    } catch {
      // The mutation owns the backend error and keeps this confirmation open.
    }
  };

  return (
    <div className="pf-admin-page">
      <AdminPageHeader
        title="Students"
        description="Direct Parallax Flow student accounts. Academy students are available from their Academy details page."
        actions={(
          <CourseFilterDropdown
            courses={coursesQuery.data ?? []}
            selectedCourseId={selectedCourseId}
            onSelectCourse={(id) => {
              setSelectedCourseId(id);
              setPage(1);
            }}
          />
        )}
      />
      <section className="pf-admin-table-card">
        <div className="pf-admin-table-card__header pf-admin-student-toolbar">
          <form className="pf-admin-search-field" onSubmit={submitSearch}>
            <Search size={17} aria-hidden="true" />
            <label className="pf-admin-sr-only" htmlFor="admin-student-search">Search students</label>
            <input
              id="admin-student-search"
              className="pf-admin-input"
              type="search"
              value={searchInput}
              placeholder="Search by name, email, phone, or join date..."
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </form>

          <label className="pf-admin-field">
            <span>Account status</span>
            <select className="pf-admin-select" value={status} onChange={(event) => { setStatus(event.target.value as AdminAccountStatus | ''); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </label>
          <div className="pf-admin-field">
            <span>Platform role</span>
            <button className="pf-admin-button pf-admin-button--quiet" type="button" disabled>Student</button>
          </div>
        </div>

        {query.isPending ? <AdminSkeleton rows={8} variant="table" label="Loading Super Admin students" />
          : query.isError ? <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Super Admin students" />
          : query.data.items.length === 0 ? <AdminEmptyState icon={<UsersRound size={22} />} title="No students found" description={search || status ? 'No server records match the current filters.' : 'The backend returned no Student accounts.'} />
          : <>
            <div className="pf-admin-table-scroll" data-lenis-prevent>
              <table className="pf-admin-table pf-admin-students-table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>ROLE</th>
                    <th>STATUS</th>
                    <th>JOINED</th>
                    <th>LAST LOGIN</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <Link className="pf-admin-person-link" to={buildAdminStudentPath(student.id)}>
                          <span className="pf-admin-person">
                            <span className="pf-admin-avatar" aria-hidden="true">{initials(student.name)}</span>
                            <span>
                              <strong>{student.name}</strong>
                              <small>{student.email}</small>
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td><AdminStatusBadge tone="neutral">{student.roleName}</AdminStatusBadge></td>
                      <td>
                        <button
                          type="button"
                          className="pf-admin-button pf-admin-button--quiet"
                          onClick={() => { updateStatusMutation.reset(); setStatusTarget({ id: student.id, name: student.name, currentStatus: student.status }); }}
                          title="Click to toggle account status"
                          style={{ padding: 0, border: 'none', background: 'none' }}
                        >
                          <AdminStatusBadge tone={student.status === 'ACTIVE' ? 'success' : 'danger'}>{student.status}</AdminStatusBadge>
                        </button>
                      </td>
                      <td>{formatDate(student.createdAt)}</td>
                      <td>{formatDate(student.lastLoginAt)}</td>
                      <td>
                        <Link className="pf-admin-details-button" to={buildAdminStudentPath(student.id)}>Manage</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ReadOnlyPagination page={query.data.pagination.page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} onPageChange={setPage} />
          </>}
      </section>

      {statusTarget ? (
        <AdminDialog
          open={Boolean(statusTarget)}
          onClose={() => { if (!updateStatusMutation.isPending) setStatusTarget(null); }}
          title={`${statusTarget.currentStatus === 'ACTIVE' ? 'Disable' : 'Enable'} Student Account`}
          icon={
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fff7ed',
              border: '1px solid #ffedd5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c',
              flexShrink: 0,
            }}>
              <AlertTriangle size={22} />
            </div>
          }
          size="small"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                className="pf-admin-button pf-admin-button--secondary"
                type="button"
                onClick={() => setStatusTarget(null)}
                disabled={updateStatusMutation.isPending}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: '8px 18px',
                }}
              >
                Cancel
              </button>
              <button
                className={`pf-admin-button ${statusTarget.currentStatus === 'ACTIVE' ? 'pf-admin-button--danger' : 'pf-admin-button--primary'}`}
                type="button"
                onClick={() => void confirmToggleStatus()}
                disabled={updateStatusMutation.isPending}
                style={{
                  background: statusTarget.currentStatus === 'ACTIVE' ? '#dc2626' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {updateStatusMutation.isPending ? (
                  'Updating…'
                ) : statusTarget.currentStatus === 'ACTIVE' ? (
                  <>
                    <Lock size={15} /> Disable Account
                  </>
                ) : (
                  'Enable Account'
                )}
              </button>
            </div>
          }
        >
          <div style={{ padding: '4px 0 6px' }}>
            <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to change the status of <strong>{statusTarget.name}</strong> to{' '}
              <strong style={{ color: statusTarget.currentStatus === 'ACTIVE' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                {statusTarget.currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'}
              </strong>?
            </p>
            {statusTarget.currentStatus === 'ACTIVE' ? (
              <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                marginTop: 16,
                padding: '12px 14px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 10,
                fontSize: 13,
                color: '#9a3412',
                lineHeight: 1.45,
              }}>
                <Info size={17} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
                <span>Disabling this account restricts the student from logging in or accessing course materials.</span>
              </div>
            ) : null}
            <MutationErrorNotice error={updateStatusMutation.error} action="Student account update" />
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
};

export const AdminStudentReadOnlyDetailPage: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { studentId = '' } = useParams<{ studentId: string }>();

  const query = useAdminStudentReadOnly(userId, studentId);
  const entitlementsQuery = useAdminEntitlements(userId, studentId);

  const updateStatusMutation = useUpdateAdminStudentStatus(userId);
  const revokeSessionsMutation = useRevokeAdminStudentSessions(userId);
  const grantEntitlementMutation = useGrantEntitlement(userId);
  const revokeEntitlementMutation = useRevokeEntitlement(userId, studentId);

  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [grantResourceType, setGrantResourceType] = useState<EntitlementResourceType>('COURSE');
  const [grantResourceId, setGrantResourceId] = useState('');
  const [grantAccessType, setGrantAccessType] = useState<'PERMANENT' | 'TIME_LIMITED'>('PERMANENT');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantReason, setGrantReason] = useState('');

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [revokeSessionsOpen, setRevokeSessionsOpen] = useState(false);
  const [revokeEntitlementTarget, setRevokeEntitlementTarget] = useState<{ id: string; title: string } | null>(null);
  const [revokeEntitlementReason, setRevokeEntitlementReason] = useState('');
  const resourceOptionsQuery = useAdminEntitlementResources(userId, grantResourceType, isGrantOpen);

  if (query.isPending) return <AdminSkeleton rows={8} variant="detail" label="Loading Super Admin student" />;
  if (query.isError) return <div className="pf-admin-page"><ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Super Admin student" /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ADMIN_STUDENTS}><ArrowLeft size={16} /> Back to Students</Link></div></div>;

  const student = query.data;

  const confirmToggleStatus = async () => {
    try {
      const nextStatus = student.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await updateStatusMutation.mutateAsync({ targetUserId: student.id, status: nextStatus });
      setIsStatusModalOpen(false);
      await query.refetch();
    } catch (err) {
      // The mutation owns the backend error and keeps this confirmation open.
    }
  };

  const handleRevokeSessions = async () => {
    try {
      await revokeSessionsMutation.mutateAsync(student.id);
      setRevokeSessionsOpen(false);
    } catch {
      // The mutation owns the backend error and keeps this confirmation open.
    }
  };

  const handleGrantSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedResource = resourceOptionsQuery.data?.find((resource) => resource.id === grantResourceId);
    if (!selectedResource || !grantReason.trim()) return;
    const resourceReference = grantResourceType === 'COURSE'
      ? { courseId: selectedResource.id }
      : grantResourceType === 'PACKAGE'
        ? { packageId: selectedResource.id }
        : grantResourceType === 'SUBJECT'
          ? { subjectId: selectedResource.id }
          : { contentItemId: selectedResource.id };
    try {
      await grantEntitlementMutation.mutateAsync({
        userId: student.id,
        resourceType: grantResourceType,
        resourceTitle: selectedResource.title,
        ...resourceReference,
        accessType: grantAccessType,
        expiresAt: grantAccessType === 'TIME_LIMITED' && grantExpiresAt ? new Date(`${grantExpiresAt}T23:59:59.999`).toISOString() : undefined,
        reason: grantReason.trim(),
      });
      setIsGrantOpen(false);
      setGrantResourceId('');
      setGrantReason('');
    } catch {
      // The mutation owns the backend error and keeps this form open.
    }
  };

  const handleRevokeEntitlementSubmit = async () => {
    if (!revokeEntitlementTarget || !revokeEntitlementReason.trim()) return;
    try {
      await revokeEntitlementMutation.mutateAsync({
        entitlementId: revokeEntitlementTarget.id,
        reason: revokeEntitlementReason.trim(),
      });
      setRevokeEntitlementTarget(null);
      setRevokeEntitlementReason('');
    } catch {
      // The mutation owns the backend error and keeps this confirmation open.
    }
  };

  return (
    <div className="pf-admin-page">
      <AdminPageHeader
        title={student.name}
        description={student.email}
        breadcrumbs={[{ label: 'Students', to: ROUTES.ADMIN_STUDENTS }, { label: student.name }]}
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="pf-admin-button"
              onClick={() => { grantEntitlementMutation.reset(); setGrantResourceId(''); setIsGrantOpen(true); }}
            >
              <Gift size={16} aria-hidden="true" /> Grant Access
            </button>
            <Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ADMIN_STUDENTS}>
              <ArrowLeft size={16} aria-hidden="true" /> Back to Students
            </Link>
          </div>
        }
      />

      <article className="pf-admin-card pf-admin-student-hero">
        <div className="pf-admin-student-hero__identity">
          <div className="pf-admin-student-hero__avatar">
            <span className="pf-admin-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>{initials(student.name)}</span>
          </div>
          <div>
            <p className="pf-admin-sr-only">PLATFORM ACCOUNT</p>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>{student.name}</h2>
            <span style={{ color: '#64748b', fontSize: 14 }}>{student.email}</span>
          </div>
        </div>
        <div className="pf-admin-student-hero__badges" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <AdminStatusBadge tone="neutral">{student.roleName}</AdminStatusBadge>
          <AdminStatusBadge tone={student.status === 'ACTIVE' ? 'success' : 'danger'}>{student.status}</AdminStatusBadge>
          <button
            type="button"
            className={`pf-admin-button ${student.status === 'ACTIVE' ? 'pf-admin-button--secondary' : 'pf-admin-button--primary'}`}
            style={{ fontSize: 12, padding: '4px 12px' }}
            onClick={() => { updateStatusMutation.reset(); setIsStatusModalOpen(true); }}
            disabled={updateStatusMutation.isPending}
          >
            {student.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
          </button>
        </div>
      </article>


      <div className="pf-admin-detail-layout" style={{ marginTop: 24 }}>
        <div className="pf-admin-detail-main">
          {/* Entitlements & Granted Access Section */}
          <section className="pf-admin-card">
            <header className="pf-admin-section__header">
              <div>
                <h2>Platform Entitlements & Granted Access</h2>
                <p>Backend-authoritative resource access granted to this student.</p>
              </div>
              <button
                type="button"
                className="pf-admin-button pf-admin-button--secondary"
                style={{ fontSize: 13 }}
                onClick={() => { grantEntitlementMutation.reset(); setGrantResourceId(''); setIsGrantOpen(true); }}
              >
                <Gift size={15} /> Grant Resource
              </button>
            </header>

            {entitlementsQuery.isPending ? (
              <AdminSkeleton rows={4} variant="detail" label="Loading entitlements" />
            ) : entitlementsQuery.isError ? (
              <ReadOnlyQueryState error={entitlementsQuery.error} onRetry={() => void entitlementsQuery.refetch()} resource="Entitlements" />
            ) : !entitlementsQuery.data || entitlementsQuery.data.length === 0 ? (
              <AdminEmptyState compact icon={<KeyRound size={20} />} title="No granted entitlements" description="No platform resources have been explicitly granted to this student." />
            ) : (
              <ul className="pf-admin-record-list">
                {entitlementsQuery.data.map((entitlement) => (
                  <li key={entitlement.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="pf-admin-record-list__icon" aria-hidden="true"><KeyRound size={17} /></span>
                      <div>
                        <strong>{entitlement.resourceTitle}</strong>
                        <p>{entitlement.resourceType} · {entitlement.accessType}{entitlement.expiresAt ? ` · Expires ${formatDate(entitlement.expiresAt)}` : ''}</p>
                        <small style={{ color: '#94a3b8' }}>Granted {formatDate(entitlement.grantedAt)}</small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <AdminStatusBadge tone={entitlement.status === 'ACTIVE' ? 'success' : entitlement.status === 'EXPIRED' ? 'warning' : 'danger'}>
                        {entitlement.status}
                      </AdminStatusBadge>
                      {entitlement.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="pf-admin-button pf-admin-button--quiet"
                          style={{ color: '#ef4444', fontSize: 12 }}
                          onClick={() => { revokeEntitlementMutation.reset(); setRevokeEntitlementReason(''); setRevokeEntitlementTarget({ id: entitlement.id, title: entitlement.resourceTitle }); }}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Academy Memberships Section */}
          <section className="pf-admin-card" style={{ marginTop: 20 }}>
            <header className="pf-admin-section__header">
              <div>
                <h2>Academy memberships</h2>
                <p>Academy tenant relationships for this student.</p>
              </div>
            </header>
            {student.memberships.length ? (
              <ul className="pf-admin-record-list">
                {student.memberships.map((membership) => (
                  <li key={membership.id}>
                    <span className="pf-admin-record-list__icon" aria-hidden="true"><Building2 size={17} /></span>
                    <div>
                      <strong>{membership.academyName}</strong>
                      <p>{membership.role} · {membership.academySlug}</p>
                    </div>
                    <AdminStatusBadge tone={membership.status === 'ACTIVE' ? 'success' : 'warning'}>{membership.status}</AdminStatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminEmptyState compact icon={<Building2 size={20} />} title="No memberships" description="The student does not belong to any academies yet." />
            )}
          </section>

          {/* Sessions Section */}
          <section className="pf-admin-card" style={{ marginTop: 20 }}>
            <header className="pf-admin-section__header">
              <div>
                <h2>Application sessions</h2>
                <p>Active and recent device sessions returned by the backend.</p>
              </div>
              {student.sessions.some((s) => !s.revokedAt) ? (
                <button
                  type="button"
                  className="pf-admin-button pf-admin-button--secondary"
                  style={{ color: '#dc2626', fontSize: 13 }}
                  onClick={() => { revokeSessionsMutation.reset(); setRevokeSessionsOpen(true); }}
                  disabled={revokeSessionsMutation.isPending}
                >
                  Revoke All Sessions
                </button>
              ) : null}
            </header>
            {student.sessions.length ? (
              <ul className="pf-admin-session-list">
                {student.sessions.map((session) => (
                  <li key={session.id}>
                    <span aria-hidden="true"><MonitorSmartphone size={17} /></span>
                    <div>
                      <strong>{session.deviceName || 'Unknown device'}</strong>
                      <p>{session.platform} · Last seen {formatDate(session.lastSeenAt)}</p>
                    </div>
                    <AdminStatusBadge tone={session.revokedAt ? 'danger' : 'success'}>{session.revokedAt ? 'REVOKED' : 'ACTIVE'}</AdminStatusBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <AdminEmptyState compact icon={<MonitorSmartphone size={20} />} title="No active sessions" description="The backend returned no application sessions." />
            )}
          </section>
        </div>

        <aside className="pf-admin-detail-side">
          <section className="pf-admin-card">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Account record</h2>
            <p className="pf-admin-muted-copy" style={{ margin: '6px 0', fontSize: 14 }}>Phone: <strong>{student.phone || 'Unavailable'}</strong></p>
            <p className="pf-admin-muted-copy" style={{ margin: '6px 0', fontSize: 14 }}>Created: <strong>{formatDate(student.createdAt)}</strong></p>
            <p className="pf-admin-muted-copy" style={{ margin: '6px 0', fontSize: 14 }}>Last login: <strong>{formatDate(student.lastLoginAt)}</strong></p>
          </section>

          <section className="pf-admin-card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Platform Permissions</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {student.permissions.slice(0, 10).map((perm) => (
                <span key={perm} style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569' }}>{perm}</span>
              ))}
              {student.permissions.length === 0 ? <p className="pf-admin-muted-copy" style={{ margin: 0 }}>No platform permissions are assigned to this role.</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {/* Grant Entitlement Modal */}
      {isGrantOpen ? (
        <AdminDialog
          open={isGrantOpen}
          onClose={() => { if (!grantEntitlementMutation.isPending) setIsGrantOpen(false); }}
          title="Grant Resource Access"
          description={`Assign platform entitlement directly to ${student.name}.`}
          icon={
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1d4ed8',
              flexShrink: 0,
            }}>
              <Gift size={22} />
            </div>
          }
          size="small"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                className="pf-admin-button pf-admin-button--secondary"
                type="button"
                onClick={() => setIsGrantOpen(false)}
                disabled={grantEntitlementMutation.isPending}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: '8px 18px',
                }}
              >
                Cancel
              </button>
              <button
                className="pf-admin-button pf-admin-button--primary"
                type="submit"
                form="grant-entitlement-form"
                disabled={grantEntitlementMutation.isPending || resourceOptionsQuery.isPending || !grantResourceId || !grantReason.trim() || (grantAccessType === 'TIME_LIMITED' && !grantExpiresAt)}
                style={{
                  background: '#1d4ed8',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {grantEntitlementMutation.isPending ? (
                  'Granting…'
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Grant Entitlement
                  </>
                )}
              </button>
            </div>
          }
        >
          <form id="grant-entitlement-form" onSubmit={(e) => void handleGrantSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 6px' }}>
            <label className="pf-admin-field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Resource Type</span>
              <select className="pf-admin-select" value={grantResourceType} onChange={(e) => { setGrantResourceType(e.target.value as EntitlementResourceType); setGrantResourceId(''); grantEntitlementMutation.reset(); }} style={{ height: 38, borderRadius: 6, fontSize: 13, background: '#ffffff' }}>
                <option value="COURSE">Course</option>
                <option value="LESSON">Lesson</option>
                <option value="PREMIUM_NOTES">Premium Notes</option>
                <option value="PACKAGE">Package</option>
                <option value="SUBJECT">Subject</option>
                <option value="OTHER">Other Resource</option>
              </select>
            </label>

            <label className="pf-admin-field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Resource</span>
              <select className="pf-admin-select" required value={grantResourceId} onChange={(e) => setGrantResourceId(e.target.value)} disabled={resourceOptionsQuery.isPending || resourceOptionsQuery.isError} style={{ height: 38, borderRadius: 6, fontSize: 13, background: '#ffffff' }}>
                <option value="">{resourceOptionsQuery.isPending ? 'Loading resources…' : 'Select a real backend resource'}</option>
                {resourceOptionsQuery.data?.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} — {resource.subtitle}</option>)}
              </select>
            </label>
            {resourceOptionsQuery.isError ? <ReadOnlyQueryState error={resourceOptionsQuery.error} onRetry={() => void resourceOptionsQuery.refetch()} resource="Entitlement resources" /> : null}
            {resourceOptionsQuery.isSuccess && resourceOptionsQuery.data.length === 0 ? <p className="pf-admin-muted-copy" style={{ fontSize: 12, margin: '-6px 0 0' }}>No active resources of this type are available to grant.</p> : null}

            <label className="pf-admin-field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Access Type</span>
              <select className="pf-admin-select" value={grantAccessType} onChange={(e) => setGrantAccessType(e.target.value as 'PERMANENT' | 'TIME_LIMITED')} style={{ height: 38, borderRadius: 6, fontSize: 13, background: '#ffffff' }}>
                <option value="PERMANENT">Permanent</option>
                <option value="TIME_LIMITED">Time Limited</option>
              </select>
            </label>

            {grantAccessType === 'TIME_LIMITED' ? (
              <label className="pf-admin-field" style={{ margin: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Expiration Date</span>
                <input className="pf-admin-input" type="date" required min={new Date().toISOString().slice(0, 10)} value={grantExpiresAt} onChange={(e) => setGrantExpiresAt(e.target.value)} style={{ height: 38, borderRadius: 6, fontSize: 13, background: '#ffffff' }} />
              </label>
            ) : null}

            <label className="pf-admin-field" style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>Grant Reason (Mandatory Audit Note)</span>
              <input className="pf-admin-input" type="text" required minLength={3} placeholder="Reason for manual access grant" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} style={{ height: 38, borderRadius: 6, fontSize: 13, background: '#ffffff' }} />
            </label>
            <MutationErrorNotice error={grantEntitlementMutation.error} action="Entitlement grant" />
          </form>
        </AdminDialog>
      ) : null}

      {/* Revoke Sessions Modal */}
      {revokeSessionsOpen ? (
        <AdminDialog
          open={revokeSessionsOpen}
          onClose={() => { if (!revokeSessionsMutation.isPending) setRevokeSessionsOpen(false); }}
          title="Revoke All Student Sessions"
          description={`Are you sure you want to revoke all active login sessions for ${student.name}? The student will be forced to log in again.`}
          size="small"
          footer={
            <>
              <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setRevokeSessionsOpen(false)} disabled={revokeSessionsMutation.isPending}>
                Cancel
              </button>
              <button
                className="pf-admin-button pf-admin-button--danger"
                type="button"
                onClick={() => void handleRevokeSessions()}
                disabled={revokeSessionsMutation.isPending}
              >
                {revokeSessionsMutation.isPending ? 'Revoking…' : 'Revoke Sessions'}
              </button>
            </>
          }
        >
          <div style={{ margin: '8px 0', fontSize: 14, color: '#475569' }}>
            <p>This invalidates all active refresh tokens and active sessions for this student account.</p>
            <MutationErrorNotice error={revokeSessionsMutation.error} action="Session revocation" />
          </div>
        </AdminDialog>
      ) : null}

      {/* Revoke Entitlement Modal */}
      {revokeEntitlementTarget ? (
        <AdminDialog
          open={Boolean(revokeEntitlementTarget)}
          onClose={() => { if (!revokeEntitlementMutation.isPending) setRevokeEntitlementTarget(null); }}
          title="Revoke Granted Entitlement"
          description={`Revoke access to "${revokeEntitlementTarget.title}" for ${student.name}.`}
          size="small"
          footer={
            <>
              <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setRevokeEntitlementTarget(null)} disabled={revokeEntitlementMutation.isPending}>
                Cancel
              </button>
              <button
                className="pf-admin-button pf-admin-button--danger"
                type="button"
                onClick={() => void handleRevokeEntitlementSubmit()}
                disabled={revokeEntitlementMutation.isPending || !revokeEntitlementReason.trim()}
              >
                {revokeEntitlementMutation.isPending ? 'Revoking…' : 'Revoke Access'}
              </button>
            </>
          }
        >
          <div style={{ marginTop: 12 }}>
            <label className="pf-admin-field">
              <span>Reason for Revocation</span>
              <input className="pf-admin-input" type="text" required minLength={3} placeholder="Mandatory audit note" value={revokeEntitlementReason} onChange={(e) => setRevokeEntitlementReason(e.target.value)} />
            </label>
            <MutationErrorNotice error={revokeEntitlementMutation.error} action="Entitlement revocation" />
          </div>
        </AdminDialog>
      ) : null}

      {/* Account Status Modal */}
      {isStatusModalOpen ? (
        <AdminDialog
          open={isStatusModalOpen}
          onClose={() => { if (!updateStatusMutation.isPending) setIsStatusModalOpen(false); }}
          title={`${student.status === 'ACTIVE' ? 'Disable' : 'Enable'} Student Account`}
          icon={
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fff7ed',
              border: '1px solid #ffedd5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ea580c',
              flexShrink: 0,
            }}>
              <AlertTriangle size={22} />
            </div>
          }
          size="small"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button
                className="pf-admin-button pf-admin-button--secondary"
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={updateStatusMutation.isPending}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: '8px 18px',
                }}
              >
                Cancel
              </button>
              <button
                className={`pf-admin-button ${student.status === 'ACTIVE' ? 'pf-admin-button--danger' : 'pf-admin-button--primary'}`}
                type="button"
                onClick={() => void confirmToggleStatus()}
                disabled={updateStatusMutation.isPending}
                style={{
                  background: student.status === 'ACTIVE' ? '#dc2626' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '8px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {updateStatusMutation.isPending ? (
                  'Updating…'
                ) : student.status === 'ACTIVE' ? (
                  <>
                    <Lock size={15} /> Disable Account
                  </>
                ) : (
                  'Enable Account'
                )}
              </button>
            </div>
          }
        >
          <div style={{ padding: '4px 0 6px' }}>
            <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to change the status of <strong>{student.name}</strong> to{' '}
              <strong style={{ color: student.status === 'ACTIVE' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                {student.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'}
              </strong>?
            </p>
            {student.status === 'ACTIVE' ? (
              <div style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                marginTop: 16,
                padding: '12px 14px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 10,
                fontSize: 13,
                color: '#9a3412',
                lineHeight: 1.45,
              }}>
                <Info size={17} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
                <span>Disabling this account restricts the student from logging in or accessing course materials.</span>
              </div>
            ) : null}
            <MutationErrorNotice error={updateStatusMutation.error} action="Student account update" />
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
};

