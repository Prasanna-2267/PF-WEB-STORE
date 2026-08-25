import type {
  ActiveSession,
  Activity,
  AdminContentCounts,
  AuditEvent,
  CourseSelection,
  Entitlement,
  Order,
  Student,
  StudyStats,
  TimeSeriesPoint,
} from '../types/admin';

export const DEMO_SUPER_ADMIN_ID = 'student-admin-super-001';

const courses = {
  caFoundation: { id: 'course-ca-foundation', slug: 'ca-foundation', name: 'CA Foundation' },
  caIntermediate: { id: 'course-ca-intermediate', slug: 'ca-intermediate', name: 'CA Intermediate' },
  caFinal: { id: 'course-ca-final', slug: 'ca-final', name: 'Chartered Accountant - CA Final' },
  jee: { id: 'course-jee', slug: 'jee', name: 'JEE Main & Advanced' },
  neet: { id: 'course-neet', slug: 'neet', name: 'NEET' },
  upsc: { id: 'course-upsc', slug: 'upsc', name: 'UPSC Civil Services' },
} satisfies Record<string, CourseSelection>;

export const ADMIN_COURSE_IDS = {
  charteredAccountancy: 'course-chartered-accountancy',
  jee: 'course-jee',
  neet: 'course-neet',
  upsc: 'course-upsc',
} as const;

const defaultStats: StudyStats = {
  momentum: 0,
  syllabusCompleted: 0,
  syllabusTotal: 0,
  streakDays: 0,
  studyTimeMinutes: 0,
  sessions: 0,
  completedLessons: 0,
  ownedLessons: 0,
  revisions: 0,
};

const stats = (overrides: Partial<StudyStats>): StudyStats => ({ ...defaultStats, ...overrides });

export const adminStudentsFixture: readonly Student[] = [
  {
    id: 'student-shinaz-001',
    fullName: 'Shinaz Bin Shajahan',
    email: 'shinaz2003@gmail.com',
    phone: '8157077432',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-07-13T08:45:00.000Z',
    selectedCourse: courses.caFinal,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 42, syllabusCompleted: 2, syllabusTotal: 18, streakDays: 3, studyTimeMinutes: 184, sessions: 12, completedLessons: 2, ownedLessons: 1, revisions: 12 }),
  },
  {
    id: 'student-slr-002',
    fullName: 'SLR Channel',
    email: 'slr.channel@example.com',
    phone: '9847011223',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-07-02T11:12:00.000Z',
    selectedCourse: courses.caIntermediate,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 68, syllabusCompleted: 9, syllabusTotal: 24, streakDays: 7, studyTimeMinutes: 816, sessions: 35, completedLessons: 9, ownedLessons: 1, revisions: 31 }),
  },
  {
    id: 'student-kartikeyan-003',
    fullName: 'Kartikeyan Suresh',
    email: 'kartikeyansuresh2703@gmail.com',
    phone: '9876542703',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-07-28T05:30:00.000Z',
    selectedCourse: courses.caIntermediate,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 74, syllabusCompleted: 12, syllabusTotal: 26, streakDays: 11, studyTimeMinutes: 1240, sessions: 49, completedLessons: 12, ownedLessons: 1, revisions: 46 }),
  },
  {
    id: 'student-ananya-004',
    fullName: 'Ananya Krishnan',
    email: 'ananya.krishnan@example.com',
    phone: '9895017632',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-08-12T06:10:00.000Z',
    selectedCourse: courses.caFoundation,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 36, syllabusCompleted: 4, syllabusTotal: 22, streakDays: 2, studyTimeMinutes: 292, sessions: 14, completedLessons: 4, revisions: 10 }),
  },
  {
    id: 'student-rohan-005',
    fullName: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    phone: '9820113498',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-06-18T13:20:00.000Z',
    selectedCourse: courses.jee,
    courseId: ADMIN_COURSE_IDS.jee,
    studyStats: stats({ momentum: 81, syllabusCompleted: 28, syllabusTotal: 62, streakDays: 18, studyTimeMinutes: 3260, sessions: 98, completedLessons: 28, revisions: 72 }),
  },
  {
    id: 'student-ishita-006',
    fullName: 'Ishita Sen',
    email: 'ishita.sen@example.com',
    phone: '9831064451',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-08-14T14:05:00.000Z',
    selectedCourse: courses.neet,
    courseId: ADMIN_COURSE_IDS.neet,
    studyStats: stats({ momentum: 29, syllabusCompleted: 3, syllabusTotal: 58, streakDays: 1, studyTimeMinutes: 146, sessions: 7, completedLessons: 3, revisions: 5 }),
  },
  {
    id: 'student-arjun-007',
    fullName: 'Arjun Nair',
    email: 'arjun.nair@example.com',
    phone: '9746023188',
    role: 'STUDENT',
    status: 'DISABLED',
    joinedAt: '2026-05-21T09:55:00.000Z',
    selectedCourse: courses.upsc,
    courseId: ADMIN_COURSE_IDS.upsc,
    studyStats: stats({ momentum: 18, syllabusCompleted: 6, syllabusTotal: 74, studyTimeMinutes: 512, sessions: 19, completedLessons: 6, revisions: 14 }),
  },
  {
    id: 'student-meera-008',
    fullName: 'Meera Iyer',
    email: 'meera.iyer@example.com',
    phone: null,
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-07-31T16:40:00.000Z',
    selectedCourse: courses.caIntermediate,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 55, syllabusCompleted: 7, syllabusTotal: 26, streakDays: 5, studyTimeMinutes: 634, sessions: 27, completedLessons: 7, revisions: 19 }),
  },
  {
    id: 'student-vikram-009',
    fullName: 'Vikram Rao',
    email: 'vikram.rao@example.com',
    phone: '9900124678',
    role: 'STUDENT',
    status: 'ACTIVE',
    joinedAt: '2026-04-09T04:25:00.000Z',
    selectedCourse: courses.caFinal,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    studyStats: stats({ momentum: 63, syllabusCompleted: 17, syllabusTotal: 31, streakDays: 8, studyTimeMinutes: 2105, sessions: 71, completedLessons: 17, revisions: 54 }),
  },
  {
    id: 'student-ops-admin-010',
    fullName: 'Parallax Operations',
    email: 'operations@parallaxflow.in',
    phone: null,
    role: 'ADMIN',
    status: 'ACTIVE',
    joinedAt: '2026-03-01T08:00:00.000Z',
    selectedCourse: null,
    courseId: null,
    studyStats: stats({ sessions: 22 }),
  },
  {
    id: DEMO_SUPER_ADMIN_ID,
    fullName: 'Parallax Flow Admin',
    email: 'brightsteps2025@gmail.com',
    phone: null,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T00:00:00.000Z',
    selectedCourse: null,
    courseId: null,
    studyStats: stats({ sessions: 41 }),
  },
];

export const adminOrdersFixture: readonly Order[] = [
  {
    id: 'PF-2026-0001',
    buyer: { studentId: 'student-meera-008', fullName: 'Meera Iyer', email: 'meera.iyer@example.com' },
    items: [{ id: 'item-0001', productId: 'pf-ca-int-tax-01', title: 'Taxation — Master Question Bank', resourceType: 'PREMIUM_NOTES', quantity: 1, unitAmountMinor: 49900, totalAmountMinor: 49900 }],
    currency: 'INR', amountMinor: 49900, status: 'FAILED', refundStatus: 'NONE', accessStatus: 'NOT_APPLICABLE', isComplimentary: false,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    createdAt: '2026-07-06T10:25:00.000Z', paidAt: null, refundedAt: null, receiptNumber: null, paymentMethod: 'UPI',
  },
  {
    id: 'PF-2026-0002',
    buyer: { studentId: 'student-slr-002', fullName: 'SLR Channel', email: 'slr.channel@example.com' },
    items: [{ id: 'item-0002', productId: 'resource-permission-letter', title: 'Permission Letter', resourceType: 'LESSON', quantity: 1, unitAmountMinor: 40000, totalAmountMinor: 40000 }],
    currency: 'INR', amountMinor: 40000, status: 'PAID', refundStatus: 'NONE', accessStatus: 'GRANTED', isComplimentary: false,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    createdAt: '2026-07-09T07:32:00.000Z', paidAt: '2026-07-09T07:34:00.000Z', refundedAt: null, receiptNumber: 'RCPT-PF-0002', paymentMethod: 'UPI',
  },
  {
    id: 'PF-2026-0003',
    buyer: { studentId: 'student-shinaz-001', fullName: 'Shinaz Bin Shajahan', email: 'shinaz2003@gmail.com' },
    items: [{ id: 'item-0003', productId: 'pf-ca-fnd-law-01', title: 'Business Laws — Mind Map Book', resourceType: 'PREMIUM_NOTES', quantity: 1, unitAmountMinor: 29900, totalAmountMinor: 29900 }],
    currency: 'INR', amountMinor: 29900, status: 'REFUNDED', refundStatus: 'FULL', accessStatus: 'REVOKED', isComplimentary: false,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    createdAt: '2026-07-13T09:15:00.000Z', paidAt: '2026-07-13T09:16:00.000Z', refundedAt: '2026-07-14T11:30:00.000Z', receiptNumber: 'RCPT-PF-0003', paymentMethod: 'CARD',
  },
  {
    id: 'PF-2026-0004',
    buyer: { studentId: 'student-shinaz-001', fullName: 'Shinaz Bin Shajahan', email: 'shinaz2003@gmail.com' },
    items: [{ id: 'item-0004', productId: 'resource-government-material', title: 'Government Material', resourceType: 'LESSON', quantity: 1, unitAmountMinor: 0, totalAmountMinor: 0 }],
    currency: 'INR', amountMinor: 0, status: 'PAID', refundStatus: 'NONE', accessStatus: 'GRANTED', isComplimentary: true,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    createdAt: '2026-08-11T06:40:00.000Z', paidAt: '2026-08-11T06:40:00.000Z', refundedAt: null, receiptNumber: 'COMP-PF-0004', paymentMethod: 'COMP',
  },
  {
    id: 'PF-2026-0005',
    buyer: { studentId: 'student-kartikeyan-003', fullName: 'Kartikeyan Suresh', email: 'kartikeyansuresh2703@gmail.com' },
    items: [{ id: 'item-0005', productId: 'pf-ca-int-aa-01', title: 'Advanced Accounting', resourceType: 'PREMIUM_NOTES', quantity: 1, unitAmountMinor: 40000, totalAmountMinor: 40000 }],
    currency: 'INR', amountMinor: 40000, status: 'PAID', refundStatus: 'NONE', accessStatus: 'GRANTED', isComplimentary: false,
    courseId: ADMIN_COURSE_IDS.charteredAccountancy,
    createdAt: '2026-07-28T12:05:00.000Z', paidAt: '2026-07-28T12:06:00.000Z', refundedAt: null, receiptNumber: 'RCPT-PF-0005', paymentMethod: 'CARD',
  },
];

export const adminEntitlementsFixture: readonly Entitlement[] = [
  { id: 'ent-0002', studentId: 'student-slr-002', resourceType: 'LESSON', resourceId: 'resource-permission-letter', resourceTitle: 'Permission Letter', source: 'PURCHASE', sourceId: 'PF-2026-0002', accessType: 'PERMANENT', status: 'ACTIVE', grantedAt: '2026-07-09T07:34:00.000Z', expiresAt: null, grantedByAdminId: null, reason: null, revokedAt: null },
  { id: 'ent-0003', studentId: 'student-shinaz-001', resourceType: 'PREMIUM_NOTES', resourceId: 'pf-ca-fnd-law-01', resourceTitle: 'Business Laws — Mind Map Book', source: 'PURCHASE', sourceId: 'PF-2026-0003', accessType: 'PERMANENT', status: 'REVOKED', grantedAt: '2026-07-13T09:16:00.000Z', expiresAt: null, grantedByAdminId: null, reason: 'Revoked after full refund.', revokedAt: '2026-07-14T11:30:00.000Z' },
  { id: 'ent-0004', studentId: 'student-shinaz-001', resourceType: 'LESSON', resourceId: 'resource-government-material', resourceTitle: 'Government Material', source: 'PURCHASE', sourceId: 'PF-2026-0004', accessType: 'PERMANENT', status: 'ACTIVE', grantedAt: '2026-08-11T06:40:00.000Z', expiresAt: null, grantedByAdminId: null, reason: 'Complimentary access.', revokedAt: null },
  { id: 'ent-0005', studentId: 'student-kartikeyan-003', resourceType: 'PREMIUM_NOTES', resourceId: 'pf-ca-int-aa-01', resourceTitle: 'Advanced Accounting', source: 'PURCHASE', sourceId: 'PF-2026-0005', accessType: 'PERMANENT', status: 'ACTIVE', grantedAt: '2026-07-28T12:06:00.000Z', expiresAt: null, grantedByAdminId: null, reason: null, revokedAt: null },
];

export const adminActivityFixture: readonly Activity[] = [
  { id: 'activity-001', studentId: 'student-shinaz-001', type: 'ACCOUNT_CREATED', title: 'Account created', description: 'Joined Parallax Flow.', occurredAt: '2026-07-13T08:45:00.000Z' },
  { id: 'activity-002', studentId: 'student-shinaz-001', type: 'PURCHASE_MADE', title: 'Government Material unlocked', description: 'Complimentary order PF-2026-0004 granted access.', occurredAt: '2026-08-11T06:40:00.000Z', metadata: { orderId: 'PF-2026-0004' } },
  { id: 'activity-003', studentId: 'student-shinaz-001', type: 'REVISION_MARKED', title: 'Revision completed', description: 'Marked Audit Documentation for revision.', occurredAt: '2026-08-14T17:20:00.000Z' },
  { id: 'activity-004', studentId: 'student-slr-002', type: 'PURCHASE_MADE', title: 'Permission Letter purchased', description: 'Payment verified for order PF-2026-0002.', occurredAt: '2026-07-09T07:34:00.000Z', metadata: { orderId: 'PF-2026-0002' } },
  { id: 'activity-005', studentId: 'student-slr-002', type: 'LESSON_OPENED', title: 'Lesson opened', description: 'Opened Permission Letter in the Android app.', occurredAt: '2026-08-13T12:42:00.000Z' },
  { id: 'activity-006', studentId: 'student-kartikeyan-003', type: 'PURCHASE_MADE', title: 'Advanced Accounting purchased', description: 'Payment verified for order PF-2026-0005.', occurredAt: '2026-07-28T12:06:00.000Z', metadata: { orderId: 'PF-2026-0005' } },
  { id: 'activity-007', studentId: 'student-kartikeyan-003', type: 'PRACTICE_COMPLETED', title: 'Practice completed', description: 'Completed a Journal Entries practice set.', occurredAt: '2026-08-15T04:50:00.000Z' },
  { id: 'activity-008', studentId: 'student-ananya-004', type: 'ACCOUNT_CREATED', title: 'Account created', description: 'Joined Parallax Flow.', occurredAt: '2026-08-12T06:10:00.000Z' },
  { id: 'activity-009', studentId: 'student-ishita-006', type: 'ACCOUNT_CREATED', title: 'Account created', description: 'Joined Parallax Flow.', occurredAt: '2026-08-14T14:05:00.000Z' },
  { id: 'activity-010', studentId: 'student-rohan-005', type: 'LESSON_COMPLETED', title: 'Lesson completed', description: 'Completed Rotational Mechanics.', occurredAt: '2026-08-14T18:12:00.000Z' },
  { id: 'activity-011', studentId: 'student-arjun-007', type: 'ACCOUNT_DISABLED', title: 'Account disabled', description: 'Account disabled after a support review.', occurredAt: '2026-08-03T10:00:00.000Z' },
];

export const adminSessionsFixture: readonly ActiveSession[] = [
  { id: 'session-shinaz-android', studentId: 'student-shinaz-001', deviceName: 'Samsung Galaxy A54', platform: 'ANDROID', location: 'Kochi, Kerala', ipAddress: '103.21.58.14', createdAt: '2026-08-14T04:10:00.000Z', lastActiveAt: '2026-08-15T04:42:00.000Z', isCurrent: true },
  { id: 'session-slr-web', studentId: 'student-slr-002', deviceName: 'Chrome on Windows', platform: 'WEB', location: 'Thiruvananthapuram, Kerala', ipAddress: '49.37.82.19', createdAt: '2026-08-13T09:20:00.000Z', lastActiveAt: '2026-08-14T16:12:00.000Z', isCurrent: true },
  { id: 'session-kartikeyan-android', studentId: 'student-kartikeyan-003', deviceName: 'OnePlus Nord', platform: 'ANDROID', location: 'Chennai, Tamil Nadu', ipAddress: '117.203.11.72', createdAt: '2026-08-15T03:10:00.000Z', lastActiveAt: '2026-08-15T05:02:00.000Z', isCurrent: true },
  { id: 'session-rohan-android', studentId: 'student-rohan-005', deviceName: 'Pixel 8', platform: 'ANDROID', location: 'Mumbai, Maharashtra', ipAddress: '106.51.73.28', createdAt: '2026-08-12T15:00:00.000Z', lastActiveAt: '2026-08-14T18:12:00.000Z', isCurrent: true },
  { id: 'session-super-admin-web', studentId: DEMO_SUPER_ADMIN_ID, deviceName: 'Chrome on Windows', platform: 'WEB', location: 'Chennai, Tamil Nadu', ipAddress: '127.0.0.1', createdAt: '2026-08-15T03:00:00.000Z', lastActiveAt: '2026-08-15T05:15:00.000Z', isCurrent: true },
];

export const adminAuditEventsFixture: readonly AuditEvent[] = [
  { id: 'audit-001', actorId: DEMO_SUPER_ADMIN_ID, targetStudentId: 'student-arjun-007', action: 'ACCOUNT_DISABLED', occurredAt: '2026-08-03T10:00:00.000Z', reason: 'Support review requested temporary account suspension.', before: { status: 'ACTIVE' }, after: { status: 'DISABLED' } },
];

export const adminContentCountsFixture: AdminContentCounts = {
  lessons: 3,
  packages: 0,
  subjects: 5,
  questions: 1,
  stages: 4,
  coupons: 0,
};

const last30Dates = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 17 + index));
  return date.toISOString().slice(0, 10);
});

export const adminRevenueSeriesFixture: readonly TimeSeriesPoint[] = last30Dates.map((date) => ({
  date,
  value: date === '2026-07-28' ? 40000 : 0,
}));

export const adminNewStudentSeriesFixture: readonly TimeSeriesPoint[] = last30Dates.map((date) => ({
  date,
  value: adminStudentsFixture.filter((student) => student.joinedAt.slice(0, 10) === date).length,
}));

export interface AdminFixtureState {
  students: Student[];
  orders: Order[];
  entitlements: Entitlement[];
  activity: Activity[];
  sessions: ActiveSession[];
  auditEvents: AuditEvent[];
}

export const createAdminFixtureState = (): AdminFixtureState => JSON.parse(JSON.stringify({
  students: adminStudentsFixture,
  orders: adminOrdersFixture,
  entitlements: adminEntitlementsFixture,
  activity: adminActivityFixture,
  sessions: adminSessionsFixture,
  auditEvents: adminAuditEventsFixture,
})) as AdminFixtureState;
