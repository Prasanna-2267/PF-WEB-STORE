import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
};
