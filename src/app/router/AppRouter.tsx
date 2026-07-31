import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicOnlyRoute } from '@/components/guards/PublicOnlyRoute';

// Feature Pages
import HomePage from '@/features/home/HomePage';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';

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
          path={ROUTES.CONTACT}
          element={
            <PublicLayout>
              <HomePage />
            </PublicLayout>
          }
        />

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
