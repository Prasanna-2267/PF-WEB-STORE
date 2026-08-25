import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  BadgeHelp,
  BookMarked,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  QrCode,
  Sun,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useThemeStore } from '@/app/store/useThemeStore';
import { ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';
import '@/features/admin/admin.css';

const ADMIN_EASE = [0.22, 1, 0.36, 1] as const;
const ADMIN_DRAWER_QUERY = '(max-width: 1023px)';
const ACADEMY_SIDEBAR_STORAGE_KEY = 'pf_academy_sidebar_open';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const academyNavigation = [
  { label: 'Overview', to: ROUTES.ACADEMY_OVERVIEW, icon: LayoutDashboard },
  { label: 'Admissions', to: ROUTES.ACADEMY_ADMISSIONS, icon: QrCode },
  { label: 'Students', to: ROUTES.ACADEMY_STUDENTS, icon: UsersRound },
  { label: 'Courses', to: ROUTES.ACADEMY_COURSES, icon: BookMarked },
  { label: 'Content', to: ROUTES.ACADEMY_CONTENT, icon: LibraryBig },
  { label: 'Questions', to: ROUTES.ACADEMY_QUESTIONS, icon: BadgeHelp },
  { label: 'Broadcast', to: ROUTES.ACADEMY_BROADCAST, icon: Megaphone },
] as const;

const getSectionLabel = (pathname: string): string => {
  if (pathname.startsWith('/academy/students/')) return 'Student details';
  if (pathname.startsWith('/academy/courses/') && pathname.endsWith('/content')) return 'Course content';
  if (pathname.startsWith('/academy/courses/')) return 'Course details';
  const route = academyNavigation.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return route?.label ?? 'Academy Admin';
};

const getInitials = (name?: string): string => {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!words.length) return 'AC';
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('');
};

interface AdminNavigationItemProps {
  label: string;
  to: string;
  icon: LucideIcon;
}

const AdminNavigationItem: React.FC<AdminNavigationItemProps> = ({ label, to, icon: Icon }) => (
  <NavLink
    to={to}
    end={to === ROUTES.ACADEMY_OVERVIEW}
    className={({ isActive }) => `pf-admin-nav__link${isActive ? ' is-active' : ''}`}
  >
    {({ isActive }) => (
      <>
        {isActive ? <span className="pf-admin-nav__active" aria-hidden="true" /> : null}
        <Icon size={19} aria-hidden={true} />
        <span>{label}</span>
        <ChevronRight className="pf-admin-nav__chevron" size={15} aria-hidden={true} />
      </>
    )}
  </NavLink>
);

export const AcademyLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { mode, toggleTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const { activeAcademy } = useAcademyTenantStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => (
    typeof window === 'undefined'
      ? true
      : window.localStorage.getItem(ACADEMY_SIDEBAR_STORAGE_KEY) !== 'false'
  ));
  const [isCompact, setIsCompact] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia(ADMIN_DRAWER_QUERY).matches
  ));

  const sidebarRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(location.pathname);

  const sectionLabel = useMemo(() => getSectionLabel(location.pathname), [location.pathname]);
  const sidebarVisible = isCompact ? drawerOpen : desktopSidebarOpen;
  const isSuspended = activeAcademy?.status === 'SUSPENDED';

  const setDesktopSidebarVisibility = (visible: boolean) => {
    setDesktopSidebarOpen(visible);
    window.localStorage.setItem(ACADEMY_SIDEBAR_STORAGE_KEY, String(visible));
  };

  const openSidebar = () => {
    if (isCompact) setDrawerOpen(true);
    else setDesktopSidebarVisibility(true);
  };

  const closeSidebar = () => {
    if (isCompact) setDrawerOpen(false);
    else setDesktopSidebarVisibility(false);
  };



  useEffect(() => {
    const media = window.matchMedia(ADMIN_DRAWER_QUERY);
    const updateLayout = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompact(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };

    updateLayout(media);
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

  useEffect(() => {
    if (isCompact) setDrawerOpen(false);

    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      const focusFrame = window.requestAnimationFrame(() => {
        mainRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }
    return undefined;
  }, [isCompact, location.pathname]);

  useEffect(() => {
    if (!sidebarRef.current) return;
    sidebarRef.current.inert = !sidebarVisible;
  }, [sidebarVisible]);

  const routeMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 9 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -5 } };

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: ADMIN_EASE }}>
      <div
        className={`pf-admin${drawerOpen ? ' has-open-drawer' : ''}${!isCompact && !desktopSidebarOpen ? ' is-sidebar-collapsed' : ''}`}
        data-lenis-prevent
      >
        <SeoHead
          title={`${sectionLabel} | ${activeAcademy?.name || 'Academy Admin'}`}
          description="Academy tenant administration workspace powered by Parallax Flow."
          canonicalPath={location.pathname}
          robots="noindex, nofollow, noarchive"
        />
        <a className="pf-admin-skip-link" href="#admin-main">Skip to main content</a>

        <div className="pf-admin-shell">
          <AnimatePresence>
            {isCompact && drawerOpen ? (
              <motion.button
                className="pf-admin-drawer-backdrop"
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: ADMIN_EASE }}
              />
            ) : null}
          </AnimatePresence>

          <aside
            ref={sidebarRef}
            id="pf-admin-navigation"
            className={`pf-admin-sidebar${sidebarVisible ? ' is-open' : ''}`}
            aria-label="Academy Navigation"
            aria-hidden={!sidebarVisible ? true : undefined}
            role={isCompact ? 'dialog' : undefined}
            aria-modal={isCompact ? true : undefined}
            data-lenis-prevent
          >
            <div className="pf-admin-sidebar__header">
              <div className="pf-admin-brand">
                <span className="pf-admin-brand__mark"><img src="/logo.png" alt="" /></span>
                <span className="pf-admin-brand__copy">
                  <strong>{activeAcademy?.name || 'Parallax Flow'}</strong>
                  <small>Academy Admin</small>
                </span>
              </div>
              <button
                ref={closeButtonRef}
                className="pf-admin-icon-button pf-admin-sidebar__close"
                type="button"
                onClick={closeSidebar}
                aria-label="Close navigation menu"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="pf-admin-sidebar__scroll">
              <nav className="pf-admin-nav" aria-label="Academy modules">
                <p className="pf-admin-nav__label">Management</p>
                {academyNavigation.map((item) => <AdminNavigationItem key={item.to} {...item} />)}
              </nav>
            </div>

            <div className="pf-admin-sidebar__footer">
              <div className="pf-admin-account-card">
                <div className="pf-admin-account-card__summary" style={{ cursor: 'default' }}>
                  <span className="pf-admin-account-card__avatar" aria-hidden="true">
                    {getInitials(user?.fullName || 'Academy Admin')}
                  </span>
                  <span className="pf-admin-account-card__copy">
                    <strong>{user?.fullName || 'Academy Administrator'}</strong>
                    <small>{user?.email || activeAcademy?.adminEmail || 'admin@academy.edu'}</small>
                  </span>
                </div>
                <button
                  className="pf-admin-account-card__logout"
                  type="button"
                  onClick={() => { void logout().then(() => navigate(ROUTES.LOGIN, { replace: true })); }}
                  aria-label="Sign out"
                >
                  <LogOut size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </aside>

          <div ref={workspaceRef} className="pf-admin-workspace">
            <header className="pf-admin-topbar">
              <div className="pf-admin-topbar__section">
                {!sidebarVisible ? (
                  <button
                    ref={menuButtonRef}
                    className="pf-admin-icon-button pf-admin-topbar__menu"
                    type="button"
                    onClick={openSidebar}
                    aria-label="Open navigation menu"
                  >
                    <Menu size={21} aria-hidden="true" />
                  </button>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <strong>{sectionLabel}</strong>

                  {/* Static Academy Badge */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--admin-line)',
                      background: 'var(--admin-panel-soft)',
                      color: 'var(--admin-ink)',
                      fontSize: '12px',
                      fontWeight: 650,
                    }}
                  >
                    <Building2 size={13} color="var(--admin-accent-ink)" />
                    <span>{activeAcademy?.name || 'Academy Admin'}</span>
                  </div>
                </div>
                  {isSuspended && (
                    <span className="pf-admin-status pf-admin-status--danger" style={{ fontSize: '11px' }}>
                      <span className="pf-admin-status__dot" /> Suspended
                    </span>
                  )}
              </div>

              <div className="pf-admin-topbar__actions">
                <span className="pf-admin-system-status"><i aria-hidden="true" /> Systems operational</span>
                <button
                  className="pf-admin-theme-toggle"
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
                  title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
                >
                  <Sun className={mode === 'light' ? 'is-active' : ''} size={17} aria-hidden="true" />
                  <Moon className={mode === 'dark' ? 'is-active' : ''} size={17} aria-hidden="true" />
                  <motion.span
                    className="pf-admin-theme-toggle__thumb"
                    animate={{ x: mode === 'dark' ? 24 : 0 }}
                    transition={{ duration: 0.24, ease: ADMIN_EASE }}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </header>

            <main ref={mainRef} id="admin-main" className="pf-admin-main" tabIndex={-1}>
              <React.Suspense
                fallback={
                  <div role="status" aria-live="polite" className="pf-admin-route-loader">
                    <span aria-hidden="true" />
                    <p>Loading Academy Portal&hellip;</p>
                  </div>
                }
              >
                <motion.div
                  key={location.pathname}
                  className="pf-admin-route"
                  initial={routeMotion.initial}
                  animate={routeMotion.animate}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.18, ease: ADMIN_EASE }}
                >
                  <Outlet />
                </motion.div>
              </React.Suspense>
            </main>
          </div>
        </div>
      </div>

      <div className="pf-admin-portal-host" />
    </MotionConfig>
  );
};

export default AcademyLayout;
