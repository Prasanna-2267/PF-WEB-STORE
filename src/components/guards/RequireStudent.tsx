import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

export const RequireStudent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { initialized, isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  if (user?.role !== 'student') return <Navigate to={user?.role === 'super_admin' ? ROUTES.ADMIN_OVERVIEW : ROUTES.HOME} replace />;
  return children ? <>{children}</> : <Outlet />;
};
