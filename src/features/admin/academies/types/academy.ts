export type AcademyStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export interface AcademyCourseSummary {
  id: string;
  name: string;
  studentCount: number;
  status: 'ACTIVE' | 'DRAFT';
}

export interface AcademyStudentSummary {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INVITED';
}

export interface AcademyActivity {
  id: string;
  label: string;
  occurredAt: string;
}

export interface Academy {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  description: string;
  status: AcademyStatus;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  studentCount: number;
  activeStudentCount: number;
  courseCount: number;
  activeCourseCount: number;
  packageCount: number;
  orderCount: number;
  revenue: number;
  courses: AcademyCourseSummary[];
  students: AcademyStudentSummary[];
  recentActivity: AcademyActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface AcademyInput {
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
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  status?: AcademyStatus;
}
