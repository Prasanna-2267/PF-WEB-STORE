import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';
import { PRIVATE_ROBOTS } from '@/seo/siteMetadata';

export const ForgotPasswordPage: React.FC = () => {
  const [challengeId, setChallengeId] = useState('');
  const [changed, setChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);

    try {
      const challenge = await authService.requestPasswordReset(String(data.get('email')));
      setChallengeId(challenge.challengeId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The reset code could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('newPassword'));
    const confirmPassword = String(data.get('confirmPassword'));
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      setLoading(false);
      return;
    }
    try {
      await authService.confirmPasswordReset({ challengeId, code: String(data.get('code')).trim(), newPassword, confirmPassword });
      setChanged(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The password could not be changed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SeoHead
        title="Forgot Password | Parallax Flow"
        description="Reset your Parallax Flow account password securely and regain access to your learning journey."
        canonicalPath="/forgot-password"
        robots={PRIVATE_ROBOTS}
      />
      <div className="pf-auth-card">
        <p className="pf-auth-kicker">Account recovery</p>
        <h2>Reset your password.</h2>
        <p className="pf-auth-copy">
          Enter the email address connected to your Parallax Flow account.
        </p>
        {changed ? (
          <div className="pf-auth-success">
            <p>Your password has been changed. Sign in with your new password.</p>
            <Link to={ROUTES.LOGIN}>Return to sign in →</Link>
          </div>
        ) : challengeId ? (
          <form onSubmit={changePassword}>
            <label>
              Reset code
              <input name="code" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder="4-digit code" />
            </label>
            <label>
              Enter New Password
              <input name="newPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" />
            </label>
            <label>
              Confirm Password
              <input name="confirmPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" />
            </label>
            {error && <p className="pf-auth-error">{error}</p>}
            <button disabled={loading}>
              {loading ? 'Changing…' : 'Change password'} <span>→</span>
            </button>
            <button type="button" disabled={loading} onClick={() => { setChallengeId(''); setError(''); }}>
              Request another code
            </button>
          </form>
        ) : (
          <form onSubmit={requestCode}>
            <label>
              Email address
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            {error && <p className="pf-auth-error">{error}</p>}
            <button disabled={loading}>
              {loading ? 'Sending…' : 'Send reset code'} <span>→</span>
            </button>
          </form>
        )}
        <p className="pf-auth-switch">
          <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        </p>
      </div>
    </>
  );
};

export default ForgotPasswordPage;
