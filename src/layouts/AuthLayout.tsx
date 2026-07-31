import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Mail, Linkedin, Instagram } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useThemeStore } from '@/app/store/useThemeStore';
import '@/features/home/theme.css';
import '@/features/home/footer.css';
import '@/features/home/login.css';

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode, toggleTheme } = useThemeStore();
  return (
    <div className="pf-auth">
      <header>
        <div className="pf-auth-header-left">
          <Link to={ROUTES.HOME_ALIAS} className="pf-brand">
            <img src="/logo.png" alt="Parallax Flow Logo" className="pf-brand__logo-img" />
            <span>Parallax Flow</span>
          </Link>
          <Link to={ROUTES.HOME_ALIAS} className="pf-auth-back-link">
            ← Back to Home
          </Link>
        </div>
        <button
          className="pf-theme-toggle-pill"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className={`pf-theme-pill-thumb ${mode}`} />
          <span className={`pf-theme-pill-icon ${mode === 'light' ? 'is-active' : ''}`}>
            <Sun size={14} />
          </span>
          <span className={`pf-theme-pill-icon ${mode === 'dark' ? 'is-active' : ''}`}>
            <Moon size={14} />
          </span>
        </button>
      </header>
      <main>
        <aside>
          <p>YOUR LEARNING SPACE</p>
          <h1>Understanding,<br /><em>made simple.</em></h1>
          <span>Everything you've learned, saved, and achieved—available whenever you return.</span>
        </aside>
        <section>{children}</section>
      </main>

      <footer className="pf-footer-pro">
        <div className="pf-footer-pro__main">
          <div className="pf-footer-pro__brand">
            <Link to={ROUTES.HOME} className="pf-brand">
              <img src="/logo.png" alt="Parallax Flow Logo" className="pf-brand__logo-img" />
              <span>Parallax Flow</span>
            </Link>
            <p className="pf-footer-pro__tagline">Shift Perspective. Unlock Potential.</p>
            <p className="pf-footer-pro__desc">
              One ecosystem. Endless possibilities to learn, grow, and explore.
            </p>
          </div>

          <div className="pf-footer-pro__cols">
            <div className="pf-footer-pro__col">
              <h4>Discover</h4>
              <a href="#" onClick={(e) => e.preventDefault()}>About Us</a>
              <a href="#" onClick={(e) => e.preventDefault()}>PALM</a>
            </div>

            <div className="pf-footer-pro__col">
              <h4>Explore</h4>
              <a href="#" onClick={(e) => e.preventDefault()}>Learning Platform</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Learning Resources</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Notes Store</a>
            </div>

            <div className="pf-footer-pro__col">
              <h4>Connect</h4>
              <a href="mailto:connect@parallaxflow.in">connect@parallaxflow.in</a>
              <a href="https://www.linkedin.com/company/parallax-flow/" target="_blank" rel="noreferrer">LinkedIn ↗</a>
              <a href="https://www.instagram.com/parallaxflow.in?utm_source=qr&igsh=N2U1YWh5Yzlud2Jn" target="_blank" rel="noreferrer">Instagram ↗</a>
            </div>
          </div>
        </div>

        <div className="pf-footer-pro__bottom">
          <div className="pf-footer-pro__legal">
            <span>© {new Date().getFullYear()} Parallax Learning Hub LLP. All rights reserved.</span>
          </div>
          <div className="pf-footer-pro__policies">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms of Use</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Refund Policy</a>
          </div>
        </div>
        <div className="pf-powered-by">
          <span>Powered by</span>
          <a href="http://neuralweblabs.com/" target="_blank" rel="noopener noreferrer">
            NeuralWeb Labs
          </a>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
