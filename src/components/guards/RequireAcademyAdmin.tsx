import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { ROUTES } from '@/config/routes';

const ContextMessage: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#090d16', color: '#f8fafc', padding: '2rem' }}>
    <div style={{ maxWidth: 480, textAlign: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '2.5rem' }}>
      <ShieldAlert size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
      <h2 style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>{title}</h2>
      <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>{message}</p>
    </div>
  </div>
);

export const RequireAcademyAdmin: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { initialized, isAuthenticated, user } = useAuthStore();
  const { context, status, errorCode, errorMessage, resolveContext, clearTenantState } = useAcademyTenantStore();
  const location = useLocation();

  useEffect(() => {
    if (initialized && isAuthenticated && (user?.role === 'admin' || user?.role === 'academy_admin' || user?.role === 'super_admin') && status === 'idle') {
      void resolveContext();
    }
  }, [initialized, isAuthenticated, user?.role, status, resolveContext]);

  useEffect(() => {
    if (!isAuthenticated && status !== 'idle') clearTenantState();
  }, [isAuthenticated, status, clearTenantState]);

  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  if (user?.role !== 'admin' && user?.role !== 'academy_admin' && user?.role !== 'super_admin') {
    return <ContextMessage title="Access Restricted (403)" message="The authenticated server session does not grant Academy administration access." />;
  }
  if (status === 'idle' || status === 'loading') {
    return <ContextMessage title="Resolving Academy" message="Verifying your Academy membership with the server…" />;
  }
  if (status === 'error') {
    const invalidMemberships = errorCode === 'ACADEMY_ADMIN_SINGLE_TENANT_REQUIRED';
    return <ContextMessage title={invalidMemberships ? 'Academy Membership Configuration Error' : 'Academy Access Unavailable'} message={errorMessage ?? 'The server did not authorize an Academy context.'} />;
  }
  if (!context || context.roleInAcademy !== 'ACADEMY_ADMIN') {
    return <ContextMessage title="Access Restricted (403)" message="The server did not authorize an Academy Admin membership." />;
  }
  return children ? <>{children}</> : <Outlet />;
};

export default RequireAcademyAdmin;
