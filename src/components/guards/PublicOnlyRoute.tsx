import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthorizedSuperAdmin, useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    if (isAuthorizedSuperAdmin(user)) return <Navigate to={ROUTES.ADMIN_OVERVIEW} replace />;
    if (user?.role === 'admin' || user?.role === 'academy_admin') return <Navigate to={ROUTES.ACADEMY_OVERVIEW} replace />;
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
};
