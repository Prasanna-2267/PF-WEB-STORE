import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';

interface RequireAuthProps {
  children?: React.ReactNode;
}

export interface AuthReturnLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface AuthRedirectState {
  from: AuthReturnLocation;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { initialized, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!initialized) return null;

  if (!isAuthenticated) {
    const redirectState: AuthRedirectState = {
      from: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    };

    return <Navigate to={ROUTES.LOGIN} replace state={redirectState} />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default RequireAuth;
