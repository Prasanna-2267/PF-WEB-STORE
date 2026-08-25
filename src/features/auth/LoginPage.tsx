import React, { useState } from 'react';
import { Link, useLocation, useNavigate, type To } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { authService } from '@/services/auth.service';
import {
  useAuthStore,
  type UserRole,
} from '@/app/store/useAuthStore';
import type { AuthResult } from '@/lib/api/contracts';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';

const ADMIN_OVERVIEW_PATH = '/admin/overview';

export const getSafeReturnDestination = (state: unknown, role: UserRole): To => {
  const fallbackDestination: To = {
    pathname: role === 'super_admin' ? ADMIN_OVERVIEW_PATH : (role === 'admin' || role === 'academy_admin') ? ROUTES.ACADEMY_OVERVIEW : ROUTES.HOME,
  };

  if (!state || typeof state !== 'object' || !('from' in state)) {
    return fallbackDestination;
  }

  const from = (state as { from?: unknown }).from;
  if (!from || typeof from !== 'object') {
    return fallbackDestination;
  }

  const { pathname, search, hash } = from as {
    pathname?: unknown;
    search?: unknown;
    hash?: unknown;
  };

  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(pathname)
  ) {
    return fallbackDestination;
  }

  const safeSearch =
    typeof search === 'string' &&
    (search === '' || search.startsWith('?')) &&
    !/[\u0000-\u001f\u007f]/.test(search)
      ? search
      : '';
  const safeHash =
    typeof hash === 'string' &&
    (hash === '' || hash.startsWith('#')) &&
    !/[\u0000-\u001f\u007f]/.test(hash)
      ? hash
      : '';

  const isSuperAdminDestination = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAcademyAdminDestination = pathname === '/academy' || pathname.startsWith('/academy/');

  if (role === 'super_admin') {
    return isSuperAdminDestination || isAcademyAdminDestination
      ? { pathname, search: safeSearch, hash: safeHash }
      : fallbackDestination;
  }

  if (role === 'admin' || role === 'academy_admin') {
    return isAcademyAdminDestination
      ? { pathname, search: safeSearch, hash: safeHash }
      : fallbackDestination;
  }

  return isSuperAdminDestination || isAcademyAdminDestination
    ? fallbackDestination
    : { pathname, search: safeSearch, hash: safeHash };
};

export const LoginPage: React.FC = () => {
  const completeAuthentication = useAuthStore((state) => state.completeAuthentication);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const completeLogin = (result: AuthResult) => {
    completeAuthentication(result);
    navigate(getSafeReturnDestination(location.state, result.user.role), { replace: true });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await authService.login({
        email: String(data.get('email')),
        password: String(data.get('password')),
        rememberMe: Boolean(data.get('remember')),
      });
      completeLogin(response);
    } catch (err) {
      setError((err as Error).message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    setError('');
    try {
      const response = await authService.googleLogin(credentialResponse.credential);
      completeLogin(response);
    } catch (err) {
      setError((err as Error).message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed.');
  };

  return (
    <>
      <SeoHead
        title="Login | Parallax Flow"
        description="Sign in to your Parallax Flow account to access your personalized learning space."
        canonicalPath="/login"
      />
      <div className="pf-auth-card">
        <p className="pf-auth-kicker">Account</p>
        <h2>Welcome Back.</h2>
        <p className="pf-auth-copy">Your learning journey is just one sign-in away.</p>

        <div className="pf-auth-oauth-wrap" style={{ margin: '20px 0 16px', display: 'flex', justifyContent: 'center' }}>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              shape="pill"
              theme="outline"
              text="signin_with"
              width="320"
            />
          ) : <small>Google sign-in is not configured.</small>}
        </div>

        <div className="pf-auth-divider" style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: '12px', color: 'var(--muted, #888)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--line, rgba(255,255,255,0.1))' }} />
          <span>or with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--line, rgba(255,255,255,0.1))' }} />
        </div>

        <form onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" required placeholder="Enter your email address" />
          </label>
          <label>
            Password
            <input name="password" type="password" required placeholder="Enter your password" />
          </label>
          <div className="pf-auth-options">
            <label>
              <input name="remember" type="checkbox" defaultChecked /> Remember me
            </label>
            <Link to={ROUTES.FORGOT_PASSWORD}>Forgot password?</Link>
          </div>
          {error && <p className="pf-auth-error">{error}</p>}
          <div className="pf-auth-btn-wrap">
            <button disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'} <span>→</span>
            </button>
          </div>
        </form>
        <p className="pf-auth-switch">
          New here? <Link to={ROUTES.REGISTER}>Create your account.</Link>
        </p>
      </div>
    </>
  );
};

export default LoginPage;
