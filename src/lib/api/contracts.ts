export type UserRole = 'student' | 'admin' | 'academy_admin' | 'super_admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface SessionResult {
  user: AuthUser;
}

export interface AcademyContext {
  academyId: string;
  roleInAcademy: string;
  membershipId: string | null;
  permissions: string[];
}

export interface AcademyOverview {
  academy: {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone: string | null;
    status: string;
  };
  metrics: {
    studentCount: number;
    activeStudentCount: number;
    courseCount: number;
    activeCourseCount: number;
    contentCount: number;
    questionCount: number;
    activeBroadcastCount: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    timestamp: string;
  }>;
}

export interface AdminOverview {
  users: number;
  activeUsers: number;
  academies: number;
  courses: number;
  orders: number;
  paidRevenue: number;
  newStudentsThisWeek: number;
  metrics: {
    students: number;
    newStudentsThisWeek: number;
    totalRevenueMinor: number;
  };
  contentCounts: {
    lessons: number;
    packages: number;
    subjects: number;
    questions: number;
    stages: number;
    coupons: number;
  };
  courseMetrics: Array<{
    courseId: string | null;
    revenueMinor: number;
    students: number;
    paidOrders: number;
    failedOrders: number;
    refundedOrders: number;
    accessGranted: number;
    resources: Array<{ productId: string; title: string; revenueMinor: number; purchases: number }>;
  }>;
  recentOrders: Array<{
    id: string;
    courseId: string | null;
    amountMinor: number;
    currency: 'INR';
    status: 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
    refundStatus: 'NONE' | 'PARTIAL' | 'FULL';
    accessStatus: 'PENDING' | 'GRANTED' | 'REVOKED' | 'NOT_APPLICABLE';
    createdAt: string;
    paidAt: string | null;
    refundedAt: string | null;
    receiptNumber: string | null;
    paymentMethod: string | null;
    isComplimentary: boolean;
    buyer: { studentId: string; fullName: string; email: string };
    items: Array<{ title: string }>;
  }>;
}


export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
}
