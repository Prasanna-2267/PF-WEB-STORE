import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicOnlyRoute } from '@/components/guards/PublicOnlyRoute';
import { RequireAuth } from '@/components/guards/RequireAuth';

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

const StoreLoading: React.FC = () => (
  <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f9ff', color: '#69717e', fontSize: 12 }}>
    Opening the Parallax Flow Store…
  </div>
);

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
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

        {/* All other endpoints redirect directly to Home */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
