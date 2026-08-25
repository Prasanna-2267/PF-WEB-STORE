import React, { useEffect } from 'react';
import { Activity, BadgeHelp, BookMarked, BookOpenCheck, LibraryBig, Megaphone, UserCheck, UsersRound } from 'lucide-react';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { useLiveAcademyOverviewQuery } from './api/useLiveAcademyOverviewQuery';
import { AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge } from '@/features/admin/AdminUi';
import '@/features/admin/admin-pages.css';

export const LiveAcademyOverviewPage: React.FC = () => {
  const { activeAcademyId, activeAcademy, updateFromOverview } = useAcademyTenantStore();
  const { data, loading, error } = useLiveAcademyOverviewQuery(activeAcademyId);
  useEffect(() => { if (data) updateFromOverview(data); }, [data, updateFromOverview]);
  if (loading) return <AdminSkeleton label="Loading overview" rows={8} variant="detail" />;
  if (error || !data) return <AdminEmptyState title="Overview unavailable" description={error instanceof Error ? error.message : 'The Academy overview could not be loaded.'} />;
  const cards = [
    ['Total Students', data.metrics.studentCount, 'Enrolled learners', UsersRound],
    ['Active Students', data.metrics.activeStudentCount, 'Active memberships', UserCheck],
    ['Total Courses', data.metrics.courseCount, 'Academic programs', BookMarked],
    ['Published Courses', data.metrics.activeCourseCount, 'Available to learners', BookOpenCheck],
    ['Total Content', data.metrics.contentCount, 'Academic materials', LibraryBig],
    ['Total Questions', data.metrics.questionCount, 'Question bank items', BadgeHelp],
    ['Active Broadcasts', data.metrics.activeBroadcastCount, 'Current announcements', Megaphone],
  ] as const;
  return (
    <div className="pf-admin-page">
      <AdminPageHeader title="Overview" description={`Everything happening across ${activeAcademy?.name || data.academy.name} at a glance.`} />
      <section className="pf-admin-card-grid" aria-label="Academy metrics">
        {cards.map(([label, value, helper, Icon]) => <article className="pf-admin-card pf-admin-metric" key={label}><span className="pf-admin-metric__icon"><Icon size={20} /></span><div><p>{label}</p><strong>{value.toLocaleString('en-IN')}</strong></div><footer><span className="pf-admin-metric__change">Live</span><span>{helper}</span></footer></article>)}
      </section>
      <section className="pf-admin-table-card">
        <header className="pf-admin-section__header" style={{ padding: '20px 24px' }}><div><h2>Recent Activity</h2><p>Server-recorded Academy activity.</p></div></header>
        {data.recentActivity.length ? <div className="pf-admin-table-scroll"><table className="pf-admin-table"><thead><tr><th>ACTION</th><th>ENTITY</th><th>TIME</th></tr></thead><tbody>{data.recentActivity.slice(0, 5).map((item) => <tr key={item.id}><td><Activity size={16} /> {item.action}</td><td><AdminStatusBadge tone="neutral">{item.entityType}</AdminStatusBadge></td><td>{new Intl.DateTimeFormat('en-IN').format(new Date(item.timestamp))}</td></tr>)}</tbody></table></div> : <AdminEmptyState compact title="No recent activity" description="Server-recorded Academy activity will appear here." />}
      </section>
    </div>
  );
};

export default LiveAcademyOverviewPage;
