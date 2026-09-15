import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';


export type AdminAccountStatus = 'ACTIVE' | 'DISABLED';
export type AdminAcademyStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'ARCHIVED';

export interface AdminAcademySummaryDto {
  totalAcademies: number;
  activeAcademies: number;
  pendingAcademies: number;
  suspendedAcademies: number;
  archivedAcademies: number;
  totalStudents: number;
  totalCourses: number;
}

export interface AdminAcademyFilters {
  page: number;
  limit: number;
  search?: string;
  status?: AdminAcademyStatus | 'ALL' | '';
  sort?: 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'students' | 'courses';
}

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageDto<T> {
  data: T[];
  pagination: PaginationDto;
}

interface AdminStudentDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: AdminAccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  role: { key: string; name: string };
}

interface AdminStudentDetailDto extends AdminStudentDto {
  updatedAt: string;
  role: {
    key: string;
    name: string;
    rolePermissions: Array<{ permission: { key: string } }>;
  };
  sessions: Array<{
    id: string;
    deviceName: string | null;
    platform: 'ANDROID' | 'WEB' | 'IOS' | 'UNKNOWN';
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }>;
  deviceBinding: {
    deviceName: string | null;
    platform: 'ANDROID' | 'WEB' | 'IOS' | 'UNKNOWN';
    boundAt: string;
    lastVerifiedAt: string;
    bindingVersion: number;
    resetApprovedAt: string | null;
    resetConsumedAt: string | null;
  } | null;
  academyMemberships: Array<{
    id: string;
    academyId: string;
    role: string;
    status: string;
    academy: { name: string; slug: string };
  }>;
  performanceInsights: PerformanceInsights;
}

export interface ConceptInsight { conceptName: string; chapterName: string; examName: string; courseId: string; courseName: string; attempts: number; correct: number; wrong: number; durationMs: number; accuracyPercent: number; lastAttemptAt: string }
export interface PerformanceInsights { minimumAttempts: number; weakConcepts: ConceptInsight[]; strongConcepts: ConceptInsight[] }

export interface AcademyProfileDto {
  onboardingStatus: string;
  createdById?: string;
  logoStoragePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyContactDto {
  id: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyLegalProfileDto {
  legalName: string | null;
  entityType: string;
  panStatus: string;
  pan: string | null;
  tan: string | null;
  gstStatus: string;
  gstin: string | null;
  gstState: string | null;
  gstRegistrationType: string | null;
  gstRegistrationDate: string | null;
  gstCertificateStoragePath: string | null;
  placeOfSupply: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyAddressDto {
  id: string;
  kind: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyBillingProfileDto {
  invoiceDisplayName: string | null;
  invoiceEmail: string | null;
  billingContactName: string | null;
  billingContactPhone: string | null;
  purchaseOrderRequired: boolean;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyAcademicOfferingDto {
  id: string;
  category: string;
  program: string | null;
  branch: string | null;
  batch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyCommercialProfileDto {
  planKey: string;
  subscriptionStatus: string;
  startDate: string;
  endDate: string | null;
  studentSeatLimit: number;
  purchasedSeats: number;
  activeSeats: number;
  additionalSeats: number;
  billingCycle: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademyIntegrationProfileDto {
  zohoOrganizationId: string | null;
  zohoCustomerId: string | null;
  zohoCustomerNumber: string | null;
  zohoContactId: string | null;
  zohoCustomerName: string | null;
  zohoSyncStatus: string;
  zohoLastSyncedAt: string | null;
  zohoLastSyncError: string | null;
  zohoSyncVersion: number;
  paymentCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_PERFORMANCE_INSIGHTS: PerformanceInsights = {
  minimumAttempts: 3,
  weakConcepts: [],
  strongConcepts: [],
};

export interface AdminAcademyDto {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  academyCode?: string | null;
  academyType?: string;
  establishedYear?: number | null;
  socialLinks?: unknown;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  description: string;
  logoUrl: string | null;
  status: AdminAcademyStatus;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  studentCount: number;
  activeStudentCount: number;
  courseCount: number;
  activeCourseCount: number;
  packageCount: number;
  orderCount: number;
  revenue: number | string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: { memberships: number; tenantCourses: number };
}

export interface AdminAcademyDetailDto extends AdminAcademyDto {
  profile: AcademyProfileDto | null;
  contacts: AcademyContactDto[];
  legalProfile: AcademyLegalProfileDto | null;
  addresses: AcademyAddressDto[];
  billingProfile: AcademyBillingProfileDto | null;
  academicOfferings: AcademyAcademicOfferingDto[];
  commercialProfile: AcademyCommercialProfileDto | null;
  integrationProfile: AcademyIntegrationProfileDto | null;
  metrics: {
    studentsCount: number;
    activeStudentsCount: number;
    coursesCount: number;
    publishedCoursesCount: number;
    contentCount: number;
    publishedContentCount: number;
    packagesCount: number;
    questionsCount: number;
    broadcastCount: number;
    activeBroadcastCount: number;
    auditLogCount: number;
    ordersCount: number;
    revenue: number;
  };
  administrator: {
    id: string | null;
    name: string;
    email: string;
    phone: string | null;
    identityStatus: AdminAccountStatus | null;
    membershipStatus: string;
  };
  admins: Array<{
    id: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string;
    user: { id: string; email: string; fullName: string; phone: string | null; status: AdminAccountStatus; lastLoginAt: string | null; createdAt: string };
  }>;
  students: Array<{
    id: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string;
    user: { id: string; email: string; fullName: string; phone: string | null; status: AdminAccountStatus; lastLoginAt: string | null; createdAt: string };
  }>;
  memberships: Array<{
    id: string;
    academyId: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string;
    user: { id: string; email: string; fullName: string; status: AdminAccountStatus };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    studentName: string;
    role: string;
    status: string;
    expiresAt: string | null;
    createdAt: string;
  }>;
  courses?: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: string;
  }>;
  tenantCourses: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    createdAt: string;
    _count?: { enrollments: number; contentItems: number; packages: number };
  }>;
  contentItems: Array<{
    id: string;
    name: string;
    kind: 'FOLDER' | 'FILE';
    mimeType: string | null;
    size: number;
    status: string;
    createdAt: string;
    course: { id: string; name: string };
  }>;
  questions: Array<{
    id: string;
    kind: string;
    status: string;
    difficulty: string;
    questionHtml: string;
    caseHtml: string;
    createdAt: string;
    course: { id: string; name: string } | null;
  }>;
  packages: Array<{
    id: string;
    title: string;
    price: number;
    status: string;
    createdAt: string;
    course: { id: string; name: string };
    _count?: { items: number };
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    user: { fullName: string; email: string };
  }>;
  broadcasts: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    publishedAt: string | null;
    createdAt: string;
  }>;
  admissions: Array<{
    id: string;
    email: string;
    studentName: string;
    method: 'BULK_IMPORT' | 'QR_CODE' | 'ADMISSION_CODE';
    status: string;
    failureReason: string | null;
    createdAt: string;
    completedAt: string | null;
    student: { id: string; fullName: string; email: string } | null;
    batch: { id: string; fileName: string } | null;
  }>;
  systemAuditLogs?: Array<{
    id: string;
    action: string;
    entityType: string;
    description: string;
    occurredAt: string;
    actor?: { id: string; fullName: string; email: string };
  }>;
}

export interface AdminStudentViewModel {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: AdminAccountStatus;
  roleKey: string;
  roleName: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminStudentDetailViewModel extends AdminStudentViewModel {
  updatedAt: string;
  permissions: string[];
  sessions: AdminStudentDetailDto['sessions'];
  deviceBinding: AdminStudentDetailDto['deviceBinding'];
  memberships: Array<{
    id: string;
    academyId: string;
    academyName: string;
    academySlug: string;
    role: string;
    status: string;
  }>;
  performanceInsights: PerformanceInsights;
}

export interface AdminAcademyViewModel {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  academyCode: string | null;
  academyType: string;
  establishedYear: number | null;
  socialLinks: unknown;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  description: string;
  logoUrl: string | null;
  status: AdminAcademyStatus;
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
  membershipCount: number | null;
  tenantCourseCount: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AdminAcademyDetailViewModel extends AdminAcademyViewModel {
  profile: AdminAcademyDetailDto['profile'];
  contacts: AdminAcademyDetailDto['contacts'];
  legalProfile: AdminAcademyDetailDto['legalProfile'];
  addresses: AdminAcademyDetailDto['addresses'];
  billingProfile: AdminAcademyDetailDto['billingProfile'];
  academicOfferings: AdminAcademyDetailDto['academicOfferings'];
  commercialProfile: AdminAcademyDetailDto['commercialProfile'];
  integrationProfile: AdminAcademyDetailDto['integrationProfile'];
  metrics: AdminAcademyDetailDto['metrics'];
  administrator: AdminAcademyDetailDto['administrator'];
  admins: AdminAcademyDetailDto['admins'];
  students: AdminAcademyDetailDto['students'];
  memberships: Array<AdminAcademyDetailDto['memberships'][number] & {
    name: string;
    email: string;
    accountStatus: AdminAccountStatus;
    membershipStatus: string;
  }>;
  invitations: AdminAcademyDetailDto['invitations'];
  courses: AdminAcademyDetailDto['tenantCourses'];
  tenantCourses: AdminAcademyDetailDto['tenantCourses'];
  contentItems: AdminAcademyDetailDto['contentItems'];
  questions: AdminAcademyDetailDto['questions'];
  packages: AdminAcademyDetailDto['packages'];
  orders: AdminAcademyDetailDto['orders'];
  broadcasts: AdminAcademyDetailDto['broadcasts'];
  admissions: AdminAcademyDetailDto['admissions'];
  systemAuditLogs: NonNullable<AdminAcademyDetailDto['systemAuditLogs']>;
}

export type AdminAcademyDetailResource = 'students' | 'courses' | 'content' | 'questions' | 'broadcasts' | 'admissions' | 'audit';

export interface AdminAcademyDetailResourceMap {
  students: AdminAcademyDetailDto['students'][number];
  courses: AdminAcademyDetailDto['tenantCourses'][number];
  content: AdminAcademyDetailDto['contentItems'][number];
  questions: AdminAcademyDetailDto['questions'][number];
  broadcasts: AdminAcademyDetailDto['broadcasts'][number];
  admissions: AdminAcademyDetailDto['admissions'][number];
  audit: NonNullable<AdminAcademyDetailDto['systemAuditLogs']>[number];
}

export interface AdminStudentFilters {
  page: number;
  limit: number;
  search?: string;
  status?: AdminAccountStatus;
  courseId?: string;
}



const cleanSearch = (value?: string) => value?.trim() || undefined;

export const adminReadOnlyKeys = {
  students: (userId: string, filters: AdminStudentFilters) =>
    ['admin', userId, 'students', { ...filters, search: cleanSearch(filters.search), courseId: cleanSearch(filters.courseId), role: 'student' }] as const,
  student: (userId: string, studentId: string) =>
    ['admin', userId, 'students', 'detail', studentId] as const,
  academiesSummary: (userId: string) =>
    ['admin', userId, 'academies', 'summary'] as const,
  academies: (userId: string, filters: AdminAcademyFilters) =>
    ['admin', userId, 'academies', { ...filters, search: cleanSearch(filters.search) }] as const,
  academy: (userId: string, academyId: string) =>
    ['admin', userId, 'academies', 'detail', academyId] as const,
  academyResource: (userId: string, academyId: string, resource: AdminAcademyDetailResource, page: number) =>
    ['admin', userId, 'academies', 'detail', academyId, resource, page] as const,
  entitlementResources: (userId: string, resourceType: EntitlementResourceType) =>
    ['admin', userId, 'entitlement-resources', resourceType] as const,
  studentGrantCatalog: (userId: string, studentId: string, courseId?: string) =>
    ['admin', userId, 'students', studentId, 'grant-access', courseId ?? 'courses'] as const,
};

export function adaptAdminStudent(dto: AdminStudentDto): AdminStudentViewModel {
  return {
    id: dto.id,
    name: dto.fullName,
    email: dto.email,
    phone: dto.phone,
    status: dto.status,
    roleKey: dto.role.key,
    roleName: dto.role.name,
    lastLoginAt: dto.lastLoginAt,
    createdAt: dto.createdAt,
  };
}

export function adaptAdminAcademy(dto: AdminAcademyDto): AdminAcademyViewModel {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    displayName: dto.displayName || dto.name,
    academyCode: dto.academyCode ?? null,
    academyType: dto.academyType || 'OTHER',
    establishedYear: dto.establishedYear ?? null,
    socialLinks: dto.socialLinks ?? null,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
    city: dto.city,
    state: dto.state,
    country: dto.country,
    postalCode: dto.postalCode,
    website: dto.website,
    description: dto.description,
    logoUrl: dto.logoUrl ?? null,
    status: dto.status,
    adminName: dto.adminName,
    adminEmail: dto.adminEmail,
    adminPhone: dto.adminPhone,
    studentCount: dto.studentCount ?? dto._count?.memberships ?? 0,
    activeStudentCount: dto.activeStudentCount ?? 0,
    courseCount: dto.courseCount ?? dto._count?.tenantCourses ?? 0,
    activeCourseCount: dto.activeCourseCount ?? 0,
    packageCount: dto.packageCount ?? 0,
    orderCount: dto.orderCount ?? 0,
    revenue: Number(dto.revenue ?? 0),
    membershipCount: dto._count?.memberships ?? null,
    tenantCourseCount: dto._count?.tenantCourses ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    deletedAt: dto.deletedAt ?? null,
  };
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export async function fetchAdminStudents(filters: AdminStudentFilters, signal?: AbortSignal) {
  const query = queryString({
    page: filters.page,
    limit: filters.limit,
    search: cleanSearch(filters.search),
    status: filters.status,
    role: 'student',
    courseId: cleanSearch(filters.courseId),
  });
  const result = await apiRequest<PageDto<AdminStudentDto>>(`/api/admin/students?${query}`, { signal });
  return { items: result.data.map(adaptAdminStudent), pagination: result.pagination };
}

export async function fetchAdminStudent(studentId: string, signal?: AbortSignal): Promise<AdminStudentDetailViewModel> {
  const result = await apiRequest<AdminStudentDetailDto>(`/api/admin/students/${encodeURIComponent(studentId)}`, { signal });
  const base = adaptAdminStudent(result);
  return {
    ...base,
    updatedAt: result.updatedAt,
    permissions: result.role.rolePermissions.map(({ permission }) => permission.key),
    sessions: result.sessions,
    deviceBinding: result.deviceBinding,
    memberships: result.academyMemberships.map((membership) => ({
      id: membership.id,
      academyId: membership.academyId,
      academyName: membership.academy.name,
      academySlug: membership.academy.slug,
      role: membership.role,
      status: membership.status,
    })),
    performanceInsights: result.performanceInsights ?? EMPTY_PERFORMANCE_INSIGHTS,
  };
}

export async function approveAdminStudentDeviceReset(studentId: string) {
  return apiRequest<{
    userId: string;
    state: 'AWAITING_FIRST_BINDING' | 'RESET_APPROVED';
    deviceName: string | null;
    platform: string | null;
    resetApprovedAt: string | null;
    expiresAt: string | null;
    message: string;
  }>(`/api/admin/students/${encodeURIComponent(studentId)}/device-reset/approve`, { method: 'POST' });
}

export async function permanentlyDeleteAdminStudent(studentId: string) {
  return apiRequest(`/api/admin/students/${encodeURIComponent(studentId)}`, { method: 'DELETE', body: { confirmation: 'PERMANENTLY DELETE' } });
}

export async function fetchAdminAcademiesSummary(signal?: AbortSignal): Promise<AdminAcademySummaryDto> {
  return apiRequest<AdminAcademySummaryDto>('/api/admin/academies/summary', { signal });
}

export async function fetchAdminAcademies(filters: AdminAcademyFilters, signal?: AbortSignal) {
  const query = queryString({
    page: filters.page,
    limit: filters.limit,
    search: cleanSearch(filters.search),
    status: filters.status,
    sort: filters.sort,
  });
  const result = await apiRequest<PageDto<AdminAcademyDto>>(`/api/admin/academies?${query}`, { signal });
  return { items: result.data.map(adaptAdminAcademy), pagination: result.pagination };
}

export async function fetchAdminAcademy(academyId: string, signal?: AbortSignal): Promise<AdminAcademyDetailViewModel> {
  const result = await apiRequest<AdminAcademyDetailDto>(`/api/admin/academies/${encodeURIComponent(academyId)}`, { signal });
  const base = adaptAdminAcademy(result);
  return {
    ...base,
    profile: result.profile ?? null,
    contacts: result.contacts || [],
    legalProfile: result.legalProfile ?? null,
    addresses: result.addresses || [],
    billingProfile: result.billingProfile ?? null,
    academicOfferings: result.academicOfferings || [],
    commercialProfile: result.commercialProfile ?? null,
    integrationProfile: result.integrationProfile ?? null,
    metrics: result.metrics,
    administrator: result.administrator ?? {
      id: null,
      name: result.adminName,
      email: result.adminEmail,
      phone: result.adminPhone || null,
      identityStatus: null,
      membershipStatus: 'INVITED',
    },
    admins: result.admins || [],
    students: result.students || [],
    memberships: (result.memberships || []).map((membership) => ({
      ...membership,
      name: membership.user.fullName,
      email: membership.user.email,
      accountStatus: membership.user.status,
      membershipStatus: membership.status,
    })),
    invitations: result.invitations || [],
    courses: result.tenantCourses || [],
    tenantCourses: result.tenantCourses || [],
    contentItems: result.contentItems || [],
    questions: result.questions || [],
    packages: result.packages || [],
    orders: result.orders || [],
    broadcasts: result.broadcasts || [],
    admissions: result.admissions || [],
    systemAuditLogs: result.systemAuditLogs || [],
  };
}

export async function fetchAdminAcademyDetailResource<T extends AdminAcademyDetailResource>(
  academyId: string,
  resource: T,
  page: number,
  signal?: AbortSignal,
): Promise<PageDto<AdminAcademyDetailResourceMap[T]>> {
  const query = queryString({ page, limit: 25 });
  return apiRequest<PageDto<AdminAcademyDetailResourceMap[T]>>(
    `/api/admin/academies/${encodeURIComponent(academyId)}/${resource}?${query}`,
    { signal },
  );
}

export function useAdminStudentsReadOnly(userId: string | null, filters: AdminStudentFilters) {
  return useQuery({
    queryKey: adminReadOnlyKeys.students(userId ?? 'anonymous', filters),
    queryFn: ({ signal }) => fetchAdminStudents(filters, signal),
    enabled: Boolean(userId),
  });
}

export function useAdminStudentReadOnly(userId: string | null, studentId?: string) {
  return useQuery({
    queryKey: adminReadOnlyKeys.student(userId ?? 'anonymous', studentId ?? 'missing'),
    queryFn: ({ signal }) => fetchAdminStudent(studentId!, signal),
    enabled: Boolean(userId && studentId),
  });
}

export function useAdminAcademiesSummary(userId: string | null) {
  return useQuery({
    queryKey: adminReadOnlyKeys.academiesSummary(userId ?? 'anonymous'),
    queryFn: ({ signal }) => fetchAdminAcademiesSummary(signal),
    enabled: Boolean(userId),
  });
}

export function useAdminAcademiesReadOnly(userId: string | null, filters: AdminAcademyFilters) {
  return useQuery({
    queryKey: adminReadOnlyKeys.academies(userId ?? 'anonymous', filters),
    queryFn: ({ signal }) => fetchAdminAcademies(filters, signal),
    enabled: Boolean(userId),
  });
}

export function useAdminAcademyReadOnly(userId: string | null, academyId?: string) {
  return useQuery({
    queryKey: adminReadOnlyKeys.academy(userId ?? 'anonymous', academyId ?? 'missing'),
    queryFn: ({ signal }) => fetchAdminAcademy(academyId!, signal),
    enabled: Boolean(userId && academyId),
    // Academy Admin and Super Admin write to the same academy-scoped records.
    // Keep this supervisory view current while it is open without maintaining a
    // second, denormalised copy of the academy's data.
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}

export function useAdminAcademyDetailResource<T extends AdminAcademyDetailResource>(
  userId: string | null,
  academyId: string | undefined,
  resource: T | undefined,
  page: number,
) {
  return useQuery({
    queryKey: adminReadOnlyKeys.academyResource(userId ?? 'anonymous', academyId ?? 'missing', resource ?? 'students', page),
    queryFn: ({ signal }) => fetchAdminAcademyDetailResource(academyId!, resource!, page, signal),
    enabled: Boolean(userId && academyId && resource),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}

// ---------------------------------------------------------------------------
// Phase 5C-2 Mutations
// ---------------------------------------------------------------------------

export async function mutateAdminStudentStatus(
  userId: string,
  status: 'ACTIVE' | 'DISABLED',
): Promise<{ id: string; status: AdminAccountStatus }> {
  return apiRequest<{ id: string; status: AdminAccountStatus }>(
    `/api/admin/students/${encodeURIComponent(userId)}/status`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
}

export function useUpdateAdminStudentStatus(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetUserId, status }: { targetUserId: string; status: 'ACTIVE' | 'DISABLED' }) =>
      mutateAdminStudentStatus(targetUserId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', userId ?? 'anonymous', 'students'],
      });
      queryClient.invalidateQueries({
        queryKey: adminReadOnlyKeys.student(userId ?? 'anonymous', variables.targetUserId),
      });
    },
  });
}


export async function mutateAdminAcademyStatus(
  academyId: string,
  status: 'PENDING' | 'SUSPENDED',
): Promise<AdminAcademyViewModel> {
  const action = status === 'SUSPENDED' ? 'suspend' : 'restore';
  const result = await apiRequest<AdminAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}/${action}`, {
    method: 'POST',
  });
  return adaptAdminAcademy(result);
}

export function useUpdateAdminAcademyStatus(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ academyId, status }: { academyId: string; status: 'PENDING' | 'SUSPENDED' }) =>
      mutateAdminAcademyStatus(academyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', userId ?? 'anonymous', 'academies'],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Student Session & Entitlement Management APIs
// ---------------------------------------------------------------------------

export type EntitlementResourceType = 'COURSE' | 'PACKAGE' | 'QUESTION_BANK' | 'LESSON' | 'PREMIUM_NOTES' | 'SUBJECT' | 'OTHER';

export interface AdminEntitlementDto {
  id: string;
  userId: string;
  resourceType: EntitlementResourceType;
  resourceTitle: string;
  accessType: 'PERMANENT' | 'TIME_LIMITED';
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  source: 'PURCHASE' | 'ADMIN_GRANT' | 'SUBSCRIPTION' | 'PROMOTION';
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  course: { id: string; name: string } | null;
}

export interface AdminEntitlementResourceDto {
  id: string;
  resourceType: EntitlementResourceType;
  title: string;
  subtitle: string;
}

export async function fetchAdminEntitlements(
  userId: string,
  signal?: AbortSignal,
): Promise<AdminEntitlementDto[]> {
  const query = queryString({ userId, source: 'ADMIN_GRANT' });
  const result = await apiRequest<PageDto<AdminEntitlementDto>>(`/api/admin/entitlements?${query}`, { signal });
  return result.data;
}

export async function fetchAdminEntitlementResources(
  resourceType: EntitlementResourceType,
  signal?: AbortSignal,
): Promise<AdminEntitlementResourceDto[]> {
  const query = queryString({ resourceType, limit: 100 });
  const result = await apiRequest<{ data: AdminEntitlementResourceDto[] }>(`/api/admin/entitlement-resources?${query}`, { signal });
  return result.data;
}

export type GrantAccessCategory = 'notes' | 'questionBanks' | 'bundles' | 'subscriptions';

export interface AdminGrantAccessResourceDto {
  id: string;
  title: string;
  subtitle: string;
}

export interface AdminGrantAccessCatalogDto {
  studentId: string;
  courses: Array<{ id: string; name: string; code: string }>;
  selectedCourseId: string | null;
  resources: Record<GrantAccessCategory, AdminGrantAccessResourceDto[]> | null;
  activeManualGrantIds: Record<GrantAccessCategory, string[]> | null;
}

export interface GrantStudentAccessInput {
  courseId: string;
  selections: Record<GrantAccessCategory, string[]>;
  expiresAt?: string | null;
}

export async function fetchAdminGrantAccessCatalog(studentId: string, courseId?: string, signal?: AbortSignal, scope: 'admin' | 'academy' = 'admin') {
  const query = queryString({ courseId });
  return apiRequest<AdminGrantAccessCatalogDto>(`/api/${scope}/students/${encodeURIComponent(studentId)}/grant-access/catalog${query ? `?${query}` : ''}`, { signal });
}

export async function mutateGrantStudentAccess(studentId: string, input: GrantStudentAccessInput, scope: 'admin' | 'academy' = 'admin') {
  return apiRequest<{ grantedCount: number; alreadyActiveCount: number; entitlements: AdminEntitlementDto[] }>(`/api/${scope}/students/${encodeURIComponent(studentId)}/grant-access`, { method: 'POST', body: input });
}

export async function mutateRevokeEntitlement(
  entitlementId: string,
  reason: string,
): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(
    `/api/admin/entitlements/${encodeURIComponent(entitlementId)}/revoke`,
    {
      method: 'POST',
      body: { reason },
    },
  );
}

export async function mutateRevokeAdminStudentSessions(
  userId: string,
): Promise<{ revokedSessions: number }> {
  return apiRequest<{ revokedSessions: number }>(
    `/api/admin/students/${encodeURIComponent(userId)}/sessions/revoke`,
    {
      method: 'POST',
    },
  );
}

export function useAdminEntitlements(userId: string | null, targetUserId?: string) {
  return useQuery({
    queryKey: ['admin', userId ?? 'anonymous', 'entitlements', targetUserId ?? 'missing'],
    queryFn: ({ signal }) => fetchAdminEntitlements(targetUserId!, signal),
    enabled: Boolean(userId && targetUserId),
  });
}

export function useAdminEntitlementResources(
  userId: string | null,
  resourceType: EntitlementResourceType,
  enabled = true,
) {
  return useQuery({
    queryKey: adminReadOnlyKeys.entitlementResources(userId ?? 'anonymous', resourceType),
    queryFn: ({ signal }) => fetchAdminEntitlementResources(resourceType, signal),
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
  });
}

export function useAdminGrantAccessCatalog(userId: string | null, studentId: string, courseId?: string, enabled = true, scope: 'admin' | 'academy' = 'admin') {
  return useQuery({
    queryKey: [scope, userId ?? 'anonymous', 'students', studentId, 'grant-access', courseId ?? 'courses'],
    queryFn: ({ signal }) => fetchAdminGrantAccessCatalog(studentId, courseId, signal, scope),
    enabled: Boolean(userId && studentId && enabled),
    staleTime: 15_000,
  });
}

export function useGrantStudentAccess(userId: string | null, studentId: string, scope: 'admin' | 'academy' = 'admin') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GrantStudentAccessInput) => mutateGrantStudentAccess(studentId, input, scope),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [scope, userId ?? 'anonymous', 'entitlements', studentId] });
      queryClient.invalidateQueries({ queryKey: [scope, userId ?? 'anonymous', 'students', studentId, 'grant-access'] });
    },
  });
}

export function useRevokeEntitlement(userId: string | null, targetUserId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entitlementId, reason }: { entitlementId: string; reason: string }) =>
      mutateRevokeEntitlement(entitlementId, reason),
    onSuccess: () => {
      if (targetUserId) {
        queryClient.invalidateQueries({
          queryKey: ['admin', userId ?? 'anonymous', 'entitlements', targetUserId],
        });
      }
    },
  });
}

export function useRevokeAdminStudentSessions(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => mutateRevokeAdminStudentSessions(targetUserId),
    onSuccess: (_, targetUserId) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', userId ?? 'anonymous', 'students'],
      });
      queryClient.invalidateQueries({
        queryKey: adminReadOnlyKeys.student(userId ?? 'anonymous', targetUserId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Academy Mutations & Hooks
// ---------------------------------------------------------------------------

export interface CreateAcademyInput {
  name: string;
  slug?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  website?: string;
  description?: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
}

export interface AcademyProvisioningInput {
  requestKey: string;
  academy: { name: string; displayName: string; type: 'CA_COACHING' | 'COMMERCE_COACHING' | 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY' | 'PROFESSIONAL_COACHING' | 'COMPETITIVE_EXAM' | 'OTHER' | (string & {}); email: string; phone: string; website?: string; description?: string; establishedYear?: number; socialLinks?: Record<string, string>; logoUploadId?: string };
  primaryAdmin: { fullName: string; email: string; mobile: string };
  contacts: Array<{ role: 'OWNER' | 'DIRECTOR' | 'ACADEMIC_HEAD' | 'OPERATIONS_MANAGER' | 'FINANCE' | 'IT_ADMIN' | 'OTHER' | (string & {}); fullName: string; email?: string; phone?: string }>;
  legal: { legalName?: string; entityType: 'INDIVIDUAL' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'TRUST' | 'SOCIETY' | 'EDUCATIONAL_INSTITUTION' | 'OTHER' | 'NOT_APPLICABLE' | (string & {}); panStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'NOT_APPLICABLE' | 'OTHER' | (string & {}); pan?: string; tan?: string; gstStatus: 'YES' | 'NO' | 'NOT_APPLICABLE' | 'OTHER' | (string & {}); gstin?: string; gstState?: string; gstRegistrationType?: 'REGULAR' | 'COMPOSITION' | 'OTHER' | (string & {}); gstRegistrationDate?: string; gstCertificateUploadId?: string; placeOfSupply?: string };
  addresses: { academy: AcademyProvisioningAddress; billingSameAsAcademy: boolean; billing?: AcademyProvisioningAddress };
  billing: { invoiceDisplayName?: string; invoiceEmail?: string; billingContactName?: string; billingContactPhone?: string; purchaseOrderRequired: boolean; currency: string };
  academic: { categories: string[]; programs: string[]; initialBranch?: string; initialBatch?: string };
  commercial: { planKey: string; subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | 'OTHER' | (string & {}); startDate: string; endDate?: string; studentSeatLimit: number; billingCycle: 'MONTHLY' | 'ANNUAL' | 'CUSTOM' | 'OTHER' | (string & {}) };
}
export interface AcademyProvisioningAddress { addressLine1: string; addressLine2?: string; city: string; state: string; country: string; postalCode: string }
export interface AcademyProvisioningResult { academy: AdminAcademyDto & { code: string; onboardingStatus: string }; administratorId: string; membershipId: string; invitationQueued: boolean }

export async function mutateCreateAdminAcademy(input: CreateAcademyInput | AcademyProvisioningInput) {
  return apiRequest<AcademyProvisioningResult>('/api/admin/academies', {
    method: 'POST',
    body: input,
  });
}

export async function mutateUpdateAdminAcademy(academyId: string, input: Partial<CreateAcademyInput>) {
  return apiRequest<AdminAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function mutateAcademyLifecycle(academyId: string, action: 'activate' | 'suspend' | 'archive' | 'restore' | 'delete') {
  return apiRequest<AdminAcademyDto>(`/api/admin/academies/${encodeURIComponent(academyId)}/${action}`, {
    method: 'POST',
  });
}

export function useCreateAdminAcademy(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAcademyInput | AcademyProvisioningInput) => mutateCreateAdminAcademy(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', userId ?? 'anonymous', 'academies'] });
    },
  });
}

export function useUpdateAdminAcademy(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ academyId, input }: { academyId: string; input: Partial<CreateAcademyInput> }) => mutateUpdateAdminAcademy(academyId, input),
    onSuccess: (_, { academyId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', userId ?? 'anonymous', 'academies'] });
      queryClient.invalidateQueries({ queryKey: adminReadOnlyKeys.academy(userId ?? 'anonymous', academyId) });
    },
  });
}

export function useAcademyLifecycle(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ academyId, action }: { academyId: string; action: 'activate' | 'suspend' | 'archive' | 'restore' | 'delete' }) => mutateAcademyLifecycle(academyId, action),
    onSuccess: (_, { academyId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', userId ?? 'anonymous', 'academies'] });
      queryClient.invalidateQueries({ queryKey: adminReadOnlyKeys.academy(userId ?? 'anonymous', academyId) });
    },
  });
}
