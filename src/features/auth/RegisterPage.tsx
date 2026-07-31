import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/app/store/useAuthStore';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';

export const RegisterPage: React.FC = () => {
  const { login } = useAuthStore(); const navigate = useNavigate(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const password = String(data.get('password')); if (password !== String(data.get('confirmPassword'))) { setError('Passwords do not match.'); return; } setLoading(true); setError(''); try { const response = await authService.register({ fullName: String(data.get('fullName')), email: String(data.get('email')), password }); login(response.token, response.user); navigate(ROUTES.HOME, { replace: true }); } catch (err) { setError((err as Error).message || 'Unable to create your account.'); } finally { setLoading(false); } };
  return (
    <>
      <SeoHead title="Create Account | Parallax Flow" description="Create your Parallax Flow account for visual, adaptive learning experiences." canonicalPath="/register" />
      <div className="pf-auth-card"><p className="pf-auth-kicker">Account</p><h2>Start with clarity.</h2><p className="pf-auth-copy">Create one account for the web store, PALM Guide, and your Android library.</p><form onSubmit={submit}><label>Full name<input name="fullName" required placeholder="Your full name" /></label><label>Email address<input name="email" type="email" required placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required minLength={6} /></label><label>Confirm password<input name="confirmPassword" type="password" required minLength={6} /></label>{error && <p className="pf-auth-error">{error}</p>}<div className="pf-auth-btn-wrap"><button disabled={loading}>{loading ? 'Creating account…' : 'Create account'} <span>→</span></button></div></form><p className="pf-auth-switch">Already have an account? <Link to={ROUTES.LOGIN}>Sign in</Link></p></div>
    </>
  );
};
export default RegisterPage;
