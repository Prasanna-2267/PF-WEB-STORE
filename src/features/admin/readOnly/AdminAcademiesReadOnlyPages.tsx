import React, { type FormEvent, useState } from 'react';
import { BookOpen, Building2, Mail, Search, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { buildAdminAcademyPath, ROUTES } from '@/config/routes';
import { AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge } from '@/features/admin/AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import { type AdminAcademyStatus, useAdminAcademiesReadOnly, useAdminAcademyReadOnly } from './adminReadOnlyApi';
import '@/features/admin/academies/academies.css';

const PAGE_LIMIT = 25;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Unavailable';

export const AdminAcademiesReadOnlyPage: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminAcademyStatus | ''>('');
  const query = useAdminAcademiesReadOnly(userId, { page, limit: PAGE_LIMIT, search: search || undefined, status: status || undefined });
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  return <div className="pf-admin-page">
    <AdminPageHeader title="Academies" description="Academy records and server-owned aggregate fields. This phase is read-only." />
    <section className="pf-admin-table-card">
      <div className="pf-admin-table-card__header pf-admin-student-toolbar">
        <form className="pf-admin-search-field" onSubmit={submitSearch}><Search size={17} /><label className="pf-admin-sr-only" htmlFor="admin-academy-search">Search academies</label><input id="admin-academy-search" className="pf-admin-input" type="search" value={searchInput} placeholder="Search name, email, or slug" onChange={(event) => setSearchInput(event.target.value)} /></form>
        <label className="pf-admin-field"><span>Status</span><select className="pf-admin-select" value={status} onChange={(event) => { setStatus(event.target.value as AdminAcademyStatus | ''); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option></select></label>
        <div className="pf-admin-field"><span>Sort</span><button className="pf-admin-button pf-admin-button--quiet" type="button" disabled>Newest first</button></div>
      </div>
      {query.isPending ? <AdminSkeleton rows={8} variant="table" label="Loading academies" />
        : query.isError ? <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Academies" />
        : query.data.items.length === 0 ? <AdminEmptyState icon={<Building2 size={22} />} title="No academies found" description={search || status ? 'No server records match the current filters.' : 'The backend returned no Academy records.'} />
        : <><div className="pf-admin-table-scroll"><table className="pf-admin-table"><thead><tr><th>ACADEMY</th><th>STATUS</th><th>MEMBERSHIPS</th><th>COURSES</th><th>ADMIN</th><th>CREATED</th><th>DETAILS</th></tr></thead>
          <tbody>{query.data.items.map((academy) => <tr key={academy.id}><td><strong>{academy.name}</strong><small className="pf-course-table__description">{academy.slug} · {academy.email}</small></td><td><AdminStatusBadge tone={academy.status === 'ACTIVE' ? 'success' : academy.status === 'PENDING' ? 'warning' : 'danger'}>{academy.status}</AdminStatusBadge></td><td>{academy.membershipCount ?? 'Unavailable'}</td><td>{academy.tenantCourseCount ?? 'Unavailable'}</td><td>{academy.adminName}<small className="pf-course-table__description">{academy.adminEmail}</small></td><td>{formatDate(academy.createdAt)}</td><td><Link className="pf-admin-details-button" to={buildAdminAcademyPath(academy.id)}>View</Link></td></tr>)}</tbody>
        </table></div><ReadOnlyPagination page={query.data.pagination.page} totalPages={query.data.pagination.totalPages} total={query.data.pagination.total} onPageChange={setPage} /></>}
    </section>
  </div>;
};

export const AdminAcademyReadOnlyDetailPage: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { academyId } = useParams<{ academyId: string }>();
  const query = useAdminAcademyReadOnly(userId, academyId);
  if (query.isPending) return <AdminSkeleton rows={9} variant="detail" label="Loading Academy detail" />;
  if (query.isError) return <div className="pf-admin-page"><ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Academy" /></div>;
  const academy = query.data;
  const courses = academy.courses || academy.tenantCourses || [];
    return <div className="pf-admin-page">
    <AdminPageHeader title={academy.name} description={academy.description || 'Server-owned Academy identity and membership details.'} breadcrumbs={[{ label: 'Academies', to: ROUTES.ADMIN_ACADEMIES }, { label: academy.name }]} />
    <article className="pf-admin-card pf-admin-student-hero"><div className="pf-admin-student-hero__identity"><div className="pf-admin-student-hero__avatar"><span className="pf-admin-avatar"><Building2 size={22} /></span></div><div><p>ACADEMY</p><h2>{academy.name}</h2><span>{academy.slug} · {academy.email}</span></div></div><div className="pf-admin-student-hero__badges"><AdminStatusBadge tone={academy.status === 'ACTIVE' ? 'success' : academy.status === 'PENDING' ? 'warning' : 'danger'}>{academy.status}</AdminStatusBadge></div></article>
    <section className="pf-admin-card-grid" aria-label="Academy server metrics">
      <article className="pf-admin-card pf-admin-metric"><span className="pf-admin-metric__icon"><UsersRound size={20} /></span><div><p>Memberships returned</p><strong>{academy.memberships.length}</strong></div></article>
      <article className="pf-admin-card pf-admin-metric"><span className="pf-admin-metric__icon"><BookOpen size={20} /></span><div><p>Courses returned</p><strong>{courses.length}</strong></div></article>
      <article className="pf-admin-card pf-admin-metric"><span className="pf-admin-metric__icon"><Mail size={20} /></span><div><p>Invitations returned</p><strong>{academy.invitations.length}</strong></div></article>
    </section>
    <div className="pf-admin-detail-layout"><div className="pf-admin-detail-main">
      <section className="pf-admin-card"><header className="pf-admin-section__header"><div><h2>Memberships</h2><p>Up to 100 memberships returned by the detail endpoint.</p></div></header>{academy.memberships.length ? <ul className="pf-admin-record-list">{academy.memberships.map((membership) => <li key={membership.id}><span className="pf-admin-record-list__icon"><UsersRound size={17} /></span><div><strong>{membership.user.fullName || membership.user.email}</strong><p>{membership.user.email} · {membership.role}</p></div><AdminStatusBadge tone={membership.status === 'ACTIVE' ? 'success' : 'warning'}>{membership.status}</AdminStatusBadge></li>)}</ul> : <AdminEmptyState compact title="No memberships" description="The backend returned no memberships." />}</section>
      <section className="pf-admin-table-card"><header className="pf-admin-section__header"><div><h2>Courses</h2><p>Up to 100 active course records returned by the detail endpoint.</p></div></header>{courses.length ? <div className="pf-admin-table-scroll"><table className="pf-admin-table"><thead><tr><th>COURSE</th><th>CODE</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{courses.map((course: { id: string; name: string; code: string; status: string; createdAt: string }) => <tr key={course.id}><td>{course.name}</td><td>{course.code}</td><td><AdminStatusBadge tone={course.status === 'ACTIVE' ? 'success' : 'warning'}>{course.status}</AdminStatusBadge></td><td>{formatDate(course.createdAt)}</td></tr>)}</tbody></table></div> : <AdminEmptyState compact title="No courses" description="The backend returned no courses." />}</section>
    </div><aside className="pf-admin-detail-side"><section className="pf-admin-card"><h2>Contact</h2><p className="pf-admin-muted-copy">{academy.phone}</p><p className="pf-admin-muted-copy">{academy.address}, {academy.city}, {academy.state}, {academy.country} {academy.postalCode}</p></section><section className="pf-admin-card"><h2>Administrator</h2><p className="pf-admin-muted-copy">{academy.adminName}</p><p className="pf-admin-muted-copy">{academy.adminEmail}</p></section><section className="pf-admin-card"><h2>Read-only phase</h2><p className="pf-admin-muted-copy">Create, suspend, restore, edit, and invitation actions remain unavailable.</p></section></aside></div>
  </div>;
};
