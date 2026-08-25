import React, { useEffect, useRef, useState } from 'react';
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
import './about.css';
import './contact.css';
import './footer.css';
import './responsive.css';

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

const aboutStages = [
  {
    number: '01',
    tag: 'Our story',
    title: 'Curiosity Changed Everything',
    content: (
      <>
        <p>Every meaningful journey begins with curiosity.</p>
        <p>When classrooms moved online during the pandemic, one question quietly remained:</p>
        <p className="pf-about-card__question">Why do some lessons feel unnecessarily difficult to understand?</p>
        <p>Instead of accepting complexity, concepts were redesigned into colourful notes, structured explanations, and visual presentations that helped friends understand naturally.</p>
        <p>It wasn&apos;t the beginning of a company.</p>
        <p className="pf-about-card__emphasis">It was the beginning of a question.</p>
      </>
    ),
    image: '/images/about/01-curiosity.jpg',
    imageAlt: 'An open book shaped into a question mark beside a glass sphere.',
  },
  {
    number: '02',
    tag: 'Shared learning',
    title: 'Understanding Became a Shared Experience',
    content: (
      <>
        <p>One discovery changed everything.</p>
        <p>Students rarely remembered isolated facts.</p>
        <p>They remembered stories.</p>
        <p>Lessons became <span className="pf-about-card__emphasis">narratives</span>.</p>
        <p>Concepts became <span className="pf-about-card__emphasis">journeys</span>.</p>
        <p>Entire chapters unfolded like connected <span className="pf-about-card__emphasis">scenes instead</span> of disconnected pages.</p>
        <p>As those visual presentations were shared through online sessions and collaborative learning, they gradually reached hundreds of learners.</p>
        <p>Knowledge hadn&apos;t changed.</p>
        <p className="pf-about-card__emphasis">Its presentation—and its reach—had.</p>
      </>
    ),
    image: '/images/about/02-shared-understanding.jpg',
    imageAlt: 'Glass lenses bringing the ideas on two study pages into focus.',
  },
  {
    number: '03',
    tag: 'Design philosophy',
    title: 'Learning Needed to\nEvolve',
    content: (
      <>
        <p>Professional education revealed a deeper challenge.</p>
        <p>Finding information was easy.</p>
        <p>Understanding it wasn&apos;t.</p>
        <p>Thousands of pages.</p>
        <p>Dense theory.</p>
        <p>Endless revision.</p>
        <p>The solution wasn&apos;t removing knowledge.</p>
        <p>It was redesigning how knowledge was experienced.</p>
        <ul>
          <li>Visual architecture.</li>
          <li>Infographics.</li>
          <li>Meaningful layouts.</li>
          <li>Better connections.</li>
        </ul>
        <p>Every page was designed to preserve academic integrity while making learning intuitive.</p>
      </>
    ),
    image: '/images/about/03-learning-evolved.jpg',
    imageAlt: 'Paper layers transforming into an adaptive ribbon around a blue sphere.',
  },
  {
    number: '04',
    tag: 'Evolution',
    title: 'From Learners to\nan Ecosystem',
    content: (
      <>
        <p>The ideas were first tested with learners.</p>
        <p>The response remained remarkably consistent.</p>
        <div className="pf-about-card__cadence">
          <span>Concepts became clearer.</span>
          <span>Revision became faster.</span>
          <span>Confidence grew stronger.</span>
        </div>
        <p>That validation revealed something bigger.</p>
        <p>With technology, these ideas evolved into an adaptive learning ecosystem bringing together:</p>
        <ul>
          <li>Resources</li>
          <li>Progress Tracking</li>
          <li>Revision Planning</li>
          <li>Practice Questions</li>
          <li>Learning Analytics</li>
        </ul>
        <p>Technology wasn&apos;t replacing education.</p>
        <p className="pf-about-card__emphasis">It was extending its reach.</p>
      </>
    ),
    image: '/images/about/04-ecosystem.jpg',
    imageAlt: 'A connected ecosystem of learning objects arranged around one center.',
  },
  {
    number: '05',
    tag: 'Our vision',
    title: 'One Philosophy.\nInfinite Learning Journeys.',
    content: (
      <>
        <p>One final realization shaped the future.</p>
        <p>Better learning should never be a privilege.</p>
        <p>Every learner deserves a better way to understand knowledge—</p>
        <p>regardless of age, institution, discipline, or destination.</p>
        <p>Years of observations, experiments, and conversations converged into one vision.</p>
        <p>That vision became <span className="pf-about-card__emphasis">Parallax Flow</span>.</p>
        <div className="pf-about-card__cadence">
          <span>Knowledge remains constant.</span>
          <span>Learners do not.</span>
        </div>
        <p>Our responsibility is not to change knowledge.</p>
        <p>It is to transform the way it is experienced.</p>
      </>
    ),
    image: '/images/about/05-infinite-journeys.jpg',
    imageAlt: 'Multiple glass paths flowing from one origin across a paper landscape.',
  },
] as const;

const AboutCardStack: React.FC<{ reduceMotion: boolean | null }> = ({ reduceMotion }) => {
  const [activeStage, setActiveStage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const cardHovered = useRef(false);
  const wheelDistance = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const transitionLocked = useRef(false);
  const transitionTimer = useRef<number | null>(null);
  const lastStage = aboutStages.length - 1;
  const stage = aboutStages[activeStage];
  const stackedStages = [
    ...aboutStages.slice(activeStage + 1),
    ...aboutStages.slice(0, activeStage),
  ].slice(0, 3);

  const moveStage = (direction: 1 | -1) => {
    if (transitionLocked.current) return;
    transitionLocked.current = true;
    setActiveStage((current) => Math.min(lastStage, Math.max(0, current + direction)));
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      transitionLocked.current = false;
    }, reduceMotion ? 40 : 760);
  };

  const jumpToStage = (stageNumber: string) => {
    const targetStage = aboutStages.findIndex((item) => item.number === stageNumber);
    if (targetStage < 0 || targetStage === activeStage) return;
    transitionLocked.current = false;
    wheelDistance.current = 0;
    setActiveStage(targetStage);
  };

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onWheel = (event: WheelEvent) => {
      if (!cardHovered.current) return;
      if (!event.deltaY) return;
      const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
      const canMove = direction > 0 ? activeStage < lastStage : activeStage > 0;

      if (canMove) {
        event.preventDefault();
        event.stopPropagation();
        if (transitionLocked.current) return;
        wheelDistance.current += event.deltaY;

        if (Math.abs(wheelDistance.current) >= 34) {
          moveStage(direction);
          wheelDistance.current = 0;
        }
        return;
      }

      wheelDistance.current = 0;
    };

    card.addEventListener('wheel', onWheel, { passive: false });
    return () => card.removeEventListener('wheel', onWheel);
  }, [activeStage, lastStage, reduceMotion]);

  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      if (activeStage < lastStage) {
        event.preventDefault();
        moveStage(1);
      }
    }

    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      if (activeStage > 0) {
        event.preventDefault();
        moveStage(-1);
      }
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartY.current;
    const endY = event.changedTouches[0]?.clientY;
    touchStartY.current = null;
    if (startY === null || endY === undefined) return;

    const distance = startY - endY;
    if (Math.abs(distance) < 42) return;
    if (distance > 0 && activeStage < lastStage) moveStage(1);
    if (distance < 0 && activeStage > 0) moveStage(-1);
  };

  return (
    <div className="pf-about-stack-shell">
      <div
        className={`pf-about-stack${activeStage === lastStage ? ' is-final-stage' : ''}${isHovered ? ' is-hovered' : ''}`}
        role="region"
        aria-label={`About Parallax Flow, stage ${activeStage + 1} of ${aboutStages.length}`}
      >
        <div className="pf-about-stack__glow" aria-hidden="true" />
        {[...stackedStages].reverse().map((stackedStage, reverseIndex) => {
          const depth = stackedStages.length - reverseIndex;
          return (
            <motion.button
              key={`stack-${stackedStage.number}`}
              type="button"
              className="pf-about-card-layer"
              initial={reduceMotion ? false : { opacity: 0, y: -20 - depth * 12, scale: 0.96 }}
              whileInView={reduceMotion ? undefined : { opacity: .92 - depth * .08, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              whileHover={reduceMotion ? undefined : { scale: 1.003 }}
              whileTap={reduceMotion ? undefined : { scale: .997 }}
              transition={{ duration: reduceMotion ? .01 : .7, delay: reduceMotion ? 0 : depth * 0.09, ease: [0.22, 1, 0.36, 1] }}
              style={{ zIndex: 4 - depth }}
              data-depth={depth}
              onClick={() => jumpToStage(stackedStage.number)}
              aria-label={`Open stage ${stackedStage.number}: ${stackedStage.title}`}
            >
              <span>{stackedStage.number}</span>
              <strong>{stackedStage.title}</strong>
            </motion.button>
          );
        })}
        <motion.article
          ref={cardRef}
          className={`pf-about-card${activeStage === lastStage ? ' is-final' : ''}`}
          tabIndex={0}
          initial={reduceMotion ? false : { opacity: 0, y: 45, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          whileHover={reduceMotion ? undefined : { y: -8, scale: 1.009 }}
          transition={{ duration: reduceMotion ? .01 : 0.75, ease: [0.22, 1, 0.36, 1] }}
          onMouseEnter={() => {
            cardHovered.current = true;
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            cardHovered.current = false;
            setIsHovered(false);
            wheelDistance.current = 0;
          }}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: activeStage === lastStage ? 'pan-y' : 'none' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage.number}
              className="pf-about-card__stage"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 30, scale: reduceMotion ? 1 : .975, filter: reduceMotion ? 'none' : 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -24, scale: reduceMotion ? 1 : .96, filter: reduceMotion ? 'none' : 'blur(7px)' }}
              transition={{ duration: reduceMotion ? .01 : .52, ease: [0.22, 1, 0.36, 1] }}
              aria-live="polite"
            >
              <div className="pf-about-card__copy">
                <span className="pf-about-card__number">{stage.number}</span>
                <div>
                  <p className="pf-about-card__eyebrow">{stage.tag}</p>
                  <h3>{stage.title}</h3>
                  <div className="pf-about-card__body">{stage.content}</div>
                </div>
              </div>
              <figure className="pf-about-card__visual">
                <img src={stage.image} alt={stage.imageAlt} loading={activeStage === 0 ? 'eager' : 'lazy'} />
              </figure>
            </motion.div>
          </AnimatePresence>
          <div className="pf-about-card__footer">
            <span>{activeStage + 1} / {aboutStages.length}</span>
            <div className="pf-about-card__steps" aria-label="About story progress">
              {aboutStages.map((item, index) => (
                <button
                  key={item.number}
                  type="button"
                  className={index === activeStage ? 'is-active' : ''}
                  onClick={() => setActiveStage(index)}
                  aria-label={`Show stage ${index + 1}: ${item.title}`}
                  aria-current={index === activeStage ? 'step' : undefined}
                />
              ))}
            </div>
          </div>
        </motion.article>
        <p className="pf-about-stack__instruction">
          <span className="pf-about-stack__instruction--desktop"></span>
          <span className="pf-about-stack__instruction--mobile">Swipe on the card to explore the story.</span>
        </p>
      </div>
    </div>
  );
};

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
  const isAboutPage = location.pathname === ROUTES.ABOUT;
  const isHomeAlias = location.pathname === ROUTES.HOME_ALIAS;

  useEffect(() => {
    if (isContactPage && !showOpening) {
      const contactEl = document.getElementById('contact');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (isAboutPage && !showOpening) {
      const aboutEl = document.getElementById('about');
      if (aboutEl) {
        aboutEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [isContactPage, isAboutPage, showOpening]);

  const handleBrandClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.pathname !== ROUTES.HOME) {
      navigate(ROUTES.HOME);
    }
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
    }
    document.title = 'Parallax Flow';
    setMenuOpen(false);
  };

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.pathname !== ROUTES.HOME_ALIAS) {
      navigate(ROUTES.HOME_ALIAS);
    }
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
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

  const handleAboutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (location.pathname !== ROUTES.ABOUT) {
      navigate(ROUTES.ABOUT);
    } else {
      const aboutEl = document.getElementById('about');
      if (aboutEl) {
        aboutEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
    document.title = 'About Us | Parallax Flow';
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

  return (
    <div className="pf-site">
      <SeoHead
        title={
          isContactPage
            ? 'Contact | Parallax Flow'
            : isAboutPage
            ? 'About Us | Parallax Flow'
            : 'Parallax Flow'
        }
        description={
          isContactPage
            ? 'Send a message to Parallax Flow. Tell us how we can help.'
            : isAboutPage
            ? 'Discover the story, design philosophy, and vision behind Parallax Flow—an adaptive learning ecosystem.'
            : 'Learning, Designed Around You.'
        }
        canonicalPath={
          isContactPage
            ? '/contact'
            : isAboutPage
            ? '/about'
            : isHomeAlias
            ? '/home'
            : '/'
        }
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
          <Link to={ROUTES.HOME} className="pf-brand" aria-label="Parallax Flow home" onClick={handleBrandClick}>
            <img src="/logo.png" alt="Parallax Flow Logo" className="pf-brand__logo-img" />
            <span>Parallax Flow</span>
          </Link>
          <nav className="pf-nav__links" aria-label="Primary navigation">
            <a href="/home" onClick={handleHomeClick}>Home</a>
            <a href="#about" onClick={handleAboutClick}>About us</a>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => e.preventDefault()}>PALM <sup>↗</sup></a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <Link to={ROUTES.STORE}>Store <sup>↗</sup></Link>
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
            <a href="#about" onClick={handleAboutClick}>About us</a>
            <span className="pf-tooltip-wrap">
              <a href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>PALM ↗</a>
              <span className="pf-tooltip">Coming soon</span>
            </span>
            <Link to={ROUTES.STORE} onClick={() => setMenuOpen(false)}>Store ↗</Link>
            <a href="#contact" onClick={handleContactClick}>Connect with us</a>
            {isAuthenticated ? (
              <button className="pf-nav__action" type="button" onClick={() => { setMenuOpen(false); void logout(); }}>
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

        <section className="pf-about pf-section" id="about">
          <motion.div className="pf-section-label" {...fadeUp}><span>01</span> About Parallax Flow</motion.div>
          <div className="pf-about__scene">
            <div className="pf-about__intro-shell">
              <div className="pf-about__intro">
                <motion.div {...fadeUp}>
                  <p className="pf-eyebrow">A learning environment that keeps evolving</p>
                  <h2>Every journey starts<br /><em>with a question.</em></h2>
                </motion.div>
                <motion.p className="pf-about__summary" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
                  Parallax Flow began with a simple belief: learning should feel clear, personal, and alive to the student moving through it.
                </motion.p>
              </div>
            </div>
            <AboutCardStack reduceMotion={reduceMotion} />
          </div>
        </section>

        <section className="pf-contact pf-section" id="contact">
          <motion.div className="pf-section-label" {...fadeUp}><span>02</span> Connect with us</motion.div>
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
              <a href="#about" onClick={handleAboutClick}>About Us</a>
              <a href="#" onClick={(e) => e.preventDefault()}>PALM</a>
            </div>

            <div className="pf-footer-pro__col">
              <h4>Explore</h4>
              <a href="#" onClick={(e) => e.preventDefault()}>Learning Platform</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Learning Resources</a>
              <Link to={ROUTES.STORE}>Notes Store</Link>
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
