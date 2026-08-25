import {
  type FormEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileQuestion,
  Gift,
  GraduationCap,
  KeyRound,
  Layers3,
  LockKeyhole,
  MonitorSmartphone,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TicketPercent,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAdminStore } from '@/app/store/useAdminStore';
import { useCourseStore } from '@/app/store/useCourseStore';
import { useAcademyStore } from '@/app/store/useAcademyStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import { buildAdminStudentPath, ROUTES } from '@/config/routes';
import type {
  AccessGrantInput,
  Activity,
  AdminOverview,
  AdminOverviewCourseMetric,
  Entitlement,
  LearningResourceType,
  MetricSummary,
  Order,
  OrderStatus,
  StudentListItem,
  StudentRole,
  StudentStatus,
} from '@/features/admin/types/admin';
import {
  AdminDialog,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
  AdminStatusBadge,
  type AdminStatusTone,
} from './AdminUi';
import { CourseSelector } from './CourseSelector';
import { CourseFilterDropdown } from './CourseFilterDropdown';
import { courseRepository } from './courses/courseRepository';
import { apiRequest } from '@/lib/api/client';
import type { AdminOverview as LiveAdminOverview } from '@/lib/api/contracts';
import './admin-pages.css';

const ADMIN_EASE = [0.22, 1, 0.36, 1] as const;
const PAGE_SIZE = 10;

const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: ADMIN_EASE, staggerChildren: 0.045 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: ADMIN_EASE } },
};

const formatCurrency = (minor: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(minor / 100);

const formatDate = (value: string | null, includeTime = false): string => {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
};

const formatDateParts = (value: string | null): { date: string; time: string } => {
  if (!value) return { date: 'Not available', time: '' };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ''}`;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const humanize = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(/_/g, ' ')
    .replace(/(^|\s)\S/g, (letter: string) => letter.toLocaleUpperCase());

const orderTone = (status: OrderStatus): AdminStatusTone => {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
  if (status === 'REFUNDED') return 'warning';
  return 'info';
};

const studentTone = (status: StudentStatus): AdminStatusTone =>
  status === 'ACTIVE' ? 'success' : 'danger';

const roleTone = (role: StudentRole): AdminStatusTone => {
  if (role === 'SUPER_ADMIN') return 'info';
  if (role === 'ADMIN') return 'warning';
  return 'neutral';
};

const cardMotionProps = (reducedMotion: boolean | null) =>
  reducedMotion
    ? {}
    : {
        variants: itemVariants,
        whileHover: { y: -2 },
        transition: { duration: 0.2, ease: ADMIN_EASE },
      };

const Avatar = ({ student }: { student: Pick<StudentListItem, 'fullName' | 'avatarUrl'> }) => (
  <span className="pf-admin-avatar" aria-hidden="true">
    {student.avatarUrl ? <img src={student.avatarUrl} alt="" /> : initials(student.fullName)}
  </span>
);

const StudentIdentity = ({ student }: { student: StudentListItem }) => (
  <span className="pf-admin-person">
    <Avatar student={student} />
    <span>
      <strong>{student.fullName}</strong>
      <small>{student.email}</small>
    </span>
  </span>
);

const SectionTitle = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <header className="pf-admin-section__header">
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
    {action}
  </header>
);

const ErrorState = ({ message, retry }: { message: string; retry: () => void }) => (
  <AdminEmptyState
    icon={<RefreshCw size={22} />}
    title="We couldn't load this view"
    description={message}
    action={(
      <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={retry}>
        <RefreshCw size={15} aria-hidden="true" /> Retry
      </button>
    )}
  />
);

const Pagination = ({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) => (
  <footer className="pf-admin-pagination" aria-label="Pagination">
    <p>
      Page <strong>{page}</strong> of <strong>{totalPages}</strong>
      <span aria-hidden="true"> · </span>{total} results
    </p>
    <div>
      <button
        className="pf-admin-button pf-admin-button--secondary"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={15} aria-hidden="true" /> Previous
      </button>
      <button
        className="pf-admin-button pf-admin-button--secondary"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRight size={15} aria-hidden="true" />
      </button>
    </div>
  </footer>
);

interface MetricCardProps {
  label: string;
  value: string;
  summary?: MetricSummary;
  icon: ReactNode;
  helper: string;
  badgeLabel?: string;
  action?: ReactNode;
}

const MetricCard = ({ label, value, summary, icon, helper, badgeLabel = 'Live', action }: MetricCardProps) => {
  const reducedMotion = useReducedMotion();
  const change = summary?.changePercentage;
  return (
    <motion.article className={`pf-admin-card pf-admin-card--interactive pf-admin-metric${action ? ' has-action' : ''}`} {...cardMotionProps(reducedMotion)}>
      <span className="pf-admin-metric__icon" aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      {action ? <div className="pf-admin-metric__action">{action}</div> : null}
      <footer>
        {change === null || change === undefined ? (
          <span className="pf-admin-metric__change pf-admin-metric__change--neutral">{badgeLabel}</span>
        ) : (
          <span className={`pf-admin-metric__change${change < 0 ? ' is-negative' : ''}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
        <span>{helper}</span>
      </footer>
    </motion.article>
  );
};

const REVENUE_COLORS = ['#315bce', '#4f7fe8', '#70a0f1', '#8ab7f5', '#6680d9', '#9baff2'];

interface RevenueSegment {
  id: string;
  label: string;
  revenueMinor: number;
  purchases: number;
  color: string;
}

const RevenueDonut = ({ segments, scopeLabel }: { segments: RevenueSegment[]; scopeLabel: string }) => {
  const reducedMotion = useReducedMotion();
  const totalRevenue = segments.reduce((sum, segment) => sum + segment.revenueMinor, 0);
  const totalPurchases = segments.reduce((sum, segment) => sum + segment.purchases, 0);
  const usePurchases = totalRevenue === 0;
  const chartTotal = usePurchases ? totalPurchases : totalRevenue;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  return (
    <div className="pf-admin-revenue-breakdown">
      <figure className="pf-admin-donut" aria-label={`Revenue distribution for ${scopeLabel}`}>
        <svg viewBox="0 0 120 120" role="img">
          <circle className="pf-admin-donut__track" cx="60" cy="60" r={radius} />
          {chartTotal > 0 ? segments.map((segment) => {
            const value = usePurchases ? segment.purchases : segment.revenueMinor;
            const length = (value / chartTotal) * circumference;
            const offset = -consumed;
            consumed += length;
            return value > 0 ? (
              <motion.circle
                key={segment.id}
                className="pf-admin-donut__segment"
                cx="60"
                cy="60"
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.38, ease: ADMIN_EASE }}
              />
            ) : null;
          }) : null}
        </svg>
        <figcaption>
          <span>{scopeLabel}</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
          <small>{totalPurchases} purchase{totalPurchases === 1 ? '' : 's'}</small>
        </figcaption>
      </figure>

      <div className="pf-admin-donut-legend">
        {segments.length ? segments.map((segment) => {
          const denominator = totalRevenue || totalPurchases;
          const numerator = totalRevenue ? segment.revenueMinor : segment.purchases;
          const percentage = denominator ? Math.round((numerator / denominator) * 100) : 0;
          return (
            <div key={segment.id} className="pf-admin-donut-legend__item">
              <span className="pf-admin-donut-legend__swatch" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <div><strong title={segment.label}>{segment.label}</strong><small>{segment.purchases} sold</small></div>
              <div><strong>{formatCurrency(segment.revenueMinor)}</strong><small>{percentage}%</small></div>
            </div>
          );
        }) : <p className="pf-admin-donut-legend__empty">No completed purchases in this course yet.</p>}
      </div>
    </div>
  );
};

const CommerceHealth = ({ paid, refunded, failed, granted }: { paid: number; refunded: number; failed: number; granted: number }) => {
  const attempts = paid + refunded + failed;
  const successRate = attempts ? Math.round((paid / attempts) * 100) : 0;
  const unlockRate = paid ? Math.min(100, Math.round((granted / paid) * 100)) : 0;
  const rows = [
    { label: 'Purchase success', value: `${successRate}%`, progress: successRate, tone: 'success' },
    { label: 'Access delivered', value: `${unlockRate}%`, progress: unlockRate, tone: 'info' },
    { label: 'Refunded orders', value: refunded.toLocaleString('en-IN'), progress: attempts ? (refunded / attempts) * 100 : 0, tone: 'warning' },
    { label: 'Failed payments', value: failed.toLocaleString('en-IN'), progress: attempts ? (failed / attempts) * 100 : 0, tone: 'danger' },
  ];
  return (
    <div className="pf-admin-health" aria-label="Commerce and access health">
      {rows.map((row) => (
        <div className="pf-admin-health__row" key={row.label}>
          <div><span>{row.label}</span><strong>{row.value}</strong></div>
          <span className={`pf-admin-health__track is-${row.tone}`} aria-hidden="true"><i style={{ width: `${Math.max(row.progress ? 4 : 0, row.progress)}%` }} /></span>
        </div>
      ))}
    </div>
  );
};

const RecentOrdersTable = ({ orders }: { orders: Order[] }) => (
  <div className="pf-admin-table-scroll" data-lenis-prevent>
    <table className="pf-admin-table">
      <thead>
        <tr><th>Order</th><th>Buyer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td><strong>{order.id}</strong></td>
            <td><Link to={buildAdminStudentPath(order.buyer.studentId)}>{order.buyer.fullName}</Link></td>
            <td>{order.items.map((item) => item.title).join(', ')}</td>
            <td>{order.isComplimentary ? 'Complimentary' : formatCurrency(order.amountMinor)}</td>
            <td><AdminStatusBadge tone={orderTone(order.status)}>{humanize(order.status)}</AdminStatusBadge></td>
            <td>{formatDate(order.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const LegacyAdminOverviewPage = () => {
  const overview = useAdminStore((state) => state.overview);
  const status = useAdminStore((state) => state.overviewStatus);
  const error = useAdminStore((state) => state.overviewError);
  const loadOverview = useAdminStore((state) => state.loadOverview);
  const courses = useCourseStore((state) => state.courses);
  const courseStatus = useCourseStore((state) => state.status);
  const initializeCourses = useCourseStore((state) => state.initialize);
  const academies = useAcademyStore((state) => state.academies);
  const academyStatus = useAcademyStore((state) => state.status);
  const initializeAcademies = useAcademyStore((state) => state.initialize);
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');

  useEffect(() => {
    if (!overview) void loadOverview();
  }, [loadOverview, overview]);

  useEffect(() => {
    if (courseStatus === 'idle') void initializeCourses();
  }, [courseStatus, initializeCourses]);

  useEffect(() => {
    if (academyStatus === 'idle') void initializeAcademies();
  }, [academyStatus, initializeAcademies]);

  if (!overview && status === 'loading') {
    return <AdminSkeleton label="Loading overview" rows={8} variant="detail" />;
  }
  if (!overview && error) return <ErrorState message={error} retry={() => void loadOverview()} />;
  if (!overview) return null;

  const { metrics } = overview;
  const activeCourses = courses.filter((course) => course.status === 'ACTIVE');
  const selectedCourse = activeCourses.find((course) => course.id === selectedCourseId) ?? null;
  const scopedMetrics: AdminOverviewCourseMetric = selectedCourseId === 'ALL'
    ? overview.courseMetrics.reduce<AdminOverviewCourseMetric>((total, course) => ({
      ...total,
      revenueMinor: total.revenueMinor + course.revenueMinor,
      students: total.students + course.students,
      paidOrders: total.paidOrders + course.paidOrders,
      failedOrders: total.failedOrders + course.failedOrders,
      refundedOrders: total.refundedOrders + course.refundedOrders,
      accessGranted: total.accessGranted + course.accessGranted,
    }), {
      courseId: null,
      revenueMinor: 0,
      students: 0,
      paidOrders: 0,
      failedOrders: 0,
      refundedOrders: 0,
      accessGranted: 0,
      resources: [],
    })
    : overview.courseMetrics.find((course) => course.courseId === selectedCourseId) ?? {
      courseId: selectedCourseId,
      revenueMinor: 0,
      students: 0,
      paidOrders: 0,
      failedOrders: 0,
      refundedOrders: 0,
      accessGranted: 0,
      resources: [],
    };
  const scopeLabel = selectedCourse?.name ?? 'All courses';
  const activeAcademies = academies.filter((academy) => academy.status === 'ACTIVE').length;
  const revenueSegments: RevenueSegment[] = selectedCourse
    ? scopedMetrics.resources.map((resource, index) => ({
      id: resource.productId,
      label: resource.title,
      revenueMinor: resource.revenueMinor,
      purchases: resource.purchases,
      color: REVENUE_COLORS[index % REVENUE_COLORS.length],
    }))
    : activeCourses.map((course, index) => {
      const courseMetric = overview.courseMetrics.find((metric) => metric.courseId === course.id);
      return {
        id: course.id,
        label: course.name,
        revenueMinor: courseMetric?.revenueMinor ?? 0,
        purchases: courseMetric?.resources.reduce((sum, resource) => sum + resource.purchases, 0) ?? 0,
        color: REVENUE_COLORS[index % REVENUE_COLORS.length],
      };
    }).sort((left, right) => right.revenueMinor - left.revenueMinor || right.purchases - left.purchases);
  const recentOrders = selectedCourseId === 'ALL'
    ? overview.recentOrders
    : overview.recentOrders.filter((order) => order.courseId === selectedCourseId);
  return (
    <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
      <AdminPageHeader 
        title="Overview" 
        description={`Everything happening across ${selectedCourse ? scopeLabel : 'Parallax Flow'} at a glance.`} 
        actions={(
          <label className="pf-admin-icon-button" title="Filter overview by course" style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
            <SlidersHorizontal size={18} aria-hidden="true" style={{ margin: 'auto' }} />
            <span className="pf-admin-sr-only">Filter overview by course</span>
            <select 
              value={selectedCourseId} 
              onChange={(event) => setSelectedCourseId(event.target.value)} 
              aria-label="Filter overview by course"
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="ALL">All courses</option>
              {activeCourses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}
            </select>
          </label>
        )}
      />

      <motion.section className="pf-admin-card-grid" variants={itemVariants} aria-label="Platform metrics">
        <MetricCard
          label="Total revenue"
          value={formatCurrency(scopedMetrics.revenueMinor)}
          summary={selectedCourseId === 'ALL' ? metrics.totalRevenueMinor : undefined}
          badgeLabel={selectedCourseId === 'ALL' ? 'All' : 'Filtered'}
          helper={selectedCourseId === 'ALL' ? 'against the previous period' : `from ${scopeLabel}`}
          icon={<CircleDollarSign size={20} />}
        />
        <MetricCard
          label="Students"
          value={scopedMetrics.students.toLocaleString('en-IN')}
          summary={selectedCourseId === 'ALL' ? metrics.students : undefined}
          badgeLabel={selectedCourseId === 'ALL' ? 'All' : 'Filtered'}
          helper={selectedCourseId === 'ALL' ? `${metrics.newStudentsThisWeek} joined this week` : `enrolled in ${scopeLabel}`}
          icon={<UsersRound size={20} />}
        />
        <MetricCard
          label="Total academies"
          value={academyStatus === 'ready' ? academies.length.toLocaleString('en-IN') : '—'}
          badgeLabel="Global"
          helper={academyStatus === 'ready' ? `${activeAcademies} active academ${activeAcademies === 1 ? 'y' : 'ies'}` : 'loading academy network'}
          icon={<Building2 size={20} />}
        />
        <MetricCard
          label="Access granted"
          value={scopedMetrics.accessGranted.toLocaleString('en-IN')}
          badgeLabel="Delivery"
          helper={`${scopedMetrics.paidOrders} successful purchase${scopedMetrics.paidOrders === 1 ? '' : 's'}`}
          icon={<ShieldCheck size={20} />}
        />
      </motion.section>

      <motion.section className="pf-admin-analytics-grid" variants={itemVariants}>
        <article className="pf-admin-section">
          <SectionTitle
            title={selectedCourse ? 'Revenue by learning resource' : 'Revenue by course'}
            description={selectedCourse ? `Document purchases within ${scopeLabel}.` : 'Completed revenue split across every active course.'}
          />
          <div className="pf-admin-section__body"><RevenueDonut segments={revenueSegments} scopeLabel={scopeLabel} /></div>
        </article>
        <article className="pf-admin-section">
          <SectionTitle title="Commerce health" description={`Payment and library-delivery outcomes for ${scopeLabel.toLocaleLowerCase()}.`} />
          <div className="pf-admin-section__body">
            <CommerceHealth paid={scopedMetrics.paidOrders} refunded={scopedMetrics.refundedOrders} failed={scopedMetrics.failedOrders} granted={scopedMetrics.accessGranted} />
          </div>
        </article>
      </motion.section>

      <motion.section className="pf-admin-table-card" variants={itemVariants}>
        <SectionTitle
          title="Recent orders"
          description={selectedCourse ? `Latest transactions for ${scopeLabel}.` : 'The five latest transactions and access outcomes.'}
          action={<Link className="pf-admin-link" to={ROUTES.ADMIN_ORDERS}>View all orders</Link>}
        />
        {recentOrders.length ? <RecentOrdersTable orders={recentOrders} /> : (
          <AdminEmptyState compact title="No orders in this course" description="Completed and attempted purchases for this course will appear here." />
        )}
      </motion.section>

      <motion.section className="pf-admin-section" variants={itemVariants}>
        <SectionTitle title="Content library" description="Current publishing inventory across the learning ecosystem." />
        <div className="pf-admin-content-grid">
          {([
            ['Lessons', overview.contentCounts.lessons, BookOpen],
            ['Packages', overview.contentCounts.packages, PackageOpen],
            ['Subjects', overview.contentCounts.subjects, Layers3],
            ['Questions', overview.contentCounts.questions, FileQuestion],
            ['Stages', overview.contentCounts.stages, BarChart3],
            ['Coupons', overview.contentCounts.coupons, TicketPercent],
          ] as const).map(([label, value, Icon]) => (
            <article key={label}>
              <span aria-hidden="true"><Icon size={18} /></span>
              <div><strong>{value.toLocaleString('en-IN')}</strong><p>{label}</p></div>
            </article>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};

export const AdminOverviewPage = () => {
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'list'],
    queryFn: () => courseRepository.list(),
  });

  const query = useQuery({
    queryKey: ['admin', 'overview', selectedCourseId],
    queryFn: ({ signal }) =>
      apiRequest<LiveAdminOverview>(
        `/api/admin/overview${selectedCourseId !== 'ALL' ? `?courseId=${encodeURIComponent(selectedCourseId)}` : ''}`,
        { signal },
      ),
  });

  if (query.isLoading) return <AdminSkeleton label="Loading overview" rows={8} variant="detail" />;
  if (query.error || !query.data) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : 'The server overview is unavailable.'} retry={() => void query.refetch()} />;
  }

  const data = query.data;
  const rawCoursesList = coursesQuery.data ?? [];
  const sanitizeCourseName = (name: string) => name.replace(/\s+\d{6,}$/g, '').trim();
  const coursesList = rawCoursesList.map((c) => ({ ...c, name: sanitizeCourseName(c.name) }));

  const selectedCourse = coursesList.find((c) => c.id === selectedCourseId) ?? null;
  const cleanCourseName = selectedCourse ? selectedCourse.name : '';
  const scopeLabel = selectedCourse ? cleanCourseName : 'All courses';

  const scopedMetrics = data.courseMetrics.reduce<{
    revenueMinor: number; students: number; paidOrders: number; failedOrders: number; refundedOrders: number; accessGranted: number;
  }>((total, course) => ({
    revenueMinor: total.revenueMinor + course.revenueMinor,
    students: total.students + course.students,
    paidOrders: total.paidOrders + course.paidOrders,
    failedOrders: total.failedOrders + course.failedOrders,
    refundedOrders: total.refundedOrders + course.refundedOrders,
    accessGranted: total.accessGranted + course.accessGranted,
  }), { revenueMinor: 0, students: 0, paidOrders: 0, failedOrders: 0, refundedOrders: 0, accessGranted: 0 });

  const revenueSegments: RevenueSegment[] = data.courseMetrics
    .map((course, index) => {
      const match = coursesList.find((c) => c.id === course.courseId);
      return {
        id: course.courseId ?? `course-${index}`,
        label: match ? match.name : `Course ${index + 1}`,
        revenueMinor: course.revenueMinor,
        purchases: course.paidOrders,
        color: REVENUE_COLORS[index % REVENUE_COLORS.length],
      };
    })
    .sort((a, b) => b.revenueMinor - a.revenueMinor || b.purchases - a.purchases);

  const displayTotalRevenue = selectedCourseId === 'ALL' ? data.metrics.totalRevenueMinor : scopedMetrics.revenueMinor;
  const displayStudents = selectedCourseId === 'ALL' ? data.users : scopedMetrics.students;
  const displayPaidOrders = scopedMetrics.paidOrders;
  const displayAccessGranted = scopedMetrics.accessGranted;

  return (
    <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
      <AdminPageHeader
        title="Overview"
        description={selectedCourse ? `Everything happening in ${cleanCourseName} at a glance.` : 'Everything happening across Parallax Flow at a glance.'}
        actions={(
          <CourseFilterDropdown
            courses={coursesList}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
          />
        )}
      />

      <motion.section className="pf-admin-card-grid" variants={itemVariants} aria-label="Platform metrics">
        <MetricCard
          label="Total revenue"
          value={formatCurrency(displayTotalRevenue)}
          badgeLabel={selectedCourseId === 'ALL' ? 'Live' : 'Filtered'}
          helper={selectedCourseId === 'ALL' ? 'against the previous period' : `from ${cleanCourseName}`}
          icon={<CircleDollarSign size={20} />}
        />
        <MetricCard
          label="Students"
          value={displayStudents.toLocaleString('en-IN')}
          badgeLabel={selectedCourseId === 'ALL' ? 'Live' : 'Filtered'}
          helper={selectedCourseId === 'ALL' ? `${data.newStudentsThisWeek} joined this week` : `enrolled in ${cleanCourseName}`}
          icon={<UsersRound size={20} />}
        />
        <MetricCard
          label="Total academies"
          value={data.academies.toLocaleString('en-IN')}
          badgeLabel="Global"
          helper={`${data.activeUsers} active users`}
          icon={<Building2 size={20} />}
        />
        <MetricCard
          label="Access granted"
          value={displayAccessGranted.toLocaleString('en-IN')}
          badgeLabel={selectedCourseId === 'ALL' ? 'Delivery' : 'Filtered'}
          helper={`${displayPaidOrders} successful purchase${displayPaidOrders === 1 ? '' : 's'}`}
          icon={<ShieldCheck size={20} />}
        />
      </motion.section>

      <motion.section className="pf-admin-analytics-grid" variants={itemVariants}>
        <article className="pf-admin-section">
          <SectionTitle title={selectedCourse ? 'Revenue by learning resource' : 'Revenue by course'} description={selectedCourse ? `Document purchases within ${scopeLabel}.` : 'Completed revenue split across every active course.'} />
          <div className="pf-admin-section__body"><RevenueDonut segments={revenueSegments} scopeLabel={scopeLabel} /></div>
        </article>
        <article className="pf-admin-section">
          <SectionTitle title="Commerce health" description={`Payment and library-delivery outcomes for ${scopeLabel.toLocaleLowerCase()}.`} />
          <div className="pf-admin-section__body">
            <CommerceHealth paid={scopedMetrics.paidOrders} refunded={scopedMetrics.refundedOrders} failed={scopedMetrics.failedOrders} granted={scopedMetrics.accessGranted} />
          </div>
        </article>
      </motion.section>

      <motion.section className="pf-admin-table-card" variants={itemVariants}>
        <SectionTitle
          title="Recent orders"
          description={selectedCourse ? `Latest transactions for ${scopeLabel}.` : 'The five latest transactions and access outcomes.'}
          action={<Link className="pf-admin-link" to={ROUTES.ADMIN_ORDERS}>View all orders</Link>}
        />
        {data.recentOrders.length ? <RecentOrdersTable orders={data.recentOrders as unknown as Order[]} /> : (
          <AdminEmptyState compact title="No orders in this course" description="Completed and attempted purchases for this course will appear here." />
        )}
      </motion.section>

      <motion.section className="pf-admin-section" variants={itemVariants}>
        <SectionTitle title="Content library" description="Current publishing inventory across the learning ecosystem." />
        <div className="pf-admin-content-grid">
          {([
            ['Content items', data.contentCounts.lessons, BookOpen],
            ['Packages', data.contentCounts.packages, PackageOpen],
            ['Subjects', data.contentCounts.subjects, Layers3],
            ['Questions', data.contentCounts.questions, FileQuestion],
            ['Courses', data.courses, BarChart3],
            ['Coupons', data.contentCounts.coupons, TicketPercent],
          ] as const).map(([label, value, Icon]) => (
            <article key={label}>
              <span aria-hidden="true"><Icon size={18} /></span>
              <div><strong>{(value as number).toLocaleString('en-IN')}</strong><p>{label}</p></div>
            </article>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};


export const AdminStudentsPage = () => {
  const studentsPage = useAdminStore((state) => state.studentsPage);
  const status = useAdminStore((state) => state.studentsStatus);
  const error = useAdminStore((state) => state.studentsError);
  const storedQuery = useAdminStore((state) => state.studentQuery);
  const loadStudents = useAdminStore((state) => state.loadStudents);
  const courseId = useCourseStore((state) => state.selections.students);
  const [search, setSearch] = useState(storedQuery.search ?? '');
  const [role, setRole] = useState<StudentRole | 'ALL'>(storedQuery.role ?? 'ALL');
  const [studentStatus, setStudentStatus] = useState<StudentStatus | 'ALL'>(storedQuery.status ?? 'ALL');
  const [sort, setSort] = useState(storedQuery.sort ?? 'joined-desc');
  const deferredSearch = useDeferredValue(search.trim());
  const didMount = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!courseId) return;
      void loadStudents({
        page: didMount.current ? 1 : storedQuery.page,
        pageSize: PAGE_SIZE,
        search: deferredSearch,
        role,
        status: studentStatus,
        sort,
        courseId,
      });
      didMount.current = true;
    }, didMount.current ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [courseId, deferredSearch, loadStudents, role, sort, studentStatus]);

  const changePage = (page: number) => void loadStudents({ page, pageSize: PAGE_SIZE, courseId });
  const resetFilters = () => {
    setSearch('');
    setRole('ALL');
    setStudentStatus('ALL');
    setSort('joined-desc');
  };

  return (
    <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
      <AdminPageHeader title="Students" description="Every learner and administrator in the selected course." actions={<CourseSelector module="students" />} />
      <motion.section className="pf-admin-table-card" variants={itemVariants} aria-busy={status === 'loading'}>
        <div className="pf-admin-table-card__header pf-admin-student-toolbar">
          <div className="pf-admin-search-field">
            <Search size={17} aria-hidden="true" />
            <label className="pf-admin-sr-only" htmlFor="admin-student-search">Search students</label>
            <input id="admin-student-search" className="pf-admin-input" type="search" value={search} placeholder="Search name, email, phone, or course" onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label className="pf-admin-field">
            <span>Role</span>
            <select className="pf-admin-select" value={role} onChange={(event) => setRole(event.target.value as StudentRole | 'ALL')}>
              <option value="ALL">All roles</option><option value="STUDENT">Students</option><option value="ADMIN">Admins</option><option value="SUPER_ADMIN">Super admins</option>
            </select>
          </label>
          <label className="pf-admin-field">
            <span>Status</span>
            <select className="pf-admin-select" value={studentStatus} onChange={(event) => setStudentStatus(event.target.value as StudentStatus | 'ALL')}>
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option>
            </select>
          </label>
          <label className="pf-admin-field">
            <span>Sort</span>
            <select className="pf-admin-select" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="joined-desc">Newest first</option><option value="joined-asc">Oldest first</option><option value="name-asc">Name A–Z</option><option value="spent-desc">Highest spend</option>
            </select>
          </label>
        </div>

        {!studentsPage && status === 'loading' ? <AdminSkeleton label="Loading students" rows={9} variant="table" /> : null}
        {!studentsPage && error ? <ErrorState message={error} retry={() => void loadStudents()} /> : null}
        {studentsPage && studentsPage.items.length ? (
          <>
            <div className="pf-admin-table-scroll pf-admin-desktop-only" data-lenis-prevent>
              <table className="pf-admin-table pf-admin-students-table">
                <thead><tr><th>Student</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Purchases</th><th>Spent</th></tr></thead>
                <tbody>
                  {studentsPage.items.map((student) => (
                    <motion.tr key={student.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <td>
                        <Link className="pf-admin-person-link" to={buildAdminStudentPath(student.id)} aria-label={`Open ${student.fullName}'s profile`}>
                          <StudentIdentity student={student} />
                        </Link>
                      </td>
                      <td>{student.phone ?? 'Not provided'}</td>
                      <td><AdminStatusBadge tone={roleTone(student.role)}>{humanize(student.role)}</AdminStatusBadge></td>
                      <td><AdminStatusBadge tone={studentTone(student.status)}>{humanize(student.status)}</AdminStatusBadge></td>
                      <td>{formatDate(student.joinedAt)}</td>
                      <td>{student.purchaseCount}</td>
                      <td><strong>{formatCurrency(student.totalSpentMinor)}</strong></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pf-admin-students-mobile-list pf-admin-mobile-only">
              {studentsPage.items.map((student) => (
                <article key={student.id} className="pf-admin-student-card">
                  <div className="pf-admin-student-card__header">
                    <Link className="pf-admin-person-link" to={buildAdminStudentPath(student.id)}>
                      <StudentIdentity student={student} />
                    </Link>
                    <div className="pf-admin-student-card__badges">
                      <AdminStatusBadge tone={roleTone(student.role)}>{humanize(student.role)}</AdminStatusBadge>
                      <AdminStatusBadge tone={studentTone(student.status)}>{humanize(student.status)}</AdminStatusBadge>
                    </div>
                  </div>
                  <div className="pf-admin-student-card__grid">
                    <div><small>Phone</small><span>{student.phone ?? 'Not provided'}</span></div>
                    <div><small>Joined</small><span>{formatDate(student.joinedAt)}</span></div>
                    <div><small>Purchases</small><span>{student.purchaseCount}</span></div>
                    <div><small>Total Spent</small><strong>{formatCurrency(student.totalSpentMinor)}</strong></div>
                  </div>
                </article>
              ))}
            </div>

            <Pagination page={studentsPage.page} totalPages={studentsPage.totalPages} total={studentsPage.total} onPageChange={changePage} />
          </>
        ) : null}
        {studentsPage && !studentsPage.items.length ? (
          <AdminEmptyState
            compact
            title="No students found"
            description="Try a broader search or remove one of the filters."
            action={<button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={resetFilters}>Clear filters</button>}
          />
        ) : null}
      </motion.section>
    </motion.div>
  );
};

type StudentDialogKind = 'grant' | 'role' | 'status' | 'logout' | null;

const studentStats = (student: StudentListItem) => [
  ['Momentum', `${student.studyStats.momentum}%`, BarChart3],
  ['Syllabus', `${student.studyStats.syllabusCompleted}/${student.studyStats.syllabusTotal}`, GraduationCap],
  ['Study streak', `${student.studyStats.streakDays} days`, Sparkles],
  ['Study time', formatDuration(student.studyStats.studyTimeMinutes), Clock3],
  ['Sessions', student.studyStats.sessions.toLocaleString('en-IN'), MonitorSmartphone],
  ['Completed', student.studyStats.completedLessons.toLocaleString('en-IN'), UserRoundCheck],
  ['Owned lessons', student.studyStats.ownedLessons.toLocaleString('en-IN'), BookOpen],
  ['Revisions', student.studyStats.revisions.toLocaleString('en-IN'), RefreshCw],
] as const;

const EntitlementList = ({ items }: { items: Entitlement[] }) => items.length ? (
  <ul className="pf-admin-record-list">
    {items.map((item) => (
      <li key={item.id}>
        <span className="pf-admin-record-list__icon" aria-hidden="true"><KeyRound size={17} /></span>
        <div>
          <strong>{item.resourceTitle}</strong>
          <p>{humanize(item.resourceType)} · {humanize(item.source)} · {humanize(item.accessType)}</p>
          <small>Granted {formatDate(item.grantedAt)}{item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ''}</small>
        </div>
        <AdminStatusBadge tone={item.status === 'ACTIVE' ? 'success' : item.status === 'EXPIRED' ? 'warning' : 'danger'}>{humanize(item.status)}</AdminStatusBadge>
      </li>
    ))}
  </ul>
) : <AdminEmptyState compact title="No owned resources" description="Purchases and manually granted access will appear here." />;

const ActivityList = ({ items }: { items: Activity[] }) => items.length ? (
  <ol className="pf-admin-timeline">
    {items.slice(0, 10).map((item) => (
      <li key={item.id}>
        <span aria-hidden="true"><ActivityIcon size={15} /></span>
        <div><strong>{item.title}</strong><p>{item.description}</p><time dateTime={item.occurredAt}>{formatDate(item.occurredAt, true)}</time></div>
      </li>
    ))}
  </ol>
) : <AdminEmptyState compact title="No recent activity" description="Account and learning events will appear here." />;

export const AdminStudentDetailsPage = () => {
  const { studentId = '' } = useParams();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const details = useAdminStore((state) => state.selectedStudent);
  const status = useAdminStore((state) => state.studentStatus);
  const error = useAdminStore((state) => state.studentError);
  const pendingAction = useAdminStore((state) => state.pendingAction);
  const loadStudent = useAdminStore((state) => state.loadStudent);
  const clearSelectedStudent = useAdminStore((state) => state.clearSelectedStudent);
  const grantAccess = useAdminStore((state) => state.grantAccess);
  const updateStudentRole = useAdminStore((state) => state.updateStudentRole);
  const setStudentEnabled = useAdminStore((state) => state.setStudentEnabled);
  const forceLogout = useAdminStore((state) => state.forceLogout);
  const [dialog, setDialog] = useState<StudentDialogKind>(null);
  const [role, setRole] = useState<StudentRole>('STUDENT');
  const [reason, setReason] = useState('');
  const [grant, setGrant] = useState<AccessGrantInput>({ resourceType: 'PREMIUM_NOTES', resourceId: '', resourceTitle: '', accessType: 'PERMANENT', expiresAt: null, reason: '' });

  useEffect(() => {
    if (studentId) void loadStudent(studentId);
    return () => clearSelectedStudent();
  }, [clearSelectedStudent, loadStudent, studentId]);

  useEffect(() => {
    if (details?.student.id === studentId) setRole(details.student.role);
  }, [details, studentId]);

  const student = details?.student.id === studentId ? details.student : null;
  const busy = pendingAction?.studentId === studentId;
  const canGrantAccess = permissions.includes('access:grant');
  const canManageAccount = permissions.includes('accounts:manage');
  const canRevokeSessions = permissions.includes('sessions:revoke');
  const closeDialog = () => {
    if (!busy) {
      setDialog(null);
      setReason('');
    }
  };

  const submitGrant = async (event: FormEvent) => {
    event.preventDefault();
    const input: AccessGrantInput = {
      ...grant,
      resourceId: grant.resourceId.trim(),
      resourceTitle: grant.resourceTitle.trim(),
      reason: grant.reason.trim(),
      expiresAt: grant.accessType === 'TIME_LIMITED' && grant.expiresAt
        ? new Date(grant.expiresAt).toISOString()
        : null,
    };
    if (await grantAccess(studentId, input)) {
      setDialog(null);
      setGrant({ resourceType: 'PREMIUM_NOTES', resourceId: '', resourceTitle: '', accessType: 'PERMANENT', expiresAt: null, reason: '' });
    }
  };

  const submitRole = async (event: FormEvent) => {
    event.preventDefault();
    if (await updateStudentRole(studentId, role, reason.trim())) closeDialog();
  };

  const submitStatus = async () => {
    if (!student) return;
    if (await setStudentEnabled(studentId, student.status !== 'ACTIVE', reason.trim())) closeDialog();
  };

  const submitLogout = async () => {
    if (await forceLogout(studentId, reason.trim())) closeDialog();
  };

  if (!student && status === 'loading') return <AdminSkeleton label="Loading student details" rows={11} variant="detail" />;
  if (!student && error) return <ErrorState message={error} retry={() => void loadStudent(studentId)} />;
  if (!student || !details) return null;

  return (
    <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
      <AdminPageHeader
        title={student.fullName}
        description={`${student.email}${student.selectedCourse ? ` · ${student.selectedCourse.name}` : ''}`}
        breadcrumbs={[{ label: 'Overview', to: ROUTES.ADMIN_OVERVIEW }, { label: 'Students', to: ROUTES.ADMIN_STUDENTS }, { label: student.fullName }]}
        actions={(
          <>
            {canGrantAccess ? <button className="pf-admin-button" type="button" onClick={() => setDialog('grant')}><Gift size={16} aria-hidden="true" /> Grant access</button> : null}
            <Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ADMIN_STUDENTS}><ArrowLeft size={16} aria-hidden="true" /> Students</Link>
          </>
        )}
      />

      <motion.section className="pf-admin-student-hero pf-admin-card" variants={itemVariants}>
        <div className="pf-admin-student-hero__identity">
          <span className="pf-admin-student-hero__avatar"><Avatar student={student} /></span>
          <div><p>Student account</p><h2>{student.fullName}</h2><span>{student.phone ?? 'No phone provided'} · Joined {formatDate(student.joinedAt)}</span></div>
        </div>
        <div className="pf-admin-student-hero__badges">
          <AdminStatusBadge tone={roleTone(student.role)}>{humanize(student.role)}</AdminStatusBadge>
          <AdminStatusBadge tone={studentTone(student.status)}>{humanize(student.status)}</AdminStatusBadge>
        </div>
      </motion.section>

      <motion.section className="pf-admin-stat-grid pf-admin-study-stats" variants={itemVariants} aria-label="Study statistics">
        {studentStats(student).map(([label, value, Icon]) => (
          <article className="pf-admin-card" key={label}><span aria-hidden="true"><Icon size={17} /></span><div><strong>{value}</strong><p>{label}</p></div></article>
        ))}
      </motion.section>

      <motion.div className="pf-admin-detail-layout" variants={itemVariants}>
        <div className="pf-admin-detail-main">
          <section className="pf-admin-section">
            <SectionTitle title="Purchases" description={`${details.purchases.length} order${details.purchases.length === 1 ? '' : 's'} associated with this account.`} />
            {details.purchases.length ? <RecentOrdersTable orders={details.purchases} /> : <AdminEmptyState compact title="No purchases" description="This student has not placed an order yet." />}
          </section>
          <section className="pf-admin-section">
            <SectionTitle title="Owned lessons and resources" description="Entitlements currently recorded for this learner." />
            <div className="pf-admin-section__body"><EntitlementList items={details.entitlements} /></div>
          </section>
          <section className="pf-admin-section">
            <SectionTitle title="Recent activity" description="Latest learning, account, and administrator events." />
            <div className="pf-admin-section__body"><ActivityList items={details.activity} /></div>
          </section>
        </div>

        <aside className="pf-admin-detail-side" aria-label="Student administration">
          <section className="pf-admin-section">
            <SectionTitle title="Account controls" description="Privileged actions are added to the audit trail." />
            <div className="pf-admin-action-list">
              {canManageAccount ? <button type="button" onClick={() => setDialog('role')}><ShieldCheck size={18} aria-hidden="true" /><span><strong>Change role</strong><small>Current: {humanize(student.role)}</small></span><ChevronRight size={16} aria-hidden="true" /></button> : null}
              {canRevokeSessions ? <button type="button" onClick={() => setDialog('logout')} disabled={!details.activeSessions.length}><MonitorSmartphone size={18} aria-hidden="true" /><span><strong>Force logout</strong><small>{details.activeSessions.length} active session{details.activeSessions.length === 1 ? '' : 's'}</small></span><ChevronRight size={16} aria-hidden="true" /></button> : null}
              {canManageAccount ? <button className={student.status === 'ACTIVE' ? 'is-danger' : ''} type="button" onClick={() => setDialog('status')}>{student.status === 'ACTIVE' ? <UserRoundX size={18} aria-hidden="true" /> : <UserRoundCheck size={18} aria-hidden="true" />}<span><strong>{student.status === 'ACTIVE' ? 'Disable account' : 'Enable account'}</strong><small>{student.status === 'ACTIVE' ? 'Block access until enabled' : 'Restore account access'}</small></span><ChevronRight size={16} aria-hidden="true" /></button> : null}
            </div>
          </section>

          <section className="pf-admin-section">
            <SectionTitle title="Active sessions" description="Signed-in devices for this account." />
            <div className="pf-admin-section__body">
              {details.activeSessions.length ? (
                <ul className="pf-admin-session-list">
                  {details.activeSessions.map((session) => (
                    <li key={session.id}><span aria-hidden="true"><MonitorSmartphone size={17} /></span><div><strong>{session.deviceName}</strong><p>{humanize(session.platform)}{session.location ? ` · ${session.location}` : ''}</p><small>Active {formatDate(session.lastActiveAt, true)}</small></div>{session.isCurrent ? <AdminStatusBadge tone="info">Current</AdminStatusBadge> : null}</li>
                  ))}
                </ul>
              ) : <p className="pf-admin-muted-copy">No active sessions.</p>}
            </div>
          </section>
        </aside>
      </motion.div>

      <AdminDialog
        open={dialog === 'grant'}
        onClose={closeDialog}
        title="Grant access"
        description={`Add a learning resource to ${student.fullName}'s library. This action is audited.`}
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={closeDialog} disabled={busy}>Cancel</button><button className="pf-admin-button" type="submit" form="pf-admin-grant-form" disabled={busy}>{busy ? 'Granting…' : 'Grant access'}</button></>}
      >
        <form id="pf-admin-grant-form" className="pf-admin-form-grid" onSubmit={submitGrant}>
          <label className="pf-admin-field"><span>Resource type</span><select className="pf-admin-select" value={grant.resourceType} onChange={(event) => setGrant((value) => ({ ...value, resourceType: event.target.value as LearningResourceType }))}><option value="PREMIUM_NOTES">Premium notes</option><option value="LESSON">Lesson</option><option value="PACKAGE">Package</option><option value="COURSE">Course</option><option value="SUBJECT">Subject</option><option value="OTHER">Other</option></select></label>
          <label className="pf-admin-field"><span>Resource ID</span><input className="pf-admin-input" required value={grant.resourceId} placeholder="e.g. pf-ca-int-aa-01" onChange={(event) => setGrant((value) => ({ ...value, resourceId: event.target.value }))} /></label>
          <label className="pf-admin-field pf-admin-field--wide"><span>Resource title</span><input className="pf-admin-input" required value={grant.resourceTitle} placeholder="Advanced Accounting" onChange={(event) => setGrant((value) => ({ ...value, resourceTitle: event.target.value }))} /></label>
          <label className="pf-admin-field"><span>Access</span><select className="pf-admin-select" value={grant.accessType} onChange={(event) => setGrant((value) => ({ ...value, accessType: event.target.value as AccessGrantInput['accessType'] }))}><option value="PERMANENT">Permanent</option><option value="TIME_LIMITED">Time limited</option></select></label>
          {grant.accessType === 'TIME_LIMITED' ? <label className="pf-admin-field"><span>Expires</span><input className="pf-admin-input" required type="datetime-local" value={grant.expiresAt ?? ''} onChange={(event) => setGrant((value) => ({ ...value, expiresAt: event.target.value }))} /></label> : null}
          <label className="pf-admin-field pf-admin-field--wide"><span>Reason</span><textarea className="pf-admin-textarea" required value={grant.reason} placeholder="Explain why this access is being granted" onChange={(event) => setGrant((value) => ({ ...value, reason: event.target.value }))} /></label>
        </form>
      </AdminDialog>

      <AdminDialog
        open={dialog === 'role'}
        onClose={closeDialog}
        title="Change account role"
        description="Role changes affect administrative privileges and are recorded in the audit trail."
        size="small"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={closeDialog} disabled={busy}>Cancel</button><button className="pf-admin-button" type="submit" form="pf-admin-role-form" disabled={busy || role === student.role}>{busy ? 'Saving…' : 'Save role'}</button></>}
      >
        <form id="pf-admin-role-form" className="pf-admin-form-stack" onSubmit={submitRole}>
          <label className="pf-admin-field"><span>Role</span><select className="pf-admin-select" value={role} onChange={(event) => setRole(event.target.value as StudentRole)}><option value="STUDENT">Student</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select></label>
          <label className="pf-admin-field"><span>Reason</span><textarea className="pf-admin-textarea" value={reason} placeholder="Reason for this change" onChange={(event) => setReason(event.target.value)} /></label>
        </form>
      </AdminDialog>

      <AdminDialog
        open={dialog === 'status'}
        onClose={closeDialog}
        title={student.status === 'ACTIVE' ? 'Disable this account?' : 'Enable this account?'}
        description={student.status === 'ACTIVE' ? 'The student will be blocked from accessing Parallax Flow until the account is enabled again.' : 'The student will regain access to Parallax Flow.'}
        size="small"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={closeDialog} disabled={busy}>Cancel</button><button className={`pf-admin-button${student.status === 'ACTIVE' ? ' pf-admin-button--danger' : ''}`} type="button" onClick={() => void submitStatus()} disabled={busy}>{busy ? 'Updating…' : student.status === 'ACTIVE' ? 'Disable account' : 'Enable account'}</button></>}
      >
        <label className="pf-admin-field"><span>Reason</span><textarea className="pf-admin-textarea" value={reason} placeholder="Reason for this account change" onChange={(event) => setReason(event.target.value)} /></label>
      </AdminDialog>

      <AdminDialog
        open={dialog === 'logout'}
        onClose={closeDialog}
        title="Force logout all sessions?"
        description={`This will revoke ${details.activeSessions.length} active session${details.activeSessions.length === 1 ? '' : 's'} immediately.`}
        size="small"
        footer={<><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={closeDialog} disabled={busy}>Cancel</button><button className="pf-admin-button pf-admin-button--danger" type="button" onClick={() => void submitLogout()} disabled={busy}>{busy ? 'Revoking…' : 'Force logout'}</button></>}
      >
        <label className="pf-admin-field"><span>Reason</span><textarea className="pf-admin-textarea" value={reason} placeholder="Reason for revoking these sessions" onChange={(event) => setReason(event.target.value)} /></label>
      </AdminDialog>
    </motion.div>
  );
};

export { AdminOrdersReadOnlyPage as AdminOrdersPage } from './readOnly/AdminOrdersReadOnlyPages';

export const AdminPlaceholderPage = ({ module }: { module: string }) => (
  <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
    <AdminPageHeader title={module} description={`The ${module.toLocaleLowerCase()} workspace is prepared for the next Super Admin phase.`} />
    <motion.div variants={itemVariants}>
      <AdminEmptyState
        icon={<Boxes size={22} />}
        title={`${module} is ready for its workflow`}
        description="Navigation, access control, theme behavior, and the responsive admin shell are already connected. Domain actions will be introduced when this module is implemented."
        action={<Link className="pf-admin-button pf-admin-button--secondary" to={ROUTES.ADMIN_OVERVIEW}>Return to overview</Link>}
      />
    </motion.div>
  </motion.div>
);
