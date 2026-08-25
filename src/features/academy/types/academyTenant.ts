export type AcademyMemberRole = 'ACADEMY_ADMIN' | 'ACADEMY_TEACHER' | 'ACADEMY_STUDENT';
export type AcademyMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
export type AcademyStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export interface AcademyTenantInfo {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website?: string;
  description?: string;
  status: AcademyStatus;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  logoUrl?: string;
  studentCount: number;
  activeStudentCount: number;
  courseCount: number;
  activeCourseCount: number;
  createdAt: string;
}

export interface AcademyMember {
  id: string;
  academyId: string;
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  role: AcademyMemberRole;
  status: AcademyMembershipStatus;
  joinedAt: string;
  enrolledCourseCount?: number;
  purchaseCount?: number;
  totalSpentMinor?: number;
}


export interface AcademyCourseRecord {
  id: string;
  academyId: string;
  name: string;
  code: string;
  description: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  studentCount: number;
  contentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type AcademyContentKind = 'PDF' | 'NOTE' | 'IMAGE' | 'VIDEO';

export interface AcademyContentRecord {
  id: string;
  academyId: string;
  courseId: string;
  courseName?: string;
  title: string;
  description: string;
  kind: AcademyContentKind;
  mimeType: string;
  size: number;
  storagePath: string;
  displayOrder: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface AcademyQuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  html: string;
}

export interface AcademyQuestionRecord {
  id: string;
  academyId: string;
  courseId?: string;
  kind: 'MCQ' | 'DESCRIPTIVE';
  questionHtml: string;
  answerHtml: string;
  options: AcademyQuestionOption[];
  correctOptionId: AcademyQuestionOption['id'] | null;
  explanationHtml: string;
  difficulty: 'FOUNDATION' | 'INTERMEDIATE' | 'ADVANCED';
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export type AcademyBroadcastType =
  | 'GENERAL_ANNOUNCEMENT'
  | 'ACADEMIC_UPDATE'
  | 'EXAM_TEST'
  | 'COURSE_UPDATE'
  | 'CONTENT_UPDATE'
  | 'IMPORTANT_NOTICE'
  | 'ANNOUNCEMENT'
  | 'EXAM_ALERT';

export type AcademyBroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';

export interface AcademyBroadcastRecord {
  id: string;
  academyId: string;
  title: string;
  subtitle?: string;
  message: string;
  type: AcademyBroadcastType;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  platform?: 'ALL' | 'WEB' | 'MOBILE';
  audienceKind?: 'ALL_STUDENTS' | 'SPECIFIC_COURSE';
  courseId?: string;
  courseName?: string;
  attachmentName?: string;
  status: AcademyBroadcastStatus;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export interface AcademyOverviewMetrics {
  totalStudents: number;
  activeStudents: number;
  totalCourses: number;
  activeCourses: number;
  totalContent: number;
  totalQuestions: number;
  totalBroadcasts: number;
}
