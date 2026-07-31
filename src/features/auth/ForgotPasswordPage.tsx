import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';

export const ForgotPasswordPage: React.FC = () => {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      await authService.requestPasswordReset(String(data.get('email')));
      setSent(true);
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
      />
      <div className="pf-auth-card">
        <p className="pf-auth-kicker">Account recovery</p>
        <h2>Reset your password.</h2>
        <p className="pf-auth-copy">
          Enter the email address connected to your Parallax Flow account.
        </p>
        {sent ? (
          <div className="pf-auth-success">
            <p>Reset instructions are on their way.</p>
            <Link to={ROUTES.LOGIN}>Return to sign in →</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email address
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            <button disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'} <span>→</span>
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
