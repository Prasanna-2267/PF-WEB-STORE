import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  useAuthStore,
  isAuthorizedSuperAdmin,
  type AdminPermission,
} from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

interface RequireSuperAdminProps {
  children?: React.ReactNode;
  requiredPermission?: AdminPermission;
}

/**
 * Client-side route protection for navigation and presentation only. Every
 * production admin API must independently validate the server-backed session,
 * SUPER_ADMIN role, and required permission before returning or mutating data.
 */
export const RequireSuperAdmin: React.FC<RequireSuperAdminProps> = ({
  children,
  requiredPermission,
}) => {
  const { initialized, isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!initialized) return null;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  const isAuthorized = isAuthorizedSuperAdmin(user);
  const hasPermission = !requiredPermission || Boolean(user?.permissions.includes(requiredPermission));

  if (!isAuthorized || !hasPermission) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireSuperAdmin;
