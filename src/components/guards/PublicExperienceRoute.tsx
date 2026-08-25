import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthorizedSuperAdmin, useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

interface PublicExperienceRouteProps {
  children?: React.ReactNode;
}

/** Keeps privileged identities inside their server-authorized workspaces. */
export const PublicExperienceRoute: React.FC<PublicExperienceRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && isAuthorizedSuperAdmin(user)) {
    return <Navigate to={ROUTES.ADMIN_OVERVIEW} replace />;
  }
  if (isAuthenticated && (user?.role === 'admin' || user?.role === 'academy_admin')) {
    return <Navigate to={ROUTES.ACADEMY_OVERVIEW} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PublicExperienceRoute;
