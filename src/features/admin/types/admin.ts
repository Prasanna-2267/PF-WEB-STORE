export type StudentRole = 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';

export type StudentStatus = 'ACTIVE' | 'DISABLED';

export interface CourseSelection {
  id: string;
  slug: string;
  name: string;
}

/** Stable course relationship used across all course-scoped admin data. */
export type CourseStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface AdminCourse extends CourseSelection {
  code: string;
  description: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudyStats {
  momentum: number;
  syllabusCompleted: number;
  syllabusTotal: number;
  streakDays: number;
  studyTimeMinutes: number;
  sessions: number;
  completedLessons: number;
  ownedLessons: number;
  revisions: number;
}

export interface Student {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl?: string;
  role: StudentRole;
  status: StudentStatus;
  joinedAt: string;
  selectedCourse: CourseSelection | null;
  /** The stable source-of-truth relationship. selectedCourse remains a display snapshot. */
  courseId: string | null;
  studyStats: StudyStats;
}

export interface StudentListItem extends Student {
  purchaseCount: number;
  totalSpentMinor: number;
}

export type OrderStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

export type RefundStatus = 'NONE' | 'PENDING' | 'PARTIAL' | 'FULL';

export type OrderAccessStatus = 'PENDING' | 'GRANTED' | 'REVOKED' | 'NOT_APPLICABLE';

export type LearningResourceType =
  | 'COURSE'
  | 'PACKAGE'
  | 'LESSON'
  | 'PREMIUM_NOTES'
  | 'SUBJECT'
  | 'OTHER';

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  resourceType: LearningResourceType;
  quantity: 1;
  unitAmountMinor: number;
  totalAmountMinor: number;
}

export interface OrderBuyer {
  studentId: Student['id'];
  fullName: string;
  email: string;
}

export interface Order {
  id: string;
  buyer: OrderBuyer;
  items: OrderItem[];
  currency: 'INR';
  amountMinor: number;
  status: OrderStatus;
  refundStatus: RefundStatus;
  accessStatus: OrderAccessStatus;
  isComplimentary: boolean;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  receiptNumber: string | null;
  paymentMethod: string | null;
  courseId: string | null;
}

export interface OrderSummary {
  totalOrders: number;
  paidOrders: number;
  failedOrders: number;
  refundedOrders: number;
  pendingOrders: number;
  complimentaryOrders: number;
  revenueMinor: number;
}

export type EntitlementSource = 'PURCHASE' | 'ADMIN_GRANT' | 'SUBSCRIPTION' | 'PROMOTION';

export type EntitlementAccessType = 'PERMANENT' | 'TIME_LIMITED';

export type EntitlementStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface Entitlement {
  id: string;
  studentId: Student['id'];
  resourceType: LearningResourceType;
  resourceId: string;
  resourceTitle: string;
  source: EntitlementSource;
  sourceId: string | null;
  accessType: EntitlementAccessType;
  status: EntitlementStatus;
  grantedAt: string;
  expiresAt: string | null;
  grantedByAdminId: Student['id'] | null;
  reason: string | null;
  revokedAt: string | null;
}

export type ActivityType =
  | 'ACCOUNT_CREATED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LESSON_OPENED'
  | 'LESSON_COMPLETED'
  | 'REVISION_MARKED'
  | 'PRACTICE_COMPLETED'
  | 'PURCHASE_MADE'
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  | 'ROLE_CHANGED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_ENABLED'
  | 'FORCE_LOGOUT';

export interface Activity {
  id: string;
  studentId: Student['id'];
  type: ActivityType;
  title: string;
  description: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActiveSession {
  id: string;
  studentId: Student['id'];
  deviceName: string;
  platform: 'ANDROID' | 'WEB' | 'IOS' | 'UNKNOWN';
  location: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface AccessGrantInput {
  resourceType: LearningResourceType;
  resourceId: string;
  resourceTitle: string;
  accessType: EntitlementAccessType;
  expiresAt?: string | null;
  reason: string;
}

export interface MetricSummary {
  current: number;
  previousPeriod: number;
  changePercentage: number | null;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface AdminOverviewMetrics {
  totalRevenueMinor: MetricSummary;
  students: MetricSummary;
  paidOrders: MetricSummary;
  todayRevenueMinor: MetricSummary;
  failedOrders: number;
  refundedOrders: number;
  newStudentsThisWeek: number;
}

export interface AdminOverviewResourceMetric {
  productId: string;
  title: string;
  revenueMinor: number;
  purchases: number;
}

export interface AdminOverviewCourseMetric {
  courseId: string | null;
  revenueMinor: number;
  students: number;
  paidOrders: number;
  failedOrders: number;
  refundedOrders: number;
  accessGranted: number;
  resources: AdminOverviewResourceMetric[];
}

export interface AdminContentCounts {
  lessons: number;
  packages: number;
  subjects: number;
  questions: number;
  stages: number;
  coupons: number;
}

export interface AdminOverview {
  generatedAt: string;
  metrics: AdminOverviewMetrics;
  revenueLast30Days: TimeSeriesPoint[];
  newStudentsLast30Days: TimeSeriesPoint[];
  recentOrders: Order[];
  contentCounts: AdminContentCounts;
  courseMetrics: AdminOverviewCourseMetric[];
}

export type AuditAction =
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  | 'ROLE_CHANGED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_ENABLED'
  | 'SESSIONS_REVOKED';

export interface AuditEvent {
  id: string;
  actorId: Student['id'];
  targetStudentId: Student['id'];
  action: AuditAction;
  occurredAt: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface StudentDetails {
  student: StudentListItem;
  purchases: Order[];
  entitlements: Entitlement[];
  activity: Activity[];
  activeSessions: ActiveSession[];
  auditEvents: AuditEvent[];
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface StudentListQuery extends PaginationQuery {
  search?: string;
  role?: StudentRole | 'ALL';
  status?: StudentStatus | 'ALL';
  courseId?: string;
  sort?: 'joined-desc' | 'joined-asc' | 'name-asc' | 'spent-desc';
}

export interface OrderListQuery extends PaginationQuery {
  search?: string;
  status?: OrderStatus | 'ALL';
  studentId?: string;
  courseId?: string;
  sort?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminFeedback {
  kind: 'success' | 'error';
  message: string;
}
