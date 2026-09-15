import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';
import { PasswordField } from './PasswordField';

export const RegisterPage: React.FC = () => {
  const completeAuthentication = useAuthStore((state) => state.completeAuthentication);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password !== String(data.get('confirmPassword'))) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authService.register({
        fullName: String(data.get('fullName')),
        email: String(data.get('email')),
        password,
      });
      completeAuthentication(response);
      navigate(ROUTES.HOME, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Unable to create your account.');
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
      completeAuthentication(response);
      navigate(
        response.user.role === 'super_admin'
          ? ROUTES.ADMIN_OVERVIEW
          : response.user.role === 'admin' || response.user.role === 'academy_admin'
            ? ROUTES.ACADEMY_OVERVIEW
            : ROUTES.HOME,
        { replace: true },
      );
    } catch (err) {
      setError((err as Error).message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-up was cancelled or failed.');
  };

  return (
    <>
      <SeoHead
        title="Create Account | Parallax Flow"
        description="Create your Parallax Flow account for visual, adaptive learning experiences."
        canonicalPath="/register"
      />
      <div className="pf-auth-card">
        <p className="pf-auth-kicker">Account</p>
        <h2>Start with clarity.</h2>
        <p className="pf-auth-copy">
          Create one account for the web store, PALM Guide, and your Android library.
        </p>

        <div className="pf-auth-oauth-wrap" style={{ margin: '20px 0 16px', display: 'flex', justifyContent: 'center' }}>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ? (
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                shape="pill"
                theme="outline"
                text="signup_with"
                width="320"
              />
            </GoogleOAuthProvider>
          ) : <small>Google sign-up is not configured.</small>}
        </div>

        <div className="pf-auth-divider" style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: '12px', color: 'var(--muted, #888)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--line, rgba(255,255,255,0.1))' }} />
          <span>or with email</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--line, rgba(255,255,255,0.1))' }} />
        </div>

        <form onSubmit={submit}>
          <label>
            Full name
            <input name="fullName" required placeholder="Your full name" />
          </label>
          <label>
            Email address
            <input name="email" type="email" required placeholder="you@example.com" />
          </label>
          <PasswordField name="password" label="Password" required minLength={12} maxLength={128} autoComplete="new-password" />
          <PasswordField name="confirmPassword" label="Confirm password" required minLength={12} maxLength={128} autoComplete="new-password" />
          {error && <p className="pf-auth-error">{error}</p>}
          <div className="pf-auth-btn-wrap">
            <button disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'} <span>→</span>
            </button>
          </div>
        </form>
        <p className="pf-auth-switch">
          Already have an account? <Link to={ROUTES.LOGIN}>Sign in</Link>
        </p>
      </div>
    </>
  );
};

export default RegisterPage;
