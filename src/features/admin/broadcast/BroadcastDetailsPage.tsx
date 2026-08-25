import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBroadcastStore } from '@/app/store/useBroadcastStore';
import { useCourseStore } from '@/app/store/useCourseStore';
import { usePackageStore } from '@/app/store/usePackageStore';
import { useAcademyStore } from '@/app/store/useAcademyStore';
import { AdminPageHeader, AdminStatusBadge, type AdminStatusTone } from '../AdminUi';
import { ROUTES } from '@/config/routes';
import { ArrowLeft, Clock, MonitorSmartphone, Target, MousePointerClick, Eye, Users, FileText, BarChart3, Activity } from 'lucide-react';
import {
  BROADCAST_TYPE_LABELS,
  BROADCAST_PRIORITY_LABELS,
  BROADCAST_PLACEMENT_LABELS,
  BROADCAST_FREQUENCY_LABELS,
  BROADCAST_PRESENTATION_LABELS,
  type Broadcast,
} from './types/broadcast';
import './broadcast.css';

const formatDateTime = (value: string | null): string => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  : 'Not set';

const getStatusTone = (status: string): AdminStatusTone => {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SCHEDULED') return 'info';
  if (status === 'DRAFT') return 'warning';
  if (status === 'DISABLED') return 'danger';
  return 'neutral';
};

const MetricCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; trend?: string }> = ({ label, value, icon, trend }) => (
  <div className="pf-broadcast-metric-card">
    <div className="pf-broadcast-metric-header">
      <span>{label}</span>
      {icon}
    </div>
    <div className="pf-broadcast-metric-value">
      <strong>{value}</strong>
      {trend ? <small>{trend}</small> : null}
    </div>
  </div>
);

export default function BroadcastDetailsPage() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const store = useBroadcastStore();
  const courses = useCourseStore((state) => state.courses);
  const packages = usePackageStore((state) => state.packages);
  const academies = useAcademyStore((state) => state.academies);

  const broadcast = useMemo(() => store.broadcasts.find((b) => b.id === broadcastId), [store.broadcasts, broadcastId]);

  if (!broadcast) {
    return (
      <div className="pf-admin-page">
        <AdminPageHeader
          title="Broadcast not found"
          description="The requested broadcast does not exist or has been deleted."
          breadcrumbs={[
            { label: 'Broadcasts', to: ROUTES.ADMIN_BROADCAST },
            { label: 'Not Found' }
          ]}
        />
        <div className="pf-admin-content pf-admin-content--narrow">
          <Link to={ROUTES.ADMIN_BROADCAST} className="pf-admin-button pf-admin-button--secondary">
            <ArrowLeft size={16} /> Back to Broadcasts
          </Link>
        </div>
      </div>
    );
  }

  const audienceStr = (() => {
    const { audience } = broadcast;
    if (audience.kind === 'COURSES') return audience.courseIds.map((id) => courses.find((item) => item.id === id)?.name).filter(Boolean).join(', ') || 'No courses selected';
    if (audience.kind === 'PACKAGES') return audience.packageIds.map((id) => packages.find((item) => item.id === id)?.title).filter(Boolean).join(', ') || 'No packages selected';
    if (audience.kind === 'ACADEMIES' || audience.kind === 'ACADEMY_STUDENTS') {
      const names = audience.academyIds.map((id) => academies.find((item) => item.id === id)?.name).filter(Boolean).join(', ');
      return names || (audience.kind === 'ACADEMY_STUDENTS' ? 'All academy students' : 'No academies selected');
    }
    return audience.kind; // Fallback
  })();

  const { analytics, timeline } = broadcast;

  return (
    <div className="pf-admin-page">
      <AdminPageHeader
        title={broadcast.title}
        description={`${BROADCAST_TYPE_LABELS[broadcast.type]} · ${BROADCAST_PRIORITY_LABELS[broadcast.priority]} Priority`}
        breadcrumbs={[
          { label: 'Broadcasts', to: ROUTES.ADMIN_BROADCAST },
          { label: 'Details' }
        ]}
        actions={<AdminStatusBadge tone={getStatusTone(broadcast.status)}>{broadcast.status}</AdminStatusBadge>}
      />

      <div className="pf-admin-content">
        {broadcast.status !== 'DRAFT' && (
          <section className="pf-broadcast-details-section">
            <h2 className="pf-broadcast-details-heading"><BarChart3 size={18} /> Performance Analytics</h2>
            <div className="pf-broadcast-analytics-grid">
              <MetricCard label="Total Reached" value={analytics.reached.toLocaleString()} icon={<Users size={18} />} />
              <MetricCard label="Total Views" value={analytics.viewed.toLocaleString()} icon={<Eye size={18} />} />
              <MetricCard label="Unique Views" value={analytics.uniqueViews.toLocaleString()} icon={<Eye size={18} />} />
              {broadcast.cta.enabled && <MetricCard label="CTA Clicks" value={analytics.clicked.toLocaleString()} icon={<MousePointerClick size={18} />} />}
              {broadcast.cta.enabled && <MetricCard label="Click-Through Rate" value={`${analytics.ctr}%`} icon={<Activity size={18} />} trend="of total views" />}
              {broadcast.dismissible && <MetricCard label="Dismissed" value={analytics.dismissed.toLocaleString()} icon={<ArrowLeft size={18} />} />}
              {broadcast.acknowledgementRequired && <MetricCard label="Acknowledged" value={analytics.acknowledged.toLocaleString()} icon={<FileText size={18} />} />}
            </div>
          </section>
        )}

        <div className="pf-broadcast-details-layout">
          <div className="pf-broadcast-details-main">
            <section className="pf-broadcast-details-section">
              <h2 className="pf-broadcast-details-heading"><FileText size={18} /> Content</h2>
              <div className="pf-broadcast-details-card">
                {broadcast.image && (
                  <div className="pf-broadcast-details-image">
                    <img src={broadcast.image.dataUrl} alt="Broadcast Banner" />
                  </div>
                )}
                <div className="pf-broadcast-details-content-body">
                  <h3>{broadcast.title}</h3>
                  {broadcast.subtitle && <h4>{broadcast.subtitle}</h4>}
                  <p>{broadcast.message}</p>
                  {broadcast.cta.enabled && (
                    <div className="pf-broadcast-details-cta-preview">
                      <span>Action: <strong>{broadcast.cta.action}</strong></span>
                      <button className="pf-admin-button pf-admin-button--primary" disabled>
                        {broadcast.cta.text}
                      </button>
                      <small>Destination: {broadcast.cta.destination}</small>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="pf-broadcast-details-grid-2">
              <section className="pf-broadcast-details-section">
                <h2 className="pf-broadcast-details-heading"><Target size={18} /> Audience & Display</h2>
                <div className="pf-broadcast-details-card pf-broadcast-details-list">
                  <dl>
                    <dt>Target Audience</dt><dd>{audienceStr}</dd>
                    <dt>Platform</dt><dd>{broadcast.platform}</dd>
                    <dt>Placements</dt><dd>{broadcast.placements.map(p => BROADCAST_PLACEMENT_LABELS[p]).join(', ')}</dd>
                    <dt>Presentation</dt><dd>{BROADCAST_PRESENTATION_LABELS[broadcast.presentation]}</dd>
                    <dt>Display Order</dt><dd>{broadcast.displayOrder === 'CUSTOM' ? `Custom Weight (${broadcast.customOrderWeight})` : broadcast.displayOrder}</dd>
                    <dt>What's New Feed</dt><dd>{broadcast.showInWhatsNew ? 'Included' : 'Excluded'}</dd>
                  </dl>
                </div>
              </section>

              <section className="pf-broadcast-details-section">
                <h2 className="pf-broadcast-details-heading"><Clock size={18} /> Delivery & Behavior</h2>
                <div className="pf-broadcast-details-card pf-broadcast-details-list">
                  <dl>
                    <dt>Start Time (IST)</dt><dd>{formatDateTime(broadcast.startAt)}</dd>
                    <dt>End Time (IST)</dt><dd>{formatDateTime(broadcast.endAt)}</dd>
                    <dt>Frequency</dt><dd>{BROADCAST_FREQUENCY_LABELS[broadcast.frequency]}</dd>
                    <dt>Dismissible</dt><dd>{broadcast.dismissible ? 'Yes' : 'No'}</dd>
                    <dt>Acknowledgement</dt><dd>{broadcast.acknowledgementRequired ? 'Required' : 'Not required'}</dd>
                    <dt>Repeat Behavior</dt><dd>{broadcast.repeatBehavior}</dd>
                  </dl>
                </div>
              </section>
            </div>
          </div>

          <aside className="pf-broadcast-details-sidebar">
            <section className="pf-broadcast-details-section">
              <h2 className="pf-broadcast-details-heading"><Activity size={18} /> Activity Timeline</h2>
              <div className="pf-broadcast-timeline">
                {timeline.map((event, index) => (
                  <div key={index} className="pf-broadcast-timeline-event">
                    <div className="pf-broadcast-timeline-marker" />
                    <div className="pf-broadcast-timeline-content">
                      <div className="pf-broadcast-timeline-header">
                        <strong>{event.action}</strong>
                        <time>{formatDateTime(event.timestamp)}</time>
                      </div>
                      <p>{event.description}</p>
                      <small>by {event.actor.name} ({event.actor.role})</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
