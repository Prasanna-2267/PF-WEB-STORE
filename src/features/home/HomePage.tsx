import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BatteryFull,
  Bell,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Home as HomeIcon,
  Instagram,
  Linkedin,
  Mail,
  MoreHorizontal,
  Search,
  Signal,
  Sun,
  Moon,
  TrendingUp,
  Wifi,
} from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useThemeStore } from '@/app/store/useThemeStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import { SeoHead } from '@/seo/SeoHead';
import './theme.css';
import './navbar.css';
import './hero.css';
import './contact.css';
import './footer.css';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

const AndroidIcon: React.FC = () => (
  <svg className="pf-button__android" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M15.53 2.16 16.84.85a.5.5 0 0 0-.71-.71l-1.48 1.48A5.94 5.94 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.14a.5.5 0 0 0-.7.71l1.31 1.31A5.98 5.98 0 0 0 6 7h12c0-2-1-3.75-2.47-4.84ZM10 5H9V4h1v1Zm5 0h-1V4h1v1Zm5.5 3A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8Zm-17 0A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8ZM6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10Z"
    />
  </svg>
);

const SimpleHeroPhone: React.FC = () => (
  <div className="pf-simple-phone" aria-label="Parallax Flow Android app preview">
    <div className="pf-simple-phone__status">
      <span>19:08</span>
      <span className="pf-simple-phone__signals" aria-hidden="true"><Signal /><Wifi /><BatteryFull /></span>
    </div>
    <div className="pf-simple-phone__profile">
      <span className="pf-simple-phone__avatar">L</span>
      <p><small>Learning Space</small><strong>CA Intermediate</strong></p>
      <i><Search aria-hidden="true" /></i><i><Bell aria-hidden="true" /></i>
    </div>
    <h3>Welcome back, <b>Luna<span className="pf-status-dot" aria-hidden="true" /></b></h3>
    <p className="pf-simple-phone__journey">Let&apos;s continue your<br />learning journey.</p>
    <div className="pf-simple-phone__nav">
      <span><HomeIcon aria-hidden="true" />Home</span>
      <span><BookOpen aria-hidden="true" />Notes</span>
      <span><BrainCircuit aria-hidden="true" />Practice</span>
      <span><TrendingUp aria-hidden="true" />Tracker</span>
      <span><MoreHorizontal aria-hidden="true" />Library</span>
    </div>
  </div>
);

const HeroShowcase: React.FC = () => (
  <div
    className="pf-hero-showcase"
    aria-label="Parallax Flow Android learning experience"
    onPointerMove={(event) => {
      if (event.pointerType !== 'mouse') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 12;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
      event.currentTarget.style.setProperty('--hero-x', `${x.toFixed(2)}px`);
      event.currentTarget.style.setProperty('--hero-y', `${y.toFixed(2)}px`);
      event.currentTarget.style.setProperty('--phone-x', `${(x * 0.32).toFixed(2)}px`);
      event.currentTarget.style.setProperty('--phone-y', `${(y * 0.32).toFixed(2)}px`);
    }}
    onPointerLeave={(event) => {
      event.currentTarget.style.setProperty('--hero-x', '0px');
      event.currentTarget.style.setProperty('--hero-y', '0px');
      event.currentTarget.style.setProperty('--phone-x', '0px');
      event.currentTarget.style.setProperty('--phone-y', '0px');
    }}
  >
    <div className="pf-hero-rings" aria-hidden="true"><span /><span /><span /></div>
    <article className="pf-hero-panel pf-hero-panel--accounting"><span>Learning Insight</span><strong>Your optimal revision window is now.</strong></article>
    <article className="pf-hero-panel pf-hero-panel--tracker"><span>Retention Score</span><strong>91%</strong><small>Excellent long-term retention.</small></article>
    <article className="pf-hero-panel pf-hero-panel--palm"><span>Today’s Focus</span><strong>2 concepts</strong><small>Estimated time: 18 min</small></article>
    <div className="pf-hero-phone-wrap"><SimpleHeroPhone /></div>
    <div className="pf-phone-learning-panel">
      <article><span>AE</span><p><strong>Auditing and Ethics</strong><small>10 Chapters · Continue learning</small></p><b><ChevronRight aria-hidden="true" /></b></article>
      <article><span>CB</span><p><strong>Capital Budgeting</strong><small>Revision recommended by PALM</small></p><b><ChevronRight aria-hidden="true" /></b></article>
    </div>
  </div>
);

export const HomePage: React.FC = () => {
  const [showOpening, setShowOpening] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const reduceMotion = useReducedMotion();
  const { mode, toggleTheme } = useThemeStore();
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    const timer = window.setTimeout(() => setShowOpening(false), reduceMotion ? 300 : 2100);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);
  const location = useLocation();
  const navigate = useNavigate();
  const isContactPage = location.pathname === ROUTES.CONTACT;

  useEffect(() => {
    if (isContactPage && !showOpening) {
      const contactEl = document.getElementById('contact');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isContactPage, showOpening]);

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (location.pathname !== ROUTES.HOME_ALIAS) {
      navigate(ROUTES.HOME_ALIAS);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname);
      }
    }
    document.title = 'Parallax Flow';
    setMenuOpen(false);
  };

  const handleContactClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (location.pathname !== ROUTES.CONTACT) {
      navigate(ROUTES.CONTACT);
    } else {
      const contactEl = document.getElementById('contact');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
    document.title = 'Contact | Parallax Flow';
    setMenuOpen(false);
  };

  useEffect(() => {
    const contactEl = document.getElementById('contact');
    if (!contactEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.title = 'Contact | Parallax Flow';
          } else if (location.pathname === ROUTES.HOME) {
            document.title = 'Parallax Flow';
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(contactEl);
    return () => observer.disconnect();
  }, [location.pathname]);

  const isHomeAlias = location.pathname === ROUTES.HOME_ALIAS;

  return (
    <div className="pf-site">
      <SeoHead
        title={isContactPage ? 'Contact | Parallax Flow' : 'Parallax Flow'}
        description={isContactPage ? 'Send a message to Parallax Flow. Tell us how we can help.' : 'Learning, Designed Around You.'}
        canonicalPath={isContactPage ? '/contact' : isHomeAlias ? '/home' : '/'}
      />
      <AnimatePresence>
        {showOpening && (
          <motion.div
            className="pf-opening"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: 'easeInOut' }}
          >
            <motion.div
              className="pf-opening__lockup"
              initial={{ opacity: 0, y: 10, filter: 'blur(7px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: reduceMotion ? 0.01 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="pf-opening__word">Parallax Flow</p>
              <span className="pf-opening__line" aria-hidden="true" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showOpening && (
        <motion.header
          className="pf-nav"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link to={ROUTES.HOME} className="pf-brand" aria-label="Parallax Flow home">
            <img src="/logo.png" alt="Parallax Flow Logo" className="pf-brand__logo-img" />
            <span>Parallax Flow</span>
          </Link>
          <nav className="pf-nav__links" aria-label="Primary navigation">
            <a href="/home" onClick={handleHomeClick}>Home</a>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => e.preventDefault()}>About us</a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => e.preventDefault()}>PALM <sup>↗</sup></a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => e.preventDefault()}>Store <sup>↗</sup></a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <a href="#contact" onClick={handleContactClick}>Connect with us</a>
          </nav>
          <div className="pf-nav__utilities">
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
            {isAuthenticated ? (
              <button className="pf-nav__action" type="button" onClick={logout}>
                Sign Out
              </button>
            ) : (
              <Link to={ROUTES.LOGIN} className="pf-nav__action">
                Enter the Flow <span>↗</span>
              </Link>
            )}
          </div>
          <button className="pf-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation">
            <span /><span />
          </button>
        </motion.header>
      )}

      <AnimatePresence>
        {menuOpen && (
          <motion.nav className="pf-mobile-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <a href="/home" onClick={handleHomeClick}>Home</a>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>About us</a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>PALM ↗</a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>Store ↗</a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <a href="#contact" onClick={handleContactClick}>Connect with us</a>
            {isAuthenticated ? (
              <button className="pf-nav__action" type="button" onClick={() => { setMenuOpen(false); logout(); }}>
                Sign Out
              </button>
            ) : (
              <Link to={ROUTES.LOGIN} className="pf-nav__action" onClick={() => setMenuOpen(false)}>
                Enter the Flow <span>↗</span>
              </Link>
            )}
          </motion.nav>
        )}
      </AnimatePresence>

      <main>
        <section className="pf-hero" id="experience">
          <div className="pf-hero__copy">
            <motion.p className="pf-eyebrow" {...fadeUp}>THE SCIENCE OF KNOWLEDGE. THE ART OF LEARNING.</motion.p>
            <motion.h1 {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}>
              Learning,<br /><em>Designed Around You.</em>
            </motion.h1>
            <motion.p className="pf-hero__summary" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.16 }}>
              We transform authentic knowledge into structured, visual, and adaptive learning experiences that improve understanding, retention, and application without compromising educational integrity.
            </motion.p>
            <motion.div className="pf-hero__actions" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.24 }}>
              <button className="pf-button" type="button" onClick={() => setShowComingSoonModal(true)}>
                <span className="pf-button__label">Experience Parallax Flow <AndroidIcon /></span>
                <span aria-hidden="true">→</span>
              </button>
            </motion.div>
            <motion.div className="pf-hero__trust" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}><span>Personalised Learning</span><span>Actionable Insights</span><span>Growing Confidence</span></motion.div>
          </div>
          <motion.div
            className="pf-hero__showcase-wrap"
            initial={{ opacity: 0, y: 42, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: reduceMotion ? 0.01 : 1.25, delay: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroShowcase />
          </motion.div>
          <p className="pf-scroll-cue">Scroll to explore <span>↓</span></p>
        </section>

        <section className="pf-contact pf-section" id="contact">
          <motion.div className="pf-section-label" {...fadeUp}><span>01</span> Connect with us</motion.div>
          <div className="pf-contact__layout">
            <motion.div {...fadeUp}>
              <p className="pf-eyebrow">Let’s start a conversation</p>
              <h2>Send a message.<br /><em>Tell us how we can help.</em></h2>
              <form className="pf-contact__form" onSubmit={(event) => { event.preventDefault(); setShowModal(true); (event.target as HTMLFormElement).reset(); }}>
                <label>Your name<input required name="name" autoComplete="name" placeholder="Your full name" /></label>
                <label>Email address<input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></label>
                <label>How can we help?<textarea required name="message" rows={4} placeholder="Tell us about your question or feedback." /></label>
                <button className="pf-button" type="submit">Send message <span>→</span></button>
              </form>
            </motion.div>
            <motion.aside className="pf-contact__details" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.12 }}>
              <p className="pf-eyebrow">Connect with us</p>
              <div className="pf-contact__social-icons">
                <a href="mailto:connect@parallaxflow.in" aria-label="Email connect@parallaxflow.in" title="Email connect@parallaxflow.in">
                  <Mail aria-hidden="true" />
                </a>
                <a href="https://www.linkedin.com/company/parallax-flow/" target="_blank" rel="noreferrer" aria-label="LinkedIn profile" title="LinkedIn profile">
                  <Linkedin aria-hidden="true" />
                </a>
                <a href="https://www.instagram.com/parallaxflow.in?utm_source=qr&igsh=N2U1YWh5Yzlud2Jn" target="_blank" rel="noreferrer" aria-label="Instagram profile" title="Instagram profile">
                  <Instagram aria-hidden="true" />
                </a>
              </div>
            </motion.aside>
          </div>
        </section>

        <AnimatePresence>
          {showModal && (
            <motion.div
              className="pf-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            >
              <motion.div
                className="pf-modal-card"
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pf-modal-icon">✓</div>
                <h3>Message Received</h3>
                <p>Thank you for reaching out. We appreciate your patience while we review your message.</p>
                <button className="pf-button" type="button" onClick={() => setShowModal(false)}>
                  Close <span>→</span>
                </button>
              </motion.div>
            </motion.div>
          )}

          {showComingSoonModal && (
            <motion.div
              className="pf-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComingSoonModal(false)}
            >
              <motion.div
                className="pf-modal-card"
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="pf-modal-icon pf-modal-icon--coming">🚀</div>
                <h3>Coming Soon</h3>
                <p>The Parallax Flow Android App is currently in final preparation for its official Google Play Store launch.</p>
                <button className="pf-button" type="button" onClick={() => setShowComingSoonModal(false)}>
                  Got it <span>→</span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <button className="pf-footer-pro__app-btn" type="button" onClick={() => setShowComingSoonModal(true)}>
              <span>Download Android App</span>
              <span>↗</span>
            </button>
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

export default HomePage;
