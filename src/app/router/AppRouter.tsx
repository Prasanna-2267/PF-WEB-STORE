import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicOnlyRoute } from '@/components/guards/PublicOnlyRoute';
import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireSuperAdmin } from '@/components/guards/RequireSuperAdmin';
import { PublicExperienceRoute } from '@/components/guards/PublicExperienceRoute';
import { RequireStudent } from '@/components/guards/RequireStudent';
import { RequireAcademyAdmin } from '@/components/guards/RequireAcademyAdmin';
import { IntegrationPendingPage } from '@/components/IntegrationPendingPage';

// Feature Pages
import HomePage from '@/features/home/HomePage';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';

const StoreLayout = lazy(() => import('@/features/store/StoreLayout'));
const StoreHomePage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreHomePage })));
const StoreCategoryPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreCategoryPage })));
const StoreProductPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreProductPage })));
const StoreCartPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreCartPage })));
const StoreCheckoutPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreCheckoutPage })));
const StorePurchasesPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StorePurchasesPage })));
const StoreProfilePage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreProfilePage })));
const StoreSuccessPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreSuccessPage })));
const StoreNotFoundPage = lazy(() => import('@/features/store/StorePages').then((module) => ({ default: module.StoreNotFoundPage })));

const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'));
const AdminOverviewPage = lazy(() => import('@/features/admin/LiveAdminOverviewPage'));
const AdminStudentsReadOnlyPage = lazy(() => import('@/features/admin/readOnly/AdminStudentsReadOnlyPages').then((module) => ({ default: module.AdminStudentsReadOnlyPage })));
const AdminStudentReadOnlyDetailPage = lazy(() => import('@/features/admin/readOnly/AdminStudentsReadOnlyPages').then((module) => ({ default: module.AdminStudentReadOnlyDetailPage })));
const AdminOrdersReadOnlyPage = lazy(() => import('@/features/admin/readOnly/AdminOrdersReadOnlyPages').then((module) => ({ default: module.AdminOrdersReadOnlyPage })));
const AdminOrderReadOnlyDetailPage = lazy(() => import('@/features/admin/readOnly/AdminOrdersReadOnlyPages').then((module) => ({ default: module.AdminOrderReadOnlyDetailPage })));
const AdminCoursesPage = lazy(() => import('@/features/admin/readOnly/AdminCoursesReadOnlyPages').then((module) => ({ default: module.AdminCoursesPage })));
const AdminContentPage = lazy(() => import('@/features/admin/content/ContentPage'));
const AdminPackagesPage = lazy(() => import('@/features/admin/packages/PackagesPage'));
const AdminCouponsPage = lazy(() => import('@/features/admin/coupons/CouponsPage'));
const AdminStoreManagementPage = lazy(() => import('@/features/admin/store-management/StoreManagementPage').then((module) => ({ default: module.StoreManagementPage })));
const AdminQuestionsPage = lazy(() => import('@/features/admin/questions/QuestionsPage'));
const AdminBroadcastPage = lazy(() => import('@/features/admin/broadcast/BroadcastPage'));
const AdminBroadcastDetailPage = lazy(() => import('@/features/admin/broadcast/BroadcastDetailsPage'));
const AdminAcademiesPage = lazy(() => import('@/features/admin/academies/AcademiesPage'));
const AdminAcademyDetailPage = lazy(() => import('@/features/admin/academies/AcademiesPage').then((m) => ({ default: m.AcademyDetailsPage })));

// Academy Tenant Portal Pages
const AcademyLayout = lazy(() => import('@/features/academy/AcademyLayout'));
const AcademyOverviewPage = lazy(() => import('@/features/academy/LiveAcademyOverviewPage'));
const AcademyAdmissionsPage = lazy(() => import('@/features/academy/admissions/AcademyAdmissionsPage'));
const AcademyStudentsReadOnlyPage = lazy(() => import('@/features/academy/readOnly/AcademyStudentsReadOnlyPages').then((module) => ({ default: module.AcademyStudentsReadOnlyPage })));
const AcademyStudentReadOnlyDetailPage = lazy(() => import('@/features/academy/readOnly/AcademyStudentsReadOnlyPages').then((module) => ({ default: module.AcademyStudentReadOnlyDetailPage })));
const AcademyCoursesReadOnlyPage = lazy(() => import('@/features/academy/readOnly/AcademyCoursesReadOnlyPages').then((module) => ({ default: module.AcademyCoursesReadOnlyPage })));
const AcademyCourseReadOnlyDetailPage = lazy(() => import('@/features/academy/readOnly/AcademyCoursesReadOnlyPages').then((module) => ({ default: module.AcademyCourseReadOnlyDetailPage })));
const AcademyContentPage = lazy(() => import('@/features/academy/content/AcademyContentPage'));
const AcademyQuestionsPage = lazy(() => import('@/features/academy/questions/AcademyQuestionsPage'));
const AcademyBroadcastPage = lazy(() => import('@/features/academy/broadcast/AcademyBroadcastPage'));
const StudentAdmissionView = lazy(() => import('@/features/student/admissions/StudentAdmissionView'));
const StudentQuestionsPage = lazy(() => import('@/features/student/questions/StudentQuestionsPage').then((m) => ({ default: m.StudentQuestionsPage })));

const StoreLoading: React.FC = () => (
  <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f9ff', color: '#69717e', fontSize: 12 }}>
    Opening the Parallax Flow Store…
  </div>
);

const AdminLoading: React.FC = () => (
  <div role="status" aria-live="polite" className="pf-admin-route-loader">
    <span aria-hidden="true" />
    <p>Opening the Admin Console&hellip;</p>
  </div>
);

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicExperienceRoute />}>
          {/* Main Landing Page */}
          <Route
            path={ROUTES.HOME}
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path={ROUTES.HOME_ALIAS}
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path={ROUTES.ABOUT}
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path={ROUTES.CONTACT}
            element={
              <PublicLayout>
                <HomePage />
              </PublicLayout>
            }
          />

          {/* Public Store discovery with guarded commerce/account routes */}
          <Route
            path={ROUTES.STORE}
            element={
              <Suspense fallback={<StoreLoading />}>
                <StoreLayout />
              </Suspense>
            }
          >
            <Route index element={<StoreHomePage />} />
            <Route path="category/:categorySlug" element={<StoreCategoryPage />} />
            <Route path="product/:productSlug" element={<StoreProductPage />} />
            <Route element={<RequireAuth />}>
              <Route path="cart" element={<StoreCartPage />} />
              <Route path="checkout" element={<StoreCheckoutPage />} />
              <Route path="checkout/success/:orderId" element={<StoreSuccessPage />} />
              <Route path="purchases" element={<StorePurchasesPage />} />
              <Route path="profile" element={<StoreProfilePage />} />
            </Route>
            <Route path="*" element={<StoreNotFoundPage />} />
          </Route>
        </Route>

        {/* Isolated Super Admin Console */}
        <Route element={<RequireSuperAdmin />}>
          <Route
            path={ROUTES.ADMIN}
            element={
              <Suspense fallback={<AdminLoading />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<Navigate to={ROUTES.ADMIN_OVERVIEW} replace />} />
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="students" element={<AdminStudentsReadOnlyPage />} />
            <Route path="students/:studentId" element={<AdminStudentReadOnlyDetailPage />} />
            <Route path="orders" element={<AdminOrdersReadOnlyPage />} />
            <Route path="orders/:orderId" element={<AdminOrderReadOnlyDetailPage />} />
            <Route path="courses" element={<AdminCoursesPage />} />
            <Route path="content" element={<AdminContentPage />} />
            <Route path="packages" element={<AdminPackagesPage />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="store-management" element={<AdminStoreManagementPage />} />
            <Route path="questions" element={<AdminQuestionsPage />} />
            <Route path="broadcast" element={<AdminBroadcastPage />} />
            <Route path="broadcast/:broadcastId" element={<AdminBroadcastDetailPage />} />
            <Route path="academies" element={<AdminAcademiesPage />} />
            <Route path="academies/:academyId" element={<AdminAcademyDetailPage />} />
            <Route path="account" element={<IntegrationPendingPage module="Account" />} />
            <Route path="settings" element={<IntegrationPendingPage module="Settings" />} />
            <Route path="*" element={<Navigate to={ROUTES.ADMIN_OVERVIEW} replace />} />
          </Route>
        </Route>

        {/* Auth Routes */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <PublicOnlyRoute>
              <AuthLayout>
                <LoginPage />
              </AuthLayout>
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTES.REGISTER}
          element={
            <PublicOnlyRoute>
              <AuthLayout>
                <RegisterPage />
              </AuthLayout>
            </PublicOnlyRoute>
          }
        />
        <Route
          path={ROUTES.FORGOT_PASSWORD}
          element={
            <PublicOnlyRoute>
              <AuthLayout>
                <ForgotPasswordPage />
              </AuthLayout>
            </PublicOnlyRoute>
          }
        />
        {/* Student Admission & Practice Experience Routes */}
        <Route element={<RequireStudent />}>
          <Route path="/student/join" element={<Suspense fallback={<AdminLoading />}><StudentAdmissionView /></Suspense>} />
          <Route path="/student/scan-qr" element={<Suspense fallback={<AdminLoading />}><StudentAdmissionView /></Suspense>} />
          <Route path="/student/practice" element={<Suspense fallback={<AdminLoading />}><StudentQuestionsPage /></Suspense>} />
          <Route path="/student/questions" element={<Suspense fallback={<AdminLoading />}><StudentQuestionsPage /></Suspense>} />
        </Route>

        {/* Academy Tenant Portal Routes */}
        <Route
          path="/academy"
          element={
            <RequireAcademyAdmin>
              <Suspense fallback={<AdminLoading />}>
                <AcademyLayout />
              </Suspense>
            </RequireAcademyAdmin>
          }
        >
          <Route index element={<Navigate to={ROUTES.ACADEMY_OVERVIEW} replace />} />
          <Route path="overview" element={<AcademyOverviewPage />} />
          <Route path="admissions" element={<AcademyAdmissionsPage />} />
          <Route path="students" element={<AcademyStudentsReadOnlyPage />} />
          <Route path="students/:studentId" element={<AcademyStudentReadOnlyDetailPage />} />
          <Route path="courses" element={<AcademyCoursesReadOnlyPage />} />
          <Route path="courses/:courseId" element={<AcademyCourseReadOnlyDetailPage />} />
          <Route path="courses/:courseId/content" element={<AcademyContentPage />} />
          <Route path="content" element={<AcademyContentPage />} />
          <Route path="questions" element={<AcademyQuestionsPage />} />
          <Route path="broadcast" element={<AcademyBroadcastPage />} />
        </Route>

        {/* All other endpoints redirect directly to Home */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
