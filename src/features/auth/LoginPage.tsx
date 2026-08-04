import React, { useState } from 'react';
import { Link, useLocation, useNavigate, type To } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';

const getSafeReturnDestination = (state: unknown): To => {
  const fallbackDestination: To = { pathname: ROUTES.HOME };

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

  return { pathname, search: safeSearch, hash: safeHash };
};

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore(); const navigate = useNavigate(); const location = useLocation();
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const destination = getSafeReturnDestination(location.state);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setLoading(true); setError(''); const data = new FormData(event.currentTarget); try { const response = await authService.login({ email: String(data.get('email')), password: String(data.get('password')), rememberMe: Boolean(data.get('remember')) }); login(response.token, response.user); navigate(destination, { replace: true }); } catch (err) { setError((err as Error).message || 'Unable to sign in.'); } finally { setLoading(false); } };
  return (
    <>
      <SeoHead title="Login | Parallax Flow" description="Sign in to your Parallax Flow account to access your personalized learning space." canonicalPath="/login" />
      <div className="pf-auth-card"><p className="pf-auth-kicker">Account</p><h2>Welcome Back.</h2><p className="pf-auth-copy">Your learning journey is just one sign-in away.</p><form onSubmit={submit}><label>Email address<input name="email" type="email" required placeholder="Enter your email address" /></label><label>Password<input name="password" type="password" required placeholder="Enter your password" /></label><div className="pf-auth-options"><label><input name="remember" type="checkbox" defaultChecked /> Remember me</label><Link to={ROUTES.FORGOT_PASSWORD}>Forgot password?</Link></div>{error && <p className="pf-auth-error">{error}</p>}<div className="pf-auth-btn-wrap"><button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <span>→</span></button></div></form><p className="pf-auth-switch">New here? <Link to={ROUTES.REGISTER}>Create your account.</Link></p></div>
    </>
  );
};
export default LoginPage;
