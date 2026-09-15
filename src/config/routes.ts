/**
 * Strictly Typed Route Registry
 */
export const ROUTES = {
  // Public Landing Page
  HOME: '/',
  HOME_ALIAS: '/home',
  ABOUT: '/about',
  CONTACT: '/contact',

  // Store
  STORE: '/store',
  STORE_CATEGORY: '/store/category/:categorySlug',
  STORE_PRODUCT: '/store/product/:productSlug',
  STORE_CART: '/store/cart',
  STORE_CHECKOUT: '/store/checkout',
  STORE_SUCCESS: '/store/checkout/success/:orderId',
  STORE_PROFILE: '/store/profile',
  STORE_PURCHASES: '/store/purchases',

  // Super Admin Console
  ADMIN: '/admin',
  ADMIN_OVERVIEW: '/admin/overview',
  ADMIN_STUDENTS: '/admin/students',
  ADMIN_STUDENT: '/admin/students/:studentId',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_COURSES: '/admin/courses',
  ADMIN_CONTENT: '/admin/content',
  ADMIN_PACKAGES: '/admin/packages',
  ADMIN_COUPONS: '/admin/coupons',
  ADMIN_QUESTIONS: '/admin/questions',
  ADMIN_BROADCAST: '/admin/broadcast',
  ADMIN_BROADCAST_DETAILS: '/admin/broadcast/:broadcastId',
  ADMIN_ACADEMIES: '/admin/academies',
  ADMIN_ACADEMY: '/admin/academies/:academyId',

  // Academy Tenant Portal
  ACADEMY: '/academy',
  ACADEMY_OVERVIEW: '/academy/overview',
  ACADEMY_ADMISSIONS: '/academy/admissions',
  ACADEMY_STUDENTS: '/academy/students',
  ACADEMY_STUDENT: '/academy/students/:studentId',
  ACADEMY_COURSES: '/academy/courses',
  ACADEMY_COURSE_NEW: '/academy/courses/new',
  ACADEMY_COURSE: '/academy/courses/:courseId',
  ACADEMY_COURSE_CONTENT: '/academy/courses/:courseId/content',
  ACADEMY_CONTENT: '/academy/content',
  ACADEMY_QUESTIONS: '/academy/questions',
  ACADEMY_BROADCAST: '/academy/broadcast',
  ACADEMY_SETTINGS: '/academy/settings',

  // Student Admission Experience
  STUDENT_JOIN: '/student/join',
  STUDENT_SCAN_QR: '/student/scan-qr',

  // Public Only Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
} as const;

const encodeStoreSlug = (slug: string): string => {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error('Store route slugs cannot be empty.');
  }

  return encodeURIComponent(normalizedSlug);
};

export type StoreCategoryPath = `/store/category/${string}`;
export type StoreProductPath = `/store/product/${string}`;

export const buildStoreCategoryPath = (categorySlug: string): StoreCategoryPath =>
  `/store/category/${encodeStoreSlug(categorySlug)}`;

export const buildStoreProductPath = (productSlug: string): StoreProductPath =>
  `/store/product/${encodeStoreSlug(productSlug)}`;

export type AdminStudentPath = `/admin/students/${string}`;

export const buildAdminStudentPath = (studentId: string): AdminStudentPath => {
  const normalizedId = studentId.trim();

  if (!normalizedId) {
    throw new Error('Admin student ids cannot be empty.');
  }

  return `/admin/students/${encodeURIComponent(normalizedId)}`;
};

export type AdminAcademyPath = `/admin/academies/${string}`;

export const buildAdminAcademyPath = (academyId: string): AdminAcademyPath => {
  const normalizedId = academyId.trim();

  if (!normalizedId) {
    throw new Error('Admin academy ids cannot be empty.');
  }

  return `/admin/academies/${encodeURIComponent(normalizedId)}`;
};

export type AdminBroadcastPath = `/admin/broadcast/${string}`;

export const buildAdminBroadcastPath = (broadcastId: string): AdminBroadcastPath => {
  const normalizedId = broadcastId.trim();

  if (!normalizedId) {
    throw new Error('Admin broadcast ids cannot be empty.');
  }

  return `/admin/broadcast/${encodeURIComponent(normalizedId)}`;
};

export type AcademyStudentPath = `/academy/students/${string}`;
export const buildAcademyStudentPath = (studentId: string): AcademyStudentPath => {
  const normalizedId = studentId.trim();
  if (!normalizedId) throw new Error('Academy student ids cannot be empty.');
  return `/academy/students/${encodeURIComponent(normalizedId)}`;
};

export type AcademyCoursePath = `/academy/courses/${string}`;
export const buildAcademyCoursePath = (courseId: string): AcademyCoursePath => {
  const normalizedId = courseId.trim();
  if (!normalizedId) throw new Error('Academy course ids cannot be empty.');
  return `/academy/courses/${encodeURIComponent(normalizedId)}`;
};

export type AcademyCourseContentPath = `/academy/courses/${string}/content`;
export const buildAcademyCourseContentPath = (courseId: string): AcademyCourseContentPath => {
  const normalizedId = courseId.trim();
  if (!normalizedId) throw new Error('Academy course ids cannot be empty.');
  return `/academy/courses/${encodeURIComponent(normalizedId)}/content`;
};

export type RouteKey = keyof typeof ROUTES;

export type RoutePath = typeof ROUTES[RouteKey];
